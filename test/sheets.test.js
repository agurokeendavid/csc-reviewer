import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");

function mockAppsScript() {
  const rows = [];
  const properties = new Map();
  let locked = false;
  const sheet = {
    appendRow: (values) => rows.push(values),
    getLastRow: () => rows.length,
    setFrozenRows: () => {},
    setColumnWidth: () => {},
    getRange: () => ({
      setBackground() { return this; },
      setFontColor() { return this; },
      setFontWeight() { return this; },
      getValues: () => [rows[0]],
      createTextFinder: (value) => ({
        matchEntireCell() { return this; },
        findNext: () => rows.find(([id]) => id === value),
      }),
    }),
  };
  const spreadsheet = { getSheetByName: () => sheet, getId: () => "test-spreadsheet" };
  const globals = {
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

const attempt = {
  id: "a35f3668-07c1-4d12-8d3a-fb39131c44b7",
  token: "e8c0643e-a014-41c4-893d-d83262c47c62",
  origin: "https://reviewer.example",
  name: "Sample Examinee",
  level: "subprofessional",
  mode: "quick",
  correct: 15,
  total: 20,
  elapsedSeconds: 500,
};

function send(app, overrides) {
  return app.doPost({ parameter: { submission: JSON.stringify({ ...attempt, ...overrides }) } });
}

test("score endpoint acknowledges one Sheet row even when the attempt is retried", () => {
  const { app, rows } = mockAppsScript();
  const receipt = send(app);
  assert.match(receipt, /"ok":true/);
  assert.match(receipt, /"https:\/\/reviewer.example"/);
  assert.ok(!receipt.includes(attempt.name));
  assert.match(send(app, { token: "283dfc37-0227-47fa-90d0-b1f49945ad2f" }), /"ok":true/);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], attempt.id);
  assert.deepEqual(Array.from(rows[1].slice(2)), ["Sample Examinee", "Subprofessional", "Quick practice", 15, 20, 75, 500]);
});

test("invalid totals, elapsed time, and forged receipt destinations are rejected", () => {
  const { app, rows } = mockAppsScript();
  assert.match(send(app, { total: 145 }), /"ok":false/);
  assert.match(send(app, { correct: 21 }), /"ok":false/);
  assert.match(send(app, { elapsedSeconds: 1501 }), /"ok":false/);
  assert.equal(send(app, { origin: "</script>" }), "Invalid receipt destination.");
  assert.equal(rows.length, 1);
});

test("names beginning with a formula character are written as text", () => {
  const { app, rows } = mockAppsScript();
  assert.match(send(app, { name: "=SUM(1,2)" }), /"ok":true/);
  assert.equal(rows[1][2], "'=SUM(1,2)");
});

test("blank and omitted names save as Anonymous", () => {
  const { app, rows } = mockAppsScript();
  assert.match(send(app, { name: "  " }), /"ok":true/);
  assert.match(send(app, { id: "17d3b2e7-124e-4270-a311-c34f6e02f615", name: undefined }), /"ok":true/);
  assert.equal(rows[1][2], "Anonymous");
  assert.equal(rows[2][2], "Anonymous");
  assert.match(send(app, { name: { invalid: true } }), /"ok":false/);
  assert.equal(rows.length, 3);
});
