import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { BANK } from "../lib/exam.js";

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

function mockAppsScript(random = Math.random) {
  const rows = [];
  const notes = new Map();
  const properties = new Map();
  let locked = false;
  let now = testTime;
  const sheet = {
    appendRow: (values) => rows.push(values),
    getLastRow: () => rows.length,
    setFrozenRows: () => {},
    setColumnWidth: () => {},
    getRange: (row, column, height = 1, width = 1) => ({
      setBackground() { return this; },
      setFontColor() { return this; },
      setFontWeight() { return this; },
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
  const spreadsheet = { getSheetByName: () => sheet, getId: () => "test-spreadsheet" };
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
    HtmlService: {
      createHtmlOutput: (html) => ({ setXFrameOptionsMode: () => html }),
      XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
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
  return { app, rows, setTime: (time) => { now = time; } };
}

function send(app, fields) {
  const token = randomUUID();
  const origin = "https://reviewer.example";
  const html = app.doPost({ parameter: { submission: JSON.stringify({ token, origin, ...fields }) } });
  if (typeof html !== "string") return html.content;
  const code = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  if (!code) return html;
  let receipt;
  runInNewContext(code, { window: { top: { postMessage(data, target) {
    assert.equal(data.token, token);
    assert.equal(target, origin);
    receipt = data;
  } } } });
  return receipt;
}

function sendJson(app, fields) {
  const response = app.doPost({ parameter: { transport: "json", submission: JSON.stringify(fields) } });
  assert.equal(response.mimeType, "application/json");
  return JSON.parse(response.content);
}

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
  assert.equal(send(app, { ...submission, origin: "</script>" }), "Invalid receipt destination.");
  assert.equal(rows.length, 1);
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
    ["id-a", new Date(), "Private A", "Professional", "Quick practice", 12, 20, 60, 100],
    ["id-b", new Date(), "Private B", "Professional", "Quick practice", 17, 20, 85, 110, "'Shared alias"],
    ["id-c", new Date(), "Private C", "Professional", "Quick practice", 18, 20, 90, 120],
    ["id-d", new Date(), "Private D", "Professional", "Quick practice", 13, 20, 65, 130],
    ["id-e", new Date(), "Private E", "Professional", "Quick practice", 14, 20, 70, 140],
    ["id-f", new Date(), "Private F", "Professional", "Quick practice", 15, 20, 75, 150],
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

test("only scores explicitly opting in get a public display name", () => {
  const { app, rows } = mockAppsScript();
  // Simulate a sheet created before the public-name column was introduced.
  rows[0].pop();
  const anonymous = start(app);
  const visible = start(app);
  assert.equal(sendJson(app, { action: "submit", ticket: anonymous.ticket, name: "Private name", answers: {} }).ok, true);
  assert.equal(sendJson(app, { action: "submit", ticket: visible.ticket, name: "Public name", publishName: true, answers: {} }).ok, true);
  assert.equal(rows[0][9], "Public display name");
  const result = sendJson(app, { action: "leaderboard", level: "professional", mode: "quick" });
  assert.deepEqual(result.data.scores.map(({ displayName }) => displayName), ["Anonymous", "Public name"]);
});
