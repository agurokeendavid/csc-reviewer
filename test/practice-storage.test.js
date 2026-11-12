import assert from "node:assert/strict";
import { test } from "node:test";
import { grade, makeExam, makeStudy, weakestSection } from "../lib/exam.js";
import { clearDraft, createDraft, readDraft, readHistory, readRecentQuestionIds, recordScore, saveProgress } from "../lib/practice-storage.js";

test("timed drafts preserve question order, answers, flags, and deadline without the name", (t) => {
  const storage = new Map();
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } };
  t.after(() => { globalThis.window = originalWindow; });

  const questions = makeExam("professional", "quick");
  const attempt = { id: "attempt-one", ticket: "signed-ticket", name: "Examinee name", publishName: true, level: "professional", mode: "quick", questions, start: 0, deadline: 1500000 };
  const first = questions[0];
  const progress = { answers: { [first.id]: first.correct }, marked: [first.id], position: 3 };
  assert.equal(createDraft(attempt), true);
  assert.equal(saveProgress(attempt.id, progress), true);
  const draft = readDraft();
  assert.equal(draft.name, undefined);
  assert.equal(draft.publishName, undefined);
  assert.equal(draft.deadline, attempt.deadline);
  assert.deepEqual(draft.progress, progress);
  assert.deepEqual(draft.questions.map(({ id, options }) => ({ id, options })),
    questions.map(({ id, options }) => ({ id, options })));

  const score = grade(questions, progress.answers);
  assert.equal(recordScore(attempt, score).saved, true);
  recordScore(attempt, { ...score, correct: 0 });
  assert.equal(readHistory().length, 1);
  assert.equal(readHistory()[0].correct, 1);
  assert.equal(readHistory()[0].name, undefined);

  clearDraft(attempt.id);
  assert.equal(saveProgress(attempt.id, progress), false);
  assert.equal(readDraft(), null);
  assert.deepEqual(readRecentQuestionIds(), questions.map(({ id }) => id));
});

test("study drills stay within the selected topic and point to the lowest percentage", () => {
  const fractions = makeStudy("numerical", "Fractions");
  assert.equal(fractions.length, 10);
  assert.equal(new Set(fractions.map(({ id }) => id)).size, 10);
  assert.ok(fractions.every(({ section, topic }) => section === "numerical" && topic === "Fractions"));
  assert.ok(makeStudy("verbal", "Filipino").every(({ topic }) => /^Pag|^Kahulugan/.test(topic)));
  assert.equal(weakestSection({ verbal: { correct: 6, total: 10 }, numerical: { correct: 8, total: 20 } }), "numerical");
  assert.equal(weakestSection({ numerical: { correct: 8, total: 8 } }), undefined);
});
