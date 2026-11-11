const SCORE_TAB = "Scores";
const SCORE_HEADERS = [
  "Attempt ID", "Submitted at", "Name", "Level", "Mode",
  "Correct", "Total", "Percent", "Elapsed seconds",
];
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ORIGIN_PATTERN = /^(https:\/\/[a-z0-9.-]+(?::\d+)?|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)$/i;

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
  PropertiesService.getScriptProperties().setProperty("SCORE_SPREADSHEET_ID", spreadsheet.getId());
}

function doGet() {
  return ContentService.createTextOutput("CSC Reviewer score endpoint");
}

function doPost(event) {
  let submission;
  try {
    const raw = event.parameter.submission;
    if (!raw || raw.length > 2000) throw new Error("Invalid request.");
    submission = JSON.parse(raw);
  } catch {
    return ContentService.createTextOutput("Invalid request.");
  }
  if (!submission || typeof submission.token !== "string" || !UUID_PATTERN.test(submission.token) ||
      typeof submission.origin !== "string" || !ORIGIN_PATTERN.test(submission.origin)) {
    return ContentService.createTextOutput("Invalid receipt destination.");
  }

  let ok = false;
  try {
    appendScore_(submission);
    ok = true;
  } catch (error) {
    console.error("Score write failed: " + error.message);
  }

  // HTML Service runs this inside Google's sandboxed iframe. Only a receipt
  // goes back to the top-level practice page, addressed to its exact origin.
  const receipt = JSON.stringify({ type: "csc-reviewer-score", token: submission.token, ok });
  return HtmlService.createHtmlOutput(
    "<!doctype html><script>window.top.postMessage(" + receipt + "," +
    JSON.stringify(submission.origin) + ");</script>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function appendScore_(score) {
  const isProfessional = score.level === "professional";
  const isSubprofessional = score.level === "subprofessional";
  const isQuick = score.mode === "quick";
  const expectedTotal = isQuick ? 20 : isProfessional ? 150 : 145;
  const maxSeconds = (isQuick ? 25 : isProfessional ? 190 : 160) * 60;
  const name = (typeof score.name === "string" ? score.name.trim() : "") || "Anonymous";

  if (typeof score.id !== "string" || !UUID_PATTERN.test(score.id) || (!isProfessional && !isSubprofessional) ||
      (!isQuick && score.mode !== "full") || (score.name !== undefined && typeof score.name !== "string") ||
      name.length < 2 || name.length > 80 ||
      /[\u0000-\u001f\u007f]/.test(name) || score.total !== expectedTotal ||
      !Number.isInteger(score.correct) || score.correct < 0 || score.correct > expectedTotal ||
      !Number.isInteger(score.elapsedSeconds) || score.elapsedSeconds < 0 || score.elapsedSeconds > maxSeconds) {
    throw new Error("Invalid score fields.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SCORE_SPREADSHEET_ID");
    if (!spreadsheetId) throw new Error("Run setup before deploying.");
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SCORE_TAB);
    if (!sheet) throw new Error("Scores tab is missing.");

    const lastRow = sheet.getLastRow();
    if (lastRow > 1 && sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(score.id).matchEntireCell(true).findNext()) return;

    const safeName = /^[=+\-@]/.test(name) ? "'" + name : name;
    sheet.appendRow([
      score.id, new Date(), safeName, isProfessional ? "Professional" : "Subprofessional",
      isQuick ? "Quick practice" : "Full mock exam", score.correct, expectedTotal,
      Math.round(10000 * score.correct / expectedTotal) / 100, score.elapsedSeconds,
    ]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}
