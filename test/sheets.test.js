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
const fixture = existsSync(privateBank)
  ? runInNewContext(`${readFileSync(privateBank, "utf8")}\nTIMED_EXAM_BANK`, {})
  : publicFixture;

function mockAppsScript() {
  const rows = [];
  const notes = new Map();
  const properties = new Map();
  let locked = false;
  const sheet = {
    appendRow: (values) => rows.push(values),
    getLastRow: () => rows.length,
    setFrozenRows: () => {},
    setColumnWidth: () => {},
    getRange: (row, column) => ({
      setBackground() { return this; },
      setFontColor() { return this; },
      setFontWeight() { return this; },
      getValues: () => [rows[row - 1]],
      getValue: () => rows[row - 1][column - 1],
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
    TIMED_EXAM_BANK: fixture,
    TIMED_EXAM_BANK_VERSION: "test",
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
    ContentService: { createTextOutput: (content) => content },
    HtmlService: {
      createHtmlOutput: (html) => ({ setXFrameOptionsMode: () => html }),
      XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
    },
    console: { error() {} },
  };
  const app = runInNewContext(`${script}\n({ setup, doPost })`, globals);
  app.setup();
  app.setup();
  return { app, rows };
}

function send(app, fields) {
  const token = randomUUID();
  const origin = "https://reviewer.example";
  const html = app.doPost({ parameter: { submission: JSON.stringify({ token, origin, ...fields }) } });
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
    for (const item of exam.questions) {
      assert.deepEqual(Object.keys(item).sort(), ["id", "options", "prompt", "section", "topic"]);
    }
    const decoded = JSON.parse(Buffer.from(exam.ticket.split(".")[0], "base64url").toString());
    assert.deepEqual(Object.keys(decoded).sort(), ["deadline", "id", "ids", "level", "mode", "start", "version"]);
  }
  assert.equal(rows.length, 1);
});

test("the server grades assigned options, reveals solutions after saving, and accepts identical retries", () => {
  const { app, rows } = mockAppsScript();
  const exam = start(app);
  const [first] = exam.questions;
  const correct = fixture.verbal[Number(first.id.split("-")[1])][2];
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
