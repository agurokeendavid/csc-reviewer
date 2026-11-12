import { generalGroups } from "./questions/general.js";
import { makeAnalytical, makeClerical, makeNumerical } from "./questions/skills.js";
import { verbal } from "./questions/verbal.js";

export const CSC_GUIDE = "https://csc.gov.ph/examination-advisories/exam-advisory-no2s2026";

export const SECTIONS = {
  verbal: "Verbal Ability",
  numerical: "Numerical Ability",
  analytical: "Analytical Ability",
  clerical: "Clerical Ability",
  general: "General Information",
};

export const LEVELS = {
  professional: {
    label: "Professional",
    specialty: "analytical",
    minutes: 190,
    length: 150,
    sections: { verbal: 43, numerical: 37, analytical: 38, general: 32 },
  },
  subprofessional: {
    label: "Subprofessional",
    specialty: "clerical",
    minutes: 160,
    length: 145,
    sections: { verbal: 42, numerical: 35, clerical: 38, general: 30 },
  },
};

export const QUICK_MODE = { minutes: 25, length: 20 };
// Apps Script switches the timed question set at midnight in Manila (UTC+8, no daylight saving).
const MANILA_OFFSET_MS = 8 * 60 * 60000;
const DAY_MS = 86400000;

export function nextQuestionRefresh(now = Date.now()) {
  return (Math.floor((now + MANILA_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - MANILA_OFFSET_MS;
}

export function countdownLabel(milliseconds) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

// Must match MIN_SECONDS_PER_ITEM in google-apps-script/Code.gs.
export const MIN_SECONDS_PER_ITEM = 15;
export const STUDY_LENGTH = 10;

function question(section, index, item, source) {
  const [topic, prompt, correct, wrongA, wrongB, wrongC, explanation] = item;
  return {
    id: `${section}-${index}`,
    section,
    topic,
    prompt,
    correct: String(correct),
    options: [correct, wrongA, wrongB, wrongC].map(String),
    explanation,
    source,
  };
}

export const BANK = {
  verbal: verbal.map((item, index) => question("verbal", index, item)),
  numerical: makeNumerical().map((item, index) => question("numerical", index, item)),
  analytical: makeAnalytical().map((item, index) => question("analytical", index, item)),
  clerical: makeClerical().map((item, index) => question("clerical", index, item)),
  general: generalGroups
    .flatMap(({ topic, source, items }) => items.map((item) => ({ item: [topic, ...item], source })))
    .map(({ item, source }, index) => question("general", index, item, source)),
};

export function shuffle(values, random = Math.random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleSection(items, count, random) {
  if (items.length < count) throw new Error("The question bank is too small for this exam.");
  const topics = new Map();
  for (const item of shuffle(items, random)) {
    if (!topics.has(item.topic)) topics.set(item.topic, []);
    topics.get(item.topic).push(item);
  }

  const selected = [];
  while (selected.length < count) {
    for (const bucket of topics.values()) {
      if (bucket.length) selected.push(bucket.pop());
      if (selected.length === count) break;
    }
  }
  return shuffle(selected, random);
}

export function makeExam(level, mode, random = Math.random) {
  const sections = Object.entries(LEVELS[level].sections);
  return sections.flatMap(([section, count]) =>
    sampleSection(BANK[section], mode === "quick" ? 5 : count, random).map((item) => ({
      ...item,
      options: shuffle(item.options, random),
    })),
  );
}

const FILIPINO_TOPICS = new Set([
  "Kahulugan ng salita", "Pag-aayos ng talata", "Pag-unawa sa binasa",
  "Pagbuo ng pangungusap", "Pagkilala sa mali",
]);

export function studyTopics(section) {
  const topics = [...new Set(BANK[section].map((item) => item.topic))].sort();
  if (section === "verbal") return ["English", "Filipino", ...topics];
  return topics;
}

export function studyPool(section, topic) {
  if (!topic) return BANK[section];
  if (section === "verbal" && (topic === "English" || topic === "Filipino")) {
    return BANK.verbal.filter((item) => FILIPINO_TOPICS.has(item.topic) === (topic === "Filipino"));
  }
  return BANK[section].filter((item) => item.topic === topic);
}

export function makeStudy(section, topic, random = Math.random) {
  const items = studyPool(section, topic);
  return sampleSection(items, Math.min(items.length, STUDY_LENGTH), random).map((item) => ({
    ...item,
    options: shuffle(item.options, random),
  }));
}

export function weakestSection(sections) {
  return Object.entries(sections).reduce((weakest, [key, score]) => {
    if (score.correct === score.total) return weakest;
    const ratio = score.correct / score.total;
    return !weakest || ratio < weakest.ratio ? { key, ratio } : weakest;
  }, null)?.key;
}

export function grade(questions, answers) {
  const sections = {};
  let correct = 0;
  let answered = 0;
  for (const item of questions) {
    const section = sections[item.section] ??= { correct: 0, total: 0 };
    section.total += 1;
    if (answers[item.id] !== undefined) answered += 1;
    if (answers[item.id] === item.correct) {
      correct += 1;
      section.correct += 1;
    }
  }
  return {
    correct,
    answered,
    total: questions.length,
    percentage: Math.round(10000 * correct / questions.length) / 100,
    sections,
  };
}

export function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)} hr${remainder ? ` ${remainder} min` : ""}`;
}

export function clockLabel(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
