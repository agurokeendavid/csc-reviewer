import assert from "node:assert/strict";
import { test } from "node:test";
import { awayFlagged, BANK, clockLabel, closeAway, countdownLabel, grade, LEVELS, makeExam, nextQuestionRefresh, QUICK_MODE, summarizeAway } from "../lib/exam.js";

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test("the bank has one answer and no duplicate items or options", () => {
  const items = Object.values(BANK).flat();
  const keys = items.map(({ section, prompt, correct }) => JSON.stringify([section, prompt, correct]));
  assert.equal(new Set(keys).size, keys.length);
  for (const item of items) {
    assert.equal(item.options.length, 4, item.id);
    assert.equal(new Set(item.options).size, 4, item.id);
    assert.ok(item.options.includes(item.correct), item.id);
    assert.ok(item.explanation, item.id);
  }
});

for (const [key, level] of Object.entries(LEVELS)) {
  for (const mode of ["full", "quick"]) {
    test(`${key} ${mode} uses the expected section counts and varies across attempts`, () => {
      const items = makeExam(key, mode, seededRandom(1));
      const another = makeExam(key, mode, seededRandom(2));
      assert.equal(items.length, mode === "full" ? level.length : QUICK_MODE.length);
      assert.equal(new Set(items.map(({ id }) => id)).size, items.length);
      const counts = Object.fromEntries(Object.keys(level.sections).map((section) => [
        section, items.filter((item) => item.section === section).length,
      ]));
      assert.deepEqual(counts, mode === "full" ? level.sections : Object.fromEntries(
        Object.keys(level.sections).map((section) => [section, 5])
      ));
      assert.notDeepEqual(items.map(({ id }) => id), another.map(({ id }) => id));
    });
  }
}

test("grading treats blank answers as incorrect and reports each section", () => {
  const items = makeExam("professional", "quick", seededRandom(1));
  const [first, second] = items;
  const result = grade(items, { [first.id]: first.correct, [second.id]: second.options.find((option) => option !== second.correct) });
  assert.equal(result.correct, 1);
  assert.equal(result.answered, 2);
  assert.equal(result.total, 20);
  assert.equal(result.percentage, 5);
  assert.deepEqual(result.sections.verbal, { correct: 1, total: 5 });
  assert.deepEqual(result.sections.analytical, { correct: 0, total: 5 });
  assert.equal(clockLabel(190 * 60000), "03:10:00");
  assert.equal(clockLabel(-1), "00:00:00");
});

test("the next question refresh is the coming midnight in Manila", () => {
  // 11:59 PM on Nov 12 in Manila is 15:59 UTC.
  assert.equal(new Date(nextQuestionRefresh(Date.parse("2026-11-12T15:59:00Z"))).toISOString(), "2026-11-12T16:00:00.000Z");
  // Exactly at midnight, the next refresh is a full day away.
  assert.equal(new Date(nextQuestionRefresh(Date.parse("2026-11-12T16:00:00Z"))).toISOString(), "2026-11-13T16:00:00.000Z");
  assert.equal(new Date(nextQuestionRefresh(Date.parse("2026-11-13T03:00:00Z"))).toISOString(), "2026-11-13T16:00:00.000Z");
});

test("countdown labels round up to whole minutes", () => {
  assert.equal(countdownLabel(30 * 1000), "1 min");
  assert.equal(countdownLabel(59 * 60000), "59 min");
  assert.equal(countdownLabel(60 * 60000), "1 hr");
  assert.equal(countdownLabel(5 * 3600000 + 11.5 * 60000), "5 hr 12 min");
});

test("away tracking ignores blurs under a second and closes an open absence", () => {
  const start = 1_000_000;
  assert.deepEqual(closeAway({ leaves: 1, ms: 4000, since: start }, start + 500), { leaves: 1, ms: 4000, since: null });
  assert.deepEqual(closeAway({ leaves: 1, ms: 4000, since: start }, start + 6000), { leaves: 2, ms: 10000, since: null });
  assert.deepEqual(summarizeAway(undefined, start), { leaves: 0, awaySeconds: 0 });
  assert.deepEqual(summarizeAway({ leaves: 2, ms: 1400, since: start }, start + 2600), { leaves: 3, awaySeconds: 4 });
  assert.equal(awayFlagged({ leaves: 2, awaySeconds: 60 }), false);
  assert.equal(awayFlagged({ leaves: 3, awaySeconds: 0 }), true);
  assert.equal(awayFlagged({ leaves: 1, awaySeconds: 61 }), true);
});
