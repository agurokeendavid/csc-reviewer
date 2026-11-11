const SCORE_TAB = "Scores";
const SCORE_HEADERS = [
  "Attempt ID", "Submitted at", "Name", "Level", "Mode",
  "Correct", "Total", "Percent", "Elapsed seconds",
];
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ORIGIN_PATTERN = /^(https:\/\/[a-z0-9.-]+(?::\d+)?|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)$/i;
const EXAM_FORMATS = {
  professional: { minutes: 190, sections: { verbal: 43, numerical: 37, analytical: 38, general: 32 } },
  subprofessional: { minutes: 160, sections: { verbal: 42, numerical: 35, clerical: 38, general: 30 } },
};
const SIGNING_KEY_PROPERTY = "EXAM_SIGNING_KEY";

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
  let submission;
  try {
    const raw = event.parameter.submission;
    if (!raw || raw.length > 65000) throw new Error("Invalid request.");
    submission = JSON.parse(raw);
  } catch {
    return ContentService.createTextOutput("Invalid request.");
  }
  if (!submission || typeof submission.token !== "string" || !UUID_PATTERN.test(submission.token) ||
      typeof submission.origin !== "string" || !ORIGIN_PATTERN.test(submission.origin)) {
    return ContentService.createTextOutput("Invalid receipt destination.");
  }

  let result;
  try {
    if (submission.action === "begin") result = { ok: true, data: beginExam_(submission) };
    else if (submission.action === "submit") result = { ok: true, data: submitExam_(submission) };
    else result = { ok: false, message: "Unsupported exam request." };
  } catch (error) {
    if (!error.publicMessage) console.error("Timed exam request failed.");
    result = { ok: false, message: error.publicMessage || "The timed exam service is unavailable. Try again." };
  }

  const receipt = JSON.stringify({ type: "csc-reviewer-score", token: submission.token, ...result })
    .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return HtmlService.createHtmlOutput(
    "<!doctype html><script>window.top.postMessage(" + receipt + "," +
    JSON.stringify(submission.origin) + ");</script>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

function selectExamItems_(bank, count) {
  const topics = new Map();
  for (const index of shuffleExam_(bank.map((_, i) => i))) {
    const topic = bank[index][0];
    if (!topics.has(topic)) topics.set(topic, []);
    topics.get(topic).push(index);
  }
  const selected = [];
  while (selected.length < count) {
    for (const bucket of topics.values()) {
      if (bucket.length) selected.push(bucket.pop());
      if (selected.length === count) break;
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
  if (attempt.version !== TIMED_EXAM_BANK_VERSION) invalidExam_("The question bank has changed. Start a new timed exam.");
  return attempt;
}

function beginExam_(request) {
  const { level, mode } = request;
  if ((level !== "professional" && level !== "subprofessional") || (mode !== "full" && mode !== "quick")) {
    invalidExam_("Choose a valid exam level and mode.");
  }
  const format = EXAM_FORMATS[level];
  const ids = [];
  const questions = [];
  for (const [section, fullCount] of Object.entries(format.sections)) {
    const bank = TIMED_EXAM_BANK[section];
    const count = mode === "quick" ? 5 : fullCount;
    if (bank.length < count) throw new Error("Private question bank has too few items.");
    for (const index of selectExamItems_(bank, count)) {
      const [topic, prompt, correct, wrongA, wrongB, wrongC] = bank[index];
      const id = section + "-" + index;
      ids.push([section, index]);
      questions.push({ id, section, topic, prompt, options: shuffleExam_([correct, wrongA, wrongB, wrongC]).map(String) });
    }
  }
  const id = Utilities.getUuid();
  const start = Date.now();
  const deadline = start + (mode === "quick" ? 25 : format.minutes) * 60000;
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify({
    id, level, mode, start, deadline, ids, version: TIMED_EXAM_BANK_VERSION,
  }), Utilities.Charset.UTF_8);
  return { id, start, deadline, questions, ticket: encoded + "." + signExam_(encoded) };
}

function submitExam_(request) {
  const attempt = decodeExam_(request.ticket);
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
    const [, , answer, wrongA, wrongB, wrongC, explanation, source] = TIMED_EXAM_BANK[section][index];
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
  const elapsed = appendScore_({ ...attempt, name, correct, total, percentage, elapsedSeconds }, digest);
  return { correct, answered, total, percentage, sections, elapsedSeconds: elapsed, solutions };
}

function appendScore_(score, digest) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SCORE_SPREADSHEET_ID");
    if (!spreadsheetId) throw new Error("Run setup before deploying.");
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SCORE_TAB);
    if (!sheet) throw new Error("Scores tab is missing.");

    const lastRow = sheet.getLastRow();
    const previous = lastRow > 1 && sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(score.id).matchEntireCell(true).findNext();
    if (previous) {
      if (previous.getNote() !== digest) invalidExam_("This attempt has already been submitted.");
      return sheet.getRange(previous.getRow(), 9).getValue();
    }

    const safeName = /^[=+\-@]/.test(score.name) ? "'" + score.name : score.name;
    sheet.appendRow([
      score.id, new Date(), safeName, score.level === "professional" ? "Professional" : "Subprofessional",
      score.mode === "quick" ? "Quick practice" : "Full mock exam", score.correct, score.total,
      score.percentage, score.elapsedSeconds,
    ]);
    sheet.getRange(sheet.getLastRow(), 1).setNote(digest);
    SpreadsheetApp.flush();
    return score.elapsedSeconds;
  } finally {
    lock.releaseLock();
  }
}
