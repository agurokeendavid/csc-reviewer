import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { AWAY_LEAVE_LIMIT, AWAY_SECONDS_LIMIT, BANK, MIN_SECONDS_PER_ITEM } from "../lib/exam.js";

const script = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const privateBank = new URL("../google-apps-script/ExamBank.gs", import.meta.url);
const publicFixture = Object.fromEntries(Object.entries(BANK).map(([section, items]) => [section, items.map((item) => [
  item.topic, item.prompt, item.correct, ...item.options.filter((option) => option !== item.correct), item.explanation, item.source,
])]));
const bankSource = existsSync(privateBank) ? readFileSync(privateBank, "utf8") : "";
const testTime = Date.parse("2026-11-12T15:59:00Z");

function buildFixtureBank(day) {
  return {
    ...publicFixture,
    numerical: publicFixture.numerical.map(([topic, prompt, ...rest]) => [topic, `${day} ${prompt}`, ...rest]),
  };
}

function mockSheet(rows) {
  const notes = new Map();
  return {
    appendRow: (values) => rows.push(values),
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(0, ...rows.map((row) => row.length)),
    setFrozenRows: () => {},
    setColumnWidth: () => {},
    getRange: (row, column, height = 1, width = 1) => ({
      setBackground() { return this; },
      setFontColor() { return this; },
      setFontWeight() { return this; },
      setFontFamily() { return this; },
      setFontSize() { return this; },
      setBorder() { return this; },
      getValues: () => rows.slice(row - 1, row - 1 + height).map((values) =>
        values.slice(column - 1, column - 1 + width).map((value, index) =>
          column + index === 10 && typeof value === "string" ? value.replace(/^'/, "") : value)),
      getValue: () => rows[row - 1][column - 1] ?? "",
      setValue(value) { rows[row - 1][column - 1] = value; return this; },
      setNote: (note) => notes.set(row, note),
      createTextFinder: (value) => ({
        matchEntireCell() { return this; },
        findNext() {
          const index = rows.findIndex(([id]) => id === value);
          return index < 0 ? null : { getNote: () => notes.get(index + 1), getRow: () => index + 1 };
        },
      }),
    }),
  };
}

function mockAppsScript(random = Math.random) {
  const rows = [];
  const feedbackRows = [];
  const sheets = new Map([["Scores", mockSheet(rows)]]);
  const properties = new Map();
  let locked = false;
  let now = testTime;
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) ?? null,
    insertSheet(name) {
      assert.equal(sheets.has(name), false);
      assert.equal(name, "Feedback");
      const sheet = mockSheet(feedbackRows);
      sheets.set(name, sheet);
      return sheet;
    },
    getId: () => "test-spreadsheet",
  };
  const globals = {
    Date: class extends Date { static now() { return now; } },
    Math: Object.assign(Object.create(Math), { random }),
    TIMED_EXAM_BANK: publicFixture,
    TIMED_EXAM_BANK_VERSION: "test",
    buildDailyTimedBank_: buildFixtureBank,
    buildExpandedDailyTimedBank_: buildFixtureBank,
    buildRotatingTimedBank_: buildFixtureBank,
    Utilities: {
      getUuid: randomUUID,
      Charset: { UTF_8: "utf8" },
      base64EncodeWebSafe: (value) => Buffer.from(value).toString("base64url"),
      base64DecodeWebSafe: (value) => Buffer.from(value, "base64url"),
      newBlob: (value) => ({ getDataAsString: () => Buffer.from(value).toString("utf8") }),
      computeHmacSha256Signature: (value, key) => createHmac("sha256", key).update(value).digest(),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
      flush: () => assert.equal(locked, true),
    },
    PropertiesService: { getScriptProperties: () => ({
      setProperty: (key, value) => properties.set(key, value),
      getProperty: (key) => properties.get(key),
    }) },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(locked, false); locked = true; },
      releaseLock() { assert.equal(locked, true); locked = false; },
    }) },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (content) => ({ content, setMimeType: (mimeType) => ({ content, mimeType }) }),
    },
    console: { error() {} },
  };
  const app = runInNewContext(`${bankSource}\n${script}\n({
    setup, doPost, buildDailyTimedBank_, buildExpandedDailyTimedBank_, buildRotatingTimedBank_,
    TIMED_EXAM_BANK, TIMED_EXAM_BANK_VERSION, PREVIOUS_DAILY_EXAM_BANK_VERSION,
    EXPANDED_DAILY_EXAM_BANK_VERSION, signExam_
  })`, globals);
  app.setup();
  app.setup();
  return { app, rows, feedbackRows, setTime: (time) => { now = time; } };
}

function sendJson(app, fields) {
  const response = app.doPost({ parameter: { transport: "json", submission: JSON.stringify(fields) } });
  assert.equal(response.mimeType, "application/json");
  return JSON.parse(response.content);
}

const send = sendJson;

test("feedback validates messages and stores anonymous retries once in a separate tab", () => {
  const { app, rows, feedbackRows } = mockAppsScript();
  const request = { action: "feedback", id: randomUUID(), message: "  =1+1\nMore practice sets, please.  " };
  for (const fields of [{ id: "invalid" }, { message: " " }, { message: "a".repeat(2001) }]) {
    assert.equal(sendJson(app, { ...request, ...fields }).ok, false);
  }
  assert.equal(feedbackRows.length, 0);
  assert.deepEqual(sendJson(app, request), { ok: true, data: { saved: true } });
  assert.deepEqual(sendJson(app, request), { ok: true, data: { saved: true } });
  assert.equal(feedbackRows.length, 2);
  assert.deepEqual(Array.from(feedbackRows[0]), ["Feedback ID", "Submitted at", "Message"]);
  assert.equal(feedbackRows[1][0], request.id);
  assert.ok(Number.isFinite(feedbackRows[1][1].getTime()));
  assert.equal(feedbackRows[1][2], "'=1+1\nMore practice sets, please.");
  assert.equal(rows.length, 1);
});

test("the JSON transport can start and submit an exam without an iframe receipt", () => {
  const { app, rows } = mockAppsScript();
  const begin = sendJson(app, { action: "begin", level: "professional", mode: "quick" });
  assert.equal(begin.ok, true);
  assert.equal(begin.data.questions.length, 20);
  assert.ok(begin.data.questions.every((item) => !("correct" in item)));
  assert.equal(rows.length, 1);

  const submit = { action: "submit", ticket: begin.data.ticket, answers: {} };
  const result = sendJson(app, submit);
  assert.equal(result.ok, true);
  assert.equal(Object.keys(result.data.solutions).length, 20);
  assert.equal(rows.length, 2);
  assert.equal(sendJson(app, submit).ok, true);
  assert.equal(rows.length, 2);
  assert.equal(sendJson(app, { ...submit, ticket: "invalid" }).ok, false);
});

function start(app, level = "professional", mode = "quick") {
  const response = send(app, { action: "begin", level, mode });
  assert.equal(response.ok, true, response.message);
  return response.data;
}

test("begin returns the timed format and excludes solutions from questions and the ticket", () => {
  const { app, rows } = mockAppsScript();
  for (const [level, mode, count, minutes] of [
    ["professional", "full", 150, 190],
    ["subprofessional", "full", 145, 160],
    ["professional", "quick", 20, 25],
  ]) {
    const exam = start(app, level, mode);
    assert.equal(exam.questions.length, count);
    assert.equal(exam.deadline - exam.start, minutes * 60000);
    const choicesBySection = new Set();
    for (const item of exam.questions) {
      assert.deepEqual(Object.keys(item).sort(), ["id", "options", "prompt", "section", "topic"]);
      const key = JSON.stringify([item.section, [...item.options].sort()]);
      assert.ok(!choicesBySection.has(key));
      choicesBySection.add(key);
    }
    const decoded = JSON.parse(Buffer.from(exam.ticket.split(".")[0], "base64url").toString());
    assert.deepEqual(Object.keys(decoded).sort(), ["day", "deadline", "id", "ids", "level", "mode", "start", "version"]);
  }
  assert.equal(rows.length, 1);
});

test("the server grades assigned options, reveals solutions after saving, and accepts identical retries", () => {
  const { app, rows } = mockAppsScript();
  const exam = start(app);
  const [first] = exam.questions;
  const { day } = JSON.parse(Buffer.from(exam.ticket.split(".")[0], "base64url").toString());
  const correct = String(app.buildRotatingTimedBank_(day).verbal[Number(first.id.split("-")[1])][2]);
  const submission = { action: "submit", ticket: exam.ticket, answers: { [first.id]: correct }, correct: 20 };
  const receipt = send(app, submission);
  assert.equal(receipt.ok, true, receipt.message);
  assert.equal(receipt.data.correct, 1);
  assert.equal(receipt.data.solutions[first.id].correct, correct);
  assert.equal(send(app, submission).ok, true);
  assert.equal(send(app, { ...submission, answers: {} }).ok, false);
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows[1].slice(2, 8)), ["Anonymous", "Professional", "Quick practice", 1, 20, 5]);
});

test("retakes prefer fresh IDs and grading keeps the question version issued before Manila midnight", () => {
  const { app, setTime } = mockAppsScript();
  const exam = start(app);
  const previous = new Set(exam.questions.map(({ id }) => id));
  const retry = sendJson(app, {
    action: "begin", level: "professional", mode: "quick", recentQuestionIds: [...previous],
  });
  assert.equal(retry.ok, true);
  assert.ok(retry.data.questions.every(({ id }) => !previous.has(id)));

  const item = exam.questions.find(({ section }) => section === "numerical");
  const index = Number(item.id.split("-")[1]);
  const { day } = JSON.parse(Buffer.from(exam.ticket.split(".")[0], "base64url").toString());
  const before = app.buildRotatingTimedBank_(day).numerical[index];
  setTime(testTime + 120000);
  const after = start(app);
  const nextTicket = JSON.parse(Buffer.from(after.ticket.split(".")[0], "base64url").toString());
  assert.equal(nextTicket.day, day + 1);
  assert.notEqual(app.buildRotatingTimedBank_(nextTicket.day).numerical[index][1], before[1]);
  const result = sendJson(app, { action: "submit", ticket: exam.ticket, answers: { [item.id]: String(before[2]) } });
  assert.equal(result.ok, true);
  assert.equal(result.data.correct, 1);
});

test("Philippine midnight rotates the selection in every timed section", { skip: !bankSource }, () => {
  // Hold the shuffle constant to isolate the date's effect on question selection.
  const { app, setTime } = mockAppsScript(() => 0.5);
  for (const level of ["professional", "subprofessional"]) {
    setTime(testTime);
    const before = start(app, level, "full");
    setTime(testTime + 120000);
    const after = start(app, level, "full");
    const sections = new Set(before.questions.map(({ section }) => section));
    for (const section of sections) {
      const ids = (attempt) => attempt.questions.filter((item) => item.section === section).map(({ id }) => id).sort();
      assert.notDeepEqual(ids(before), ids(after), `${level} / ${section}`);
    }
  }
});

test("private daily variants provide distinct items and four different choices", { skip: !bankSource }, () => {
  const { app } = mockAppsScript();
  const firstDay = Math.floor(testTime / 86400000);
  for (let day = firstDay; day < firstDay + 500; day++) {
    for (const [section, items] of Object.entries(app.buildRotatingTimedBank_(day))) {
      const keys = new Set();
      for (const [topic, prompt, ...options] of items) {
        const choices = options.slice(0, 4).map(String).sort();
        const key = JSON.stringify([prompt.trim().toLowerCase(), choices]);
        assert.equal(new Set(choices).size, 4, `${section} / ${topic} / day ${day}`);
        assert.ok(!keys.has(key), `${section} / ${topic} / day ${day}`);
        keys.add(key);
      }
    }
  }
});

test("the expanded private General Information bank supports a fresh full retake", { skip: !bankSource }, () => {
  const { app } = mockAppsScript();
  const exam = start(app, "professional", "full");
  const { day } = JSON.parse(Buffer.from(exam.ticket.split(".")[0], "base64url").toString());
  const general = app.buildRotatingTimedBank_(day).general;
  const original = app.buildExpandedDailyTimedBank_(day).general;
  assert.deepEqual(general.slice(0, original.length), original);
  assert.equal(general.length, 78);
  assert.equal(new Set(general.map(([, prompt]) => prompt.trim().toLowerCase())).size, general.length);
  assert.ok(general.slice(original.length).every((item) => item[7]?.startsWith("https://")));

  const previous = new Set(exam.questions.map(({ id }) => id));
  const retry = sendJson(app, {
    action: "begin", level: "professional", mode: "full", recentQuestionIds: [...previous],
  });
  assert.equal(retry.ok, true);
  const questions = retry.data.questions.filter(({ section }) => section === "general");
  assert.equal(questions.length, 32);
  assert.ok(questions.every(({ id }) => !previous.has(id)));

  const indexOf = ({ id }) => Number(id.split("-")[1]);
  const { data: attemptWithNewItem } = sendJson(app, {
    action: "begin", level: "professional", mode: "quick",
    recentQuestionIds: original.map((_, index) => `general-${index}`),
  });
  const item = attemptWithNewItem.questions.find((question) =>
    question.section === "general" && indexOf(question) >= original.length);
  assert.ok(item);
  const result = sendJson(app, {
    action: "submit", ticket: attemptWithNewItem.ticket,
    answers: { [item.id]: String(general[indexOf(item)][2]) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.correct, 1);
});

test("timed exams issued with either previous daily bank can still be submitted", () => {
  const { app } = mockAppsScript();
  const day = Math.floor((testTime + 8 * 60 * 60000) / 86400000);
  const general = app.buildExpandedDailyTimedBank_(day).general;
  for (const [version, section, index, item] of [
    [app.PREVIOUS_DAILY_EXAM_BANK_VERSION, "numerical", 0, app.buildDailyTimedBank_(day).numerical[0]],
    [app.EXPANDED_DAILY_EXAM_BANK_VERSION, "general", general.length - 1, general.at(-1)],
  ]) {
    const encoded = Buffer.from(JSON.stringify({
      id: randomUUID(), level: "professional", mode: "quick", ids: [[section, index]], day,
      start: testTime, deadline: testTime + 1500000, version,
    })).toString("base64url");
    const result = sendJson(app, {
      action: "submit", ticket: encoded + "." + app.signExam_(encoded),
      answers: { [`${section}-${index}`]: String(item[2]) },
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.correct, 1);
  }
});

test("timed exams issued before the daily rotation rollout can still be submitted", () => {
  const { app } = mockAppsScript();
  const encoded = Buffer.from(JSON.stringify({
    id: randomUUID(), level: "professional", mode: "quick", ids: [["numerical", 0]],
    start: testTime, deadline: testTime + 1500000, version: app.TIMED_EXAM_BANK_VERSION,
  })).toString("base64url");
  const result = sendJson(app, {
    action: "submit", ticket: encoded + "." + app.signExam_(encoded),
    answers: { "numerical-0": String(app.TIMED_EXAM_BANK.numerical[0][2]) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.correct, 1);
});

test("rejects forged tickets, invalid answers, and the previous unsigned score format", () => {
  const { app, rows } = mockAppsScript();
  const exam = start(app);
  const submission = { action: "submit", ticket: exam.ticket, answers: {} };
  assert.equal(send(app, { ...submission, ticket: "x" + exam.ticket }).ok, false);
  assert.equal(send(app, { ...submission, answers: { [exam.questions[0].id]: "invalid" } }).ok, false);
  assert.equal(send(app, { ...submission, answers: { "not-assigned": "invalid" } }).ok, false);
  assert.equal(send(app, { id: exam.id, correct: 20, total: 20 }).ok, false);
  assert.equal(rows.length, 1);
});

test("requests without the transport field still get JSON and never an HTML receipt", () => {
  const { app } = mockAppsScript();
  const response = app.doPost({ parameter: { submission: JSON.stringify({
    action: "leaderboard", level: "professional", mode: "quick", token: randomUUID(), origin: "</script>",
  }) } });
  assert.equal(response.mimeType, "application/json");
  assert.deepEqual(JSON.parse(response.content), { ok: true, data: { scores: [] } });
  assert.equal(JSON.parse(app.doPost({ parameter: { submission: "{" } }).content).ok, false);
});

test("submissions past the grace period are saved as late and kept off the leaderboard", () => {
  const { app, rows, setTime } = mockAppsScript();
  const onTime = start(app);
  const late = start(app);
  setTime(onTime.deadline + 60000);
  const first = send(app, { action: "submit", ticket: onTime.ticket, name: "On time", publishName: true, answers: {} });
  assert.equal(first.data.late, false);
  setTime(late.deadline + 3 * 60000);
  const second = send(app, { action: "submit", ticket: late.ticket, name: "Too late", publishName: true, answers: {} });
  assert.equal(second.ok, true);
  assert.equal(second.data.late, true);
  assert.ok(Object.keys(second.data.solutions).length > 0);
  assert.equal(second.data.elapsedSeconds, 25 * 60);
  assert.equal(rows[0][10], "Submitted late");
  assert.equal(rows[2][2], "Too late");
  assert.equal(rows[2][9], "");
  assert.equal(rows[2][10], "Yes");

  // Retrying the on-time attempt after the grace period keeps its original status.
  const retry = send(app, { action: "submit", ticket: onTime.ticket, name: "On time", publishName: true, answers: {} });
  assert.equal(retry.data.late, false);
  const board = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.deepEqual(board.data.scores.map(({ displayName }) => displayName), ["On time"]);
});

test("name remains optional and formula-like values are stored as text", () => {
  const { app, rows } = mockAppsScript();
  const first = start(app);
  assert.equal(send(app, { action: "submit", ticket: first.ticket, answers: {}, name: "  " }).ok, true);
  const second = start(app);
  assert.equal(send(app, { action: "submit", ticket: second.ticket, answers: {}, name: "=SUM(1,2)" }).ok, true);
  assert.equal(rows[1][2], "Anonymous");
  assert.equal(rows[2][2], "'=SUM(1,2)");
});

test("leaderboard returns the top five for one format without exposing private names or attempt data", () => {
  const { app, rows } = mockAppsScript();
  rows.push(
    ["id-a", new Date(), "Private A", "Professional", "Quick practice", 12, 20, 60, 1000],
    ["id-b", new Date(), "Private B", "Professional", "Quick practice", 17, 20, 85, 1100, "'Shared alias"],
    ["id-c", new Date(), "Private C", "Professional", "Quick practice", 18, 20, 90, 1200],
    ["id-d", new Date(), "Private D", "Professional", "Quick practice", 13, 20, 65, 1300],
    ["id-e", new Date(), "Private E", "Professional", "Quick practice", 14, 20, 70, 1400],
    ["id-f", new Date(), "Private F", "Professional", "Quick practice", 15, 20, 75, 1500],
    ["id-g", new Date(), "Other level", "Subprofessional", "Quick practice", 20, 20, 100, 150],
    ["id-h", new Date(), "Other mode", "Professional", "Full mock exam", 150, 150, 100, 150],
    ["id-i", new Date(), "Invalid total", "Professional", "Quick practice", 30, 30, 100, 150],
  );
  const result = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.scores.map(({ correct }) => correct), [18, 17, 15, 14, 13]);
  assert.deepEqual(result.data.scores.map(({ displayName }) => displayName),
    ["Anonymous", "Shared alias", "Anonymous", "Anonymous", "Anonymous"]);
  for (const item of result.data.scores) assert.deepEqual(Object.keys(item).sort(), ["correct", "displayName", "percentage", "total"]);
});

test("setup adds the late, hide and away columns next to the public name", () => {
  const { rows } = mockAppsScript();
  assert.deepEqual(Array.from(rows[0].slice(9)),
    ["Public display name", "Submitted late", "Hide from leaderboard", "Times left exam page", "Seconds away"]);
});

test("away counts are saved, reported, and keep a score off the leaderboard past either limit", () => {
  const { app, rows, setTime } = mockAppsScript();
  const submit = (name, away) => {
    const exam = start(app);
    setTime(exam.start + 10 * 60000);
    return send(app, { action: "submit", ticket: exam.ticket, name, publishName: true, answers: {}, ...(away && { away }) });
  };
  const steady = submit("Steady");
  const brief = submit("Brief", { leaves: AWAY_LEAVE_LIMIT - 1, awaySeconds: AWAY_SECONDS_LIMIT });
  const often = submit("Often", { leaves: AWAY_LEAVE_LIMIT, awaySeconds: 5 });
  const long = submit("Long", { leaves: 1, awaySeconds: AWAY_SECONDS_LIMIT + 1 });
  const forged = submit("Forged", { leaves: -4, awaySeconds: "lots" });
  assert.deepEqual([steady, brief, often, long, forged].map(({ data }) => data.awayFlagged), [false, false, true, true, false]);
  assert.deepEqual(steady.data.away, { leaves: 0, awaySeconds: 0 });
  assert.deepEqual(often.data.away, { leaves: AWAY_LEAVE_LIMIT, awaySeconds: 5 });
  const oftenRow = rows.find((row) => row[2] === "Often");
  assert.deepEqual(Array.from(oftenRow.slice(12, 14)), [AWAY_LEAVE_LIMIT, 5]);
  assert.equal(rows.find((row) => row[2] === "Steady").length, 11);

  const board = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.deepEqual(board.data.scores.map(({ displayName }) => displayName).sort(), ["Brief", "Forged", "Steady"]);
});

test("a retry reports the away counts first saved for that attempt", () => {
  const { app, setTime } = mockAppsScript();
  const exam = start(app);
  setTime(exam.start + 10 * 60000);
  send(app, { action: "submit", ticket: exam.ticket, answers: {}, away: { leaves: 4, awaySeconds: 20 } });
  const retry = send(app, { action: "submit", ticket: exam.ticket, answers: {}, away: { leaves: 0, awaySeconds: 0 } });
  assert.deepEqual(retry.data.away, { leaves: 4, awaySeconds: 20 });
  assert.equal(retry.data.awayFlagged, true);
});

test("the organizer can hide a score, and implausibly fast scores are never listed", () => {
  const { app, rows } = mockAppsScript();
  rows.push(
    ["id-real", new Date(), "Real", "Professional", "Quick practice", 15, 20, 75, 900, "'Real"],
    ["id-hidden", new Date(), "Hidden", "Professional", "Quick practice", 20, 20, 100, 900, "'Hidden", "", "Yes"],
    ["id-checkbox", new Date(), "Checkbox", "Professional", "Quick practice", 19, 20, 95, 900, "'Checkbox", "", true],
    ["id-fast", new Date(), "Fast", "Professional", "Quick practice", 20, 20, 100, 299, "'Fast"],
    ["id-floor", new Date(), "Floor", "Professional", "Quick practice", 14, 20, 70, 300, "'Floor"],
  );
  const result = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.deepEqual(result.data.scores.map(({ displayName }) => displayName), ["Real", "Floor"]);
});

test("submit reports when a score is too fast for the leaderboard", () => {
  const { app, setTime } = mockAppsScript();
  const quick = start(app);
  const steady = start(app);
  assert.equal(send(app, { action: "submit", ticket: quick.ticket, answers: {} }).data.tooFast, true);
  setTime(steady.start + 5 * 60000);
  assert.equal(send(app, { action: "submit", ticket: steady.ticket, answers: {} }).data.tooFast, false);
});

test("leaderboard ties rank the faster attempt first", () => {
  const { app, rows } = mockAppsScript();
  rows.push(
    ["id-slow", new Date(), "Slow", "Professional", "Quick practice", 18, 20, 90, 1400, "'Slow"],
    ["id-fast", new Date(), "Fast", "Professional", "Quick practice", 18, 20, 90, 600, "'Fast"],
  );
  const result = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.deepEqual(result.data.scores.map(({ displayName }) => displayName), ["Fast", "Slow"]);
});

test("only scores explicitly opting in get a public display name", () => {
  const { app, rows, setTime } = mockAppsScript();
  // Simulate a sheet created before the optional columns were introduced.
  rows[0].length = 9;
  const anonymous = start(app);
  const visible = start(app);
  setTime(visible.start + 10 * 60000);
  assert.equal(sendJson(app, { action: "submit", ticket: anonymous.ticket, name: "Private name", answers: {} }).ok, true);
  assert.equal(sendJson(app, { action: "submit", ticket: visible.ticket, name: "Public name", publishName: true, answers: {} }).ok, true);
  assert.equal(rows[0][9], "Public display name");
  const result = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.deepEqual(result.data.scores.map(({ displayName }) => displayName), ["Anonymous", "Public name"]);
});

test("the browser and Apps Script use the same minimum time per question and away limits", () => {
  assert.match(script, new RegExp(`const MIN_SECONDS_PER_ITEM = ${MIN_SECONDS_PER_ITEM};`));
  assert.match(script, new RegExp(`const AWAY_LEAVE_LIMIT = ${AWAY_LEAVE_LIMIT};`));
  assert.match(script, new RegExp(`const AWAY_SECONDS_LIMIT = ${AWAY_SECONDS_LIMIT};`));
});
