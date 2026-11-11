export const DRAFT_KEY = "csc-reviewer:timed-attempt:v2";
export const HISTORY_KEY = "csc-reviewer:score-history:v1";

function read(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readDraft() {
  const draft = read(DRAFT_KEY, null);
  if (!draft?.id || typeof draft.ticket !== "string" || !Number.isFinite(draft.deadline) || !Array.isArray(draft.questions) ||
      !draft.progress?.answers || !Array.isArray(draft.progress.marked) ||
      !draft.questions[draft.progress.position]) return null;
  return draft;
}

export function createDraft(attempt) {
  const { name: _name, ...anonymousAttempt } = attempt;
  return write(DRAFT_KEY, { ...anonymousAttempt, progress: { answers: {}, marked: [], position: 0 } });
}

export function saveProgress(id, progress) {
  const draft = readDraft();
  return draft?.id === id && write(DRAFT_KEY, { ...draft, progress });
}

export function clearDraft(id) {
  if (readDraft()?.id === id) write(DRAFT_KEY, null);
}

export function readHistory() {
  const history = read(HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export function recordScore(attempt, result) {
  const entry = {
    id: attempt.id,
    date: Date.now(),
    mode: attempt.mode,
    level: attempt.level,
    section: attempt.section,
    topic: attempt.topic,
    correct: result.correct,
    total: result.total,
    percentage: result.percentage,
    sections: result.sections,
  };
  const previous = readHistory();
  if (previous.some(({ id }) => id === entry.id)) return { history: previous, saved: true };
  const history = [entry, ...previous].slice(0, 30);
  return { history, saved: write(HISTORY_KEY, history) };
}
