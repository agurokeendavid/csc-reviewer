const SCORE_TAB = "Scores";
const FEEDBACK_TAB = "Feedback";
const FEEDBACK_HEADERS = ["Feedback ID", "Submitted at", "Message"];
const SCORE_HEADERS = [
  "Attempt ID", "Submitted at", "Name", "Level", "Mode",
  "Correct", "Total", "Percent", "Elapsed seconds",
];
const PUBLIC_NAME_COLUMN = SCORE_HEADERS.length + 1;
const PUBLIC_NAME_HEADER = "Public display name";
// Answers kept on the device can be submitted after the deadline when the tab was closed at
// expiry. Those scores are still graded and saved, but stay off the leaderboard. The grace
// period covers a slow network or one retry for an exam that ended while the tab was open.
const LATE_GRACE_MS = 2 * 60000;
const LATE_COLUMN = PUBLIC_NAME_COLUMN + 1;
const LATE_HEADER = "Submitted late";
// The organizer types Yes (or ticks a checkbox) here to take a score off the leaderboard.
const HIDDEN_COLUMN = LATE_COLUMN + 1;
const HIDDEN_HEADER = "Hide from leaderboard";
// Faster than this average can't be a real attempt, for example someone pasting from a
// collected answer key. The real exam allows about 76 seconds per item.
const MIN_SECONDS_PER_ITEM = 15;
// The browser counts how often the examinee left the exam page (switched tab or window,
// minimized, or closed it) and for how long. Past either limit the score stays off the
// leaderboard. These counts come from the browser, so a determined cheater can fake them.
const LEAVES_COLUMN = HIDDEN_COLUMN + 1;
const LEAVES_HEADER = "Times left exam page";
const AWAY_COLUMN = LEAVES_COLUMN + 1;
const AWAY_HEADER = "Seconds away";
const AWAY_LEAVE_LIMIT = 3;
const AWAY_SECONDS_LIMIT = 60;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
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
    styleHeader_(sheet.getRange(1, 1, 1, SCORE_HEADERS.length));
    sheet.setColumnWidth(1, 285);
    sheet.setColumnWidth(2, 165);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(4, 145);
  } else if (sheet.getRange(1, 1, 1, SCORE_HEADERS.length).getValues()[0].join("|") !== SCORE_HEADERS.join("|")) {
    throw new Error("The Scores tab already has different headers. Rename that tab before running setup.");
  }
  ensurePublicNameColumn_(sheet);
  ensureHeaderColumn_(sheet, LATE_COLUMN, LATE_HEADER);
  ensureHeaderColumn_(sheet, HIDDEN_COLUMN, HIDDEN_HEADER);
  ensureAwayColumns_(sheet);
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("SCORE_SPREADSHEET_ID", spreadsheet.getId());
  if (!properties.getProperty(SIGNING_KEY_PROPERTY)) {
    properties.setProperty(SIGNING_KEY_PROPERTY, Utilities.getUuid() + Utilities.getUuid());
  }
}

function doGet() {
  return ContentService.createTextOutput("CSC Reviewer timed exam service");
}

// Every response is JSON. The browser still sends transport=json, which this version ignores,
// so the site keeps working against deployments made before the iframe receipt was removed.
function doPost(event) {
  let submission;
  try {
    const raw = event.parameter.submission;
    if (!raw || raw.length > 65000) throw new Error("Invalid request.");
    submission = JSON.parse(raw);
  } catch {
    return jsonExamResponse_({ ok: false, message: "Invalid request." });
  }
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) {
    return jsonExamResponse_({ ok: false, message: "Invalid request." });
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

  return jsonExamResponse_(result);
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
  const late = Date.now() > attempt.deadline + LATE_GRACE_MS;
  const publishName = request.publishName === true && name !== "Anonymous" && !late;
  const away = readAway_(request.away, attempt);
  const saved = appendScore_({ ...attempt, name, correct, total, percentage, elapsedSeconds, publishName, late, away }, digest);
  return {
    correct, answered, total, percentage, sections, solutions,
    elapsedSeconds: saved.elapsedSeconds,
    late: saved.late,
    tooFast: !isPlausibleTime_(saved.elapsedSeconds, total),
    away: saved.away,
    awayFlagged: isAwayFlagged_(saved.away.leaves, saved.away.awaySeconds),
  };
}

// Older builds of the site send no away counts, so those count as zero.
function readAway_(away, attempt) {
  const count = (value, max) => (Number.isInteger(value) && value >= 0 ? Math.min(value, max) : 0);
  const examSeconds = Math.ceil((attempt.deadline - attempt.start) / 1000);
  return {
    leaves: count(away && away.leaves, 10000),
    awaySeconds: count(away && away.awaySeconds, examSeconds),
  };
}

function isAwayFlagged_(leaves, awaySeconds) {
  return Number(leaves) >= AWAY_LEAVE_LIMIT || Number(awaySeconds) > AWAY_SECONDS_LIMIT;
}

function ensureAwayColumns_(sheet) {
  ensureHeaderColumn_(sheet, LEAVES_COLUMN, LEAVES_HEADER);
  ensureHeaderColumn_(sheet, AWAY_COLUMN, AWAY_HEADER);
}

function isPlausibleTime_(elapsedSeconds, total) {
  return Number.isFinite(elapsedSeconds) && elapsedSeconds >= total * MIN_SECONDS_PER_ITEM;
}

function isMarked_(value) {
  return value === true || /^(yes|y|x|true)$/i.test(String(value).trim());
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
      styleHeader_(sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length));
      sheet.setColumnWidth(3, 480);
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
  ensureHeaderColumn_(sheet, PUBLIC_NAME_COLUMN, PUBLIC_NAME_HEADER);
}

function ensureHeaderColumn_(sheet, column, title) {
  const header = sheet.getRange(1, column);
  const value = header.getValue();
  if (value === title) return;
  if (value) throw new Error("The " + title + " column is already in use.");
  styleHeader_(header.setValue(title));
  sheet.setColumnWidth(column, 180);
}

// Matches the header row the organizer styled by hand: bold dark text on light grey, with borders.
function styleHeader_(range) {
  return range.setBackground("#f1f3f4").setFontColor("#202124").setFontWeight("bold")
    .setFontFamily("Carlito").setFontSize(11)
    .setBorder(true, true, true, true, true, true);
}

function readLeaderboard_(request) {
  const { level, mode } = request;
  if ((level !== "professional" && level !== "subprofessional") || (mode !== "full" && mode !== "quick")) {
    invalidExam_("Choose a valid leaderboard format.");
  }

  const sheet = openScoreSheet_();
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount < 1) return { scores: [] };
  // Only trust the optional columns whose headers match, in case a column was repurposed.
  const lastColumn = Math.max(SCORE_HEADERS.length, Math.min(sheet.getLastColumn(), AWAY_COLUMN));
  const header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const hasColumn = (column, title) => header[column - 1] === title;
  const hasPublicNames = hasColumn(PUBLIC_NAME_COLUMN, PUBLIC_NAME_HEADER);
  const hasLateFlags = hasColumn(LATE_COLUMN, LATE_HEADER);
  const hasHiddenFlags = hasColumn(HIDDEN_COLUMN, HIDDEN_HEADER);
  const hasAwayCounts = hasColumn(LEAVES_COLUMN, LEAVES_HEADER) && hasColumn(AWAY_COLUMN, AWAY_HEADER);
  const levelLabel = level === "professional" ? "Professional" : "Subprofessional";
  const modeLabel = mode === "quick" ? "Quick practice" : "Full mock exam";
  const expectedTotal = mode === "quick" ? 20 : Object.values(EXAM_FORMATS[level].sections).reduce((sum, size) => sum + size, 0);
  // Start at column D so private names and attempt IDs never enter the leaderboard data.
  const rows = sheet.getRange(2, 4, rowCount, lastColumn - 3).getValues();
  const scores = rows
    .filter(([rowLevel, rowMode, correct, total, , elapsedSeconds, , late, hidden, leaves, awaySeconds]) =>
      rowLevel === levelLabel && rowMode === modeLabel &&
      total === expectedTotal && Number.isInteger(correct) && correct >= 0 && correct <= total &&
      isPlausibleTime_(elapsedSeconds, total) &&
      !(hasLateFlags && late === "Yes") &&
      !(hasHiddenFlags && isMarked_(hidden)) &&
      !(hasAwayCounts && isAwayFlagged_(leaves, awaySeconds)))
    .map(([, , correct, total, , elapsedSeconds, publicName]) => ({
      displayName: hasPublicNames && typeof publicName === "string" && publicName.trim()
        ? publicName.trim().slice(0, 80) : "Anonymous",
      correct,
      total,
      percentage: Math.round(10000 * correct / total) / 100,
      elapsedSeconds,
    }))
    // Equal scores rank by time used, so the faster attempt places higher.
    .sort((first, second) => second.correct - first.correct || first.elapsedSeconds - second.elapsedSeconds)
    .slice(0, 5)
    .map(({ elapsedSeconds, ...score }) => score);
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
      // A retry reports what was first saved, so a slow retry can't turn an on-time score late.
      const row = previous.getRow();
      const [leaves, awaySeconds] = sheet.getRange(row, LEAVES_COLUMN, 1, 2).getValues()[0];
      return {
        elapsedSeconds: sheet.getRange(row, 9).getValue(),
        late: sheet.getRange(row, LATE_COLUMN).getValue() === "Yes",
        away: { leaves: Number(leaves) || 0, awaySeconds: Number(awaySeconds) || 0 },
      };
    }

    const wasAway = score.away.leaves > 0 || score.away.awaySeconds > 0;
    if (score.publishName || score.late || wasAway) ensurePublicNameColumn_(sheet);
    if (score.late || wasAway) ensureHeaderColumn_(sheet, LATE_COLUMN, LATE_HEADER);
    if (wasAway) {
      ensureHeaderColumn_(sheet, HIDDEN_COLUMN, HIDDEN_HEADER);
      ensureAwayColumns_(sheet);
    }
    const safeName = /^[=+\-@]/.test(score.name) ? "'" + score.name : score.name;
    const row = [
      score.id, new Date(), safeName, score.level === "professional" ? "Professional" : "Subprofessional",
      score.mode === "quick" ? "Quick practice" : "Full mock exam", score.correct, score.total,
      score.percentage, score.elapsedSeconds,
      score.publishName ? "'" + score.name : "",
      score.late ? "Yes" : "",
    ];
    if (wasAway) row.push("", score.away.leaves, score.away.awaySeconds);
    sheet.appendRow(row);
    sheet.getRange(sheet.getLastRow(), 1).setNote(digest);
    SpreadsheetApp.flush();
    return { elapsedSeconds: score.elapsedSeconds, late: score.late, away: score.away };
  } finally {
    lock.releaseLock();
  }
}
