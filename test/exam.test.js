import assert from "node:assert/strict";
import { test } from "node:test";
import { BANK, clockLabel, grade, LEVELS, makeExam, QUICK_MODE } from "../lib/exam.js";

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
