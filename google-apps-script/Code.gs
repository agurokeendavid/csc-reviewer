const SCORE_TAB = "Scores";
const FEEDBACK_TAB = "Feedback";
const FEEDBACK_HEADERS = ["Feedback ID", "Submitted at", "Message"];
const SCORE_HEADERS = [
  "Attempt ID", "Submitted at", "Name", "Level", "Mode",
  "Correct", "Total", "Percent", "Elapsed seconds",
];
const PUBLIC_NAME_COLUMN = SCORE_HEADERS.length + 1;
const PUBLIC_NAME_HEADER = "Public display name";
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ORIGIN_PATTERN = /^(https:\/\/[a-z0-9.-]+(?::\d+)?|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)$/i;
const EXAM_FORMATS = {
  professional: { minutes: 190, sections: { verbal: 43, numerical: 37, analytical: 38, general: 32 } },
  subprofessional: { minutes: 160, sections: { verbal: 42, numerical: 35, clerical: 38, general: 30 } },
};
const SIGNING_KEY_PROPERTY = "EXAM_SIGNING_KEY";
const PREVIOUS_DAILY_EXAM_BANK_VERSION = "2026-daily-1";
const EXPANDED_DAILY_EXAM_BANK_VERSION = "2026-daily-2";
const DAILY_EXAM_BANK_VERSION = "2026-daily-3";

// Run once from the editor of the script bound to the destination spreadsheet.
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Open Apps Script from the destination spreadsheet.");
  const sheet = spreadsheet.getSheetByName(SCORE_TAB) || spreadsheet.insertSheet(SCORE_TAB);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SCORE_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SCORE_HEADERS.length)
      .setBackground("#143b30").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setColumnWidth(1, 285);
    sheet.setColumnWidth(2, 165);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(4, 145);
  } else if (sheet.getRange(1, 1, 1, SCORE_HEADERS.length).getValues()[0].join("|") !== SCORE_HEADERS.join("|")) {
    throw new Error("The Scores tab already has different headers. Rename that tab before running setup.");
  }
  ensurePublicNameColumn_(sheet);
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("SCORE_SPREADSHEET_ID", spreadsheet.getId());
  if (!properties.getProperty(SIGNING_KEY_PROPERTY)) {
    properties.setProperty(SIGNING_KEY_PROPERTY, Utilities.getUuid() + Utilities.getUuid());
  }
}

function doGet() {
  return ContentService.createTextOutput("CSC Reviewer timed exam service");
}

function doPost(event) {
  const useJson = event.parameter.transport === "json";
  let submission;
  try {
    const raw = event.parameter.submission;
    if (!raw || raw.length > 65000) throw new Error("Invalid request.");
    submission = JSON.parse(raw);
  } catch {
    return useJson ? jsonExamResponse_({ ok: false, message: "Invalid request." })
      : ContentService.createTextOutput("Invalid request.");
  }
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) {
    return useJson ? jsonExamResponse_({ ok: false, message: "Invalid request." })
      : ContentService.createTextOutput("Invalid request.");
  }
  if (!useJson && (typeof submission.token !== "string" || !UUID_PATTERN.test(submission.token) ||
      typeof submission.origin !== "string" || !ORIGIN_PATTERN.test(submission.origin))) {
    return ContentService.createTextOutput("Invalid receipt destination.");
  }

  let result;
  try {
    if (submission.action === "begin") result = { ok: true, data: beginExam_(submission) };
    else if (submission.action === "submit") result = { ok: true, data: submitExam_(submission) };
    else if (submission.action === "leaderboard") result = { ok: true, data: readLeaderboard_(submission) };
    else if (submission.action === "feedback") result = { ok: true, data: saveFeedback_(submission) };
    else result = { ok: false, message: "Unsupported exam request." };
  } catch (error) {
    const service = submission.action === "feedback" ? "Feedback" : "Timed exam";
    if (!error.publicMessage) console.error(service + " request failed.");
    result = { ok: false, message: error.publicMessage || service + " is unavailable. Try again." };
  }

  if (useJson) return jsonExamResponse_(result);

  // Support clients loaded before the JSON transport was deployed.
  const receipt = JSON.stringify({ type: "csc-reviewer-score", token: submission.token, ...result })
    .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return HtmlService.createHtmlOutput(
    "<!doctype html><script>window.top.postMessage(" + receipt + "," +
    JSON.stringify(submission.origin) + ");</script>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonExamResponse_(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function invalidExam_(message) {
  const error = new Error(message);
  error.publicMessage = message;
  throw error;
}

function shuffleExam_(values) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const index = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[index]] = [copy[index], copy[i]];
  }
  return copy;
}

function dailyPreferredIndices_(bank, day) {
  const topics = new Map();
  for (const [index, [topic]] of bank.entries()) {
    if (!topics.has(topic)) topics.set(topic, []);
    topics.get(topic).push(index);
  }

  const preferred = new Set();
  for (const indices of topics.values()) {
    // Move the preferred window through each topic without changing any question IDs.
    const start = day % indices.length;
    const size = Math.max(1, Math.floor(indices.length * 2 / 3));
    for (let offset = 0; offset < size; offset++) {
      preferred.add(indices[(start + offset) % indices.length]);
    }
  }
  return preferred;
}

function selectExamItems_(bank, count, section, recent, day) {
  const topics = new Map();
  const choiceSets = new Set();
  const indices = shuffleExam_(bank.map((_, index) => index));
  const isRecent = (index) => recent.has(section + "-" + index);
  const preferred = dailyPreferredIndices_(bank, day);
  const priorityOf = (index) => 2 * Number(isRecent(index)) + Number(!preferred.has(index));
  indices.sort((left, right) => priorityOf(left) - priorityOf(right));
  for (const index of indices) {
    const [topic, , ...choices] = bank[index];
    const options = choices.slice(0, 4).map(String).sort();
    const key = JSON.stringify(options);
    if (new Set(options).size !== 4 || choiceSets.has(key)) continue;
    choiceSets.add(key);
    if (!topics.has(topic)) topics.set(topic, { fresh: [], recent: [] });
    const group = topics.get(topic);
    group[isRecent(index) ? "recent" : "fresh"].push(index);
  }
  if (choiceSets.size < count) throw new Error("Private question bank has too few distinct items.");

  const selected = [];
  const groups = [...topics.values()];
  for (const priority of ["fresh", "recent"]) {
    while (selected.length < count && groups.some((group) => group[priority].length)) {
      for (const group of groups) {
        if (group[priority].length) selected.push(group[priority].shift());
        if (selected.length === count) break;
      }
    }
  }
  return shuffleExam_(selected);
}

function signExam_(encoded) {
  const key = PropertiesService.getScriptProperties().getProperty(SIGNING_KEY_PROPERTY);
  if (!key) throw new Error("Run setup.");
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encoded, key));
}

function decodeExam_(ticket) {
  if (typeof ticket !== "string" || ticket.length > 18000 || !/^[\w=-]+\.[\w=-]+$/.test(ticket)) {
    invalidExam_("This exam ticket is invalid.");
  }
  const [payload, signature] = ticket.split(".");
  const expected = signExam_(payload);
  let difference = signature.length ^ expected.length;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  if (difference) invalidExam_("This exam ticket is invalid.");
  const attempt = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString());
  const supportedVersions = [
    TIMED_EXAM_BANK_VERSION, PREVIOUS_DAILY_EXAM_BANK_VERSION,
    EXPANDED_DAILY_EXAM_BANK_VERSION, DAILY_EXAM_BANK_VERSION,
  ];
  if (!supportedVersions.includes(attempt.version)) {
    invalidExam_("The question bank has changed. Start a new timed exam.");
  }
  return attempt;
}

function beginExam_(request) {
  const { level, mode } = request;
  if ((level !== "professional" && level !== "subprofessional") || (mode !== "full" && mode !== "quick")) {
    invalidExam_("Choose a valid exam level and mode.");
  }
  const format = EXAM_FORMATS[level];
  const start = Date.now();
  const day = Math.floor((start + 8 * 60 * 60000) / 86400000);
  const dailyBank = buildRotatingTimedBank_(day);
  const recent = new Set(Array.isArray(request.recentQuestionIds)
    ? request.recentQuestionIds.slice(0, 150).filter((id) => typeof id === "string" && /^[a-z]+-\d{1,4}$/.test(id))
    : []);
  const ids = [];
  const questions = [];
  for (const [section, fullCount] of Object.entries(format.sections)) {
    const bank = dailyBank[section];
    const count = mode === "quick" ? 5 : fullCount;
    for (const index of selectExamItems_(bank, count, section, recent, day)) {
      const [topic, prompt, correct, wrongA, wrongB, wrongC] = bank[index];
      const id = section + "-" + index;
      ids.push([section, index]);
      questions.push({ id, section, topic, prompt, options: shuffleExam_([correct, wrongA, wrongB, wrongC]).map(String) });
    }
  }
  const id = Utilities.getUuid();
  const deadline = start + (mode === "quick" ? 25 : format.minutes) * 60000;
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify({
    id, level, mode, start, deadline, ids, day, version: DAILY_EXAM_BANK_VERSION,
  }), Utilities.Charset.UTF_8);
  return { id, start, deadline, questions, ticket: encoded + "." + signExam_(encoded) };
}

function submitExam_(request) {
  const attempt = decodeExam_(request.ticket);
  let examBank = TIMED_EXAM_BANK;
  if (attempt.version === DAILY_EXAM_BANK_VERSION) examBank = buildRotatingTimedBank_(attempt.day);
  if (attempt.version === EXPANDED_DAILY_EXAM_BANK_VERSION) examBank = buildExpandedDailyTimedBank_(attempt.day);
  if (attempt.version === PREVIOUS_DAILY_EXAM_BANK_VERSION) examBank = buildDailyTimedBank_(attempt.day);
  const name = (typeof request.name === "string" ? request.name.trim() : "") || "Anonymous";
  if ((request.name !== undefined && typeof request.name !== "string") ||
      name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) ||
      !request.answers || typeof request.answers !== "object" || Array.isArray(request.answers)) {
    invalidExam_("Check the name and answers before submitting.");
  }
  const sections = {};
  const solutions = {};
  const canonicalAnswers = [];
  let answered = 0;
  let correct = 0;
  for (const [section, index] of attempt.ids) {
    const id = section + "-" + index;
    const [, , answer, wrongA, wrongB, wrongC, explanation, source] = examBank[section][index];
    const key = String(answer);
    const selected = request.answers[id];
    const score = sections[section] || (sections[section] = { correct: 0, total: 0 });
    score.total++;
    if (selected !== undefined) {
      if (![answer, wrongA, wrongB, wrongC].map(String).includes(selected)) {
        invalidExam_("An answer is outside the options for this exam.");
      }
      answered++;
    }
    if (selected === key) { correct++; score.correct++; }
    canonicalAnswers.push(selected === undefined ? null : selected);
    solutions[id] = { correct: key, explanation, source };
  }
  if (Object.keys(request.answers).length !== answered) invalidExam_("An answer does not belong to this exam.");
  const total = attempt.ids.length;
  const elapsedSeconds = Math.max(0, Math.floor((Math.min(Date.now(), attempt.deadline) - attempt.start) / 1000));
  const percentage = Math.round(10000 * correct / total) / 100;
  const digest = signExam_(JSON.stringify(canonicalAnswers));
  const publishName = request.publishName === true && name !== "Anonymous";
  const elapsed = appendScore_({ ...attempt, name, correct, total, percentage, elapsedSeconds, publishName }, digest);
  return { correct, answered, total, percentage, sections, elapsedSeconds: elapsed, solutions };
}

function openScoreSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SCORE_SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Run setup before deploying.");
  return SpreadsheetApp.openById(spreadsheetId);
}

function openScoreSheet_() {
  const sheet = openScoreSpreadsheet_().getSheetByName(SCORE_TAB);
  if (!sheet) throw new Error("Scores tab is missing.");
  return sheet;
}

function saveFeedback_(request) {
  const { id } = request;
  const message = typeof request.message === "string" ? request.message.trim() : "";
  if (typeof id !== "string" || !UUID_PATTERN.test(id) || !message || message.length > 2000) {
    invalidExam_("Enter feedback of up to 2,000 characters.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = openScoreSpreadsheet_();
    const sheet = spreadsheet.getSheetByName(FEEDBACK_TAB) || spreadsheet.insertSheet(FEEDBACK_TAB);
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(FEEDBACK_HEADERS);
      sheet.setFrozenRows(1);
    } else if (sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length).getValues()[0].join("|") !== FEEDBACK_HEADERS.join("|")) {
      throw new Error("The Feedback tab already has different headers.");
    }

    const previous = lastRow > 1 && sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(id).matchEntireCell(true).findNext();
    if (!previous) {
      // The leading apostrophe makes Sheets store visitor input as text.
      sheet.appendRow([id, new Date(), "'" + message]);
      SpreadsheetApp.flush();
    }
    return { saved: true };
  } finally {
    lock.releaseLock();
  }
}

function ensurePublicNameColumn_(sheet) {
  const header = sheet.getRange(1, PUBLIC_NAME_COLUMN);
  const value = header.getValue();
  if (value === PUBLIC_NAME_HEADER) return;
  if (value) throw new Error("The public display name column is already in use.");
  header.setValue(PUBLIC_NAME_HEADER).setBackground("#143b30").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setColumnWidth(PUBLIC_NAME_COLUMN, 180);
}

function readLeaderboard_(request) {
  const { level, mode } = request;
  if ((level !== "professional" && level !== "subprofessional") || (mode !== "full" && mode !== "quick")) {
    invalidExam_("Choose a valid leaderboard format.");
  }

  const sheet = openScoreSheet_();
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount < 1) return { scores: [] };
  const hasPublicNames = sheet.getRange(1, PUBLIC_NAME_COLUMN).getValue() === PUBLIC_NAME_HEADER;
  const levelLabel = level === "professional" ? "Professional" : "Subprofessional";
  const modeLabel = mode === "quick" ? "Quick practice" : "Full mock exam";
  const expectedTotal = mode === "quick" ? 20 : Object.values(EXAM_FORMATS[level].sections).reduce((sum, size) => sum + size, 0);
  // Start at column D so private names and attempt IDs never enter the leaderboard data.
  const rows = sheet.getRange(2, 4, rowCount, hasPublicNames ? 7 : 6).getValues();
  const scores = rows
    .filter(([rowLevel, rowMode, correct, total]) => rowLevel === levelLabel && rowMode === modeLabel &&
      total === expectedTotal && Number.isInteger(correct) && correct >= 0 && correct <= total)
    .map(([, , correct, total, , , publicName]) => ({
      displayName: typeof publicName === "string" && publicName.trim() ? publicName.trim().slice(0, 80) : "Anonymous",
      correct,
      total,
      percentage: Math.round(10000 * correct / total) / 100,
    }))
    .sort((first, second) => second.correct - first.correct)
    .slice(0, 5);
  return { scores };
}

function appendScore_(score, digest) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = openScoreSheet_();

    const lastRow = sheet.getLastRow();
    const previous = lastRow > 1 && sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(score.id).matchEntireCell(true).findNext();
    if (previous) {
      if (previous.getNote() !== digest) invalidExam_("This attempt has already been submitted.");
      return sheet.getRange(previous.getRow(), 9).getValue();
    }

    if (score.publishName) ensurePublicNameColumn_(sheet);
    const safeName = /^[=+\-@]/.test(score.name) ? "'" + score.name : score.name;
    sheet.appendRow([
      score.id, new Date(), safeName, score.level === "professional" ? "Professional" : "Subprofessional",
      score.mode === "quick" ? "Quick practice" : "Full mock exam", score.correct, score.total,
      score.percentage, score.elapsedSeconds,
      score.publishName ? "'" + score.name : "",
    ]);
    sheet.getRange(sheet.getLastRow(), 1).setNote(digest);
    SpreadsheetApp.flush();
    return score.elapsedSeconds;
  } finally {
    lock.releaseLock();
  }
}
