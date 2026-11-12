"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Github, RotateCcw } from "lucide-react";
import { clockLabel, CSC_GUIDE, durationLabel, LEVELS, makeStudy, MIN_SECONDS_PER_ITEM, QUICK_MODE, SECTIONS, weakestSection } from "../lib/exam.js";
import { requestExam, scoreStorageReady } from "../lib/scores.js";
import { clearDraft, createDraft, readDraft, readHistory, readRecentQuestionIds, recordScore, saveProgress } from "../lib/practice-storage.js";
import ScoreHistory from "./score-history.js";
import Leaderboard from "./leaderboard.js";
import SiteResources from "./site-resources.js";
import ThemeToggle from "./theme-toggle.js";
import DailyNotice from "./daily-notice.js";
import { StudySession, StudySetup } from "./study.js";

const COVERAGE = {
  verbal: "English and Filipino comprehension, vocabulary, and grammar",
  numerical: "Basic operations, sequences, and word problems",
  analytical: "Logic, analogies, assumptions, and data interpretation",
  clerical: "Alphabetical filing and spelling",
  general: "Constitution, public ethics, human rights, and the environment",
};

const LETTERS = ["A", "B", "C", "D"];

// Timed questions come from the private bank, so make them awkward to copy into a search
// or a shared answer key. This only deters casual copying; screenshots still work.
const blockCopy = (event) => event.preventDefault();
const PROTECTED_TEXT = {
  onCopy: blockCopy,
  onCut: blockCopy,
  onDragStart: blockCopy,
  onContextMenu: (event) => { if (!event.target.closest("a, select")) event.preventDefault(); },
};
// A filled-in strip of the answer sheet used on the real paper exam.
const SAMPLE_SHEET = [1, 3, 0, 2, null];

function AnswerSheetSample() {
  return (
    <div className="sheet-sample" aria-hidden="true">
      {SAMPLE_SHEET.map((shaded, row) => (
        <div className="sheet-row" key={row}>
          <span className="sheet-number">{row + 1}</span>
          {LETTERS.map((letter, column) => (
            <span key={letter} className={column === shaded ? "oval shaded" : "oval"}>{letter}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function PublicNameOption({ name, checked, onChange }) {
  const hasName = Boolean(name.trim());
  return (
    <label className="publish-name">
      <input type="checkbox" checked={hasName && checked} disabled={!hasName}
        onChange={(event) => onChange(event.target.checked)} />
      Show my name publicly if my score makes the Top 5
    </label>
  );
}

function ResumeCard({ draft, resume, discard }) {
  const [name, setName] = useState("");
  const [publishName, setPublishName] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const count = Object.keys(draft.progress.answers).length;
  const label = draft.mode === "full" ? "Full mock exam" : "Quick practice";
  return (
    <section className="resume-panel" aria-labelledby="resume-title">
      <h2 id="resume-title">You have an unfinished exam</h2>
      <p className="section-intro">{LEVELS[draft.level].label} {label.toLowerCase()}, {count} of {draft.questions.length} answered.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        resume(draft, name.trim() || "Anonymous", Boolean(name.trim()) && publishName);
      }}>
        <label className="field-label" htmlFor="resume-name">Name for your score (optional)</label>
        <div className="resume-actions">
          <input className="study-select" id="resume-name" value={name} maxLength={80}
            pattern="\s*(?:\S.*\S)?\s*" autoComplete="off" placeholder="Leave blank for Anonymous"
            onChange={(event) => { setName(event.target.value); setPublishName(false); }} />
          <button className="button primary" type="submit">Resume exam <ArrowRight size={17} /></button>
          <button className="text-button" type="button" onClick={() => setConfirmDiscard(true)}>Discard exam</button>
        </div>
        <PublicNameOption name={name} checked={publishName} onChange={setPublishName} />
        <p className="privacy">The original timer keeps running. If time has expired, resuming opens your results.</p>
      </form>
      {confirmDiscard && <Confirmation kind="discard" onClose={() => setConfirmDiscard(false)} onConfirm={() => discard(draft.id)} />}
    </section>
  );
}

function Setup({ begin, beginStudy, draft, resume, discard, ready, opening, startError }) {
  const [path, setPath] = useState(scoreStorageReady ? "timed" : "study");
  const [name, setName] = useState("");
  const [publishName, setPublishName] = useState(false);
  const [level, setLevel] = useState("professional");
  const [mode, setMode] = useState("full");
  const [error, setError] = useState("");
  const activeLevel = LEVELS[level];
  const activeMode = mode === "full" ? activeLevel : QUICK_MODE;

  function start(event) {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName && (displayName.length < 2 || /[\u0000-\u001f\u007f]/.test(displayName))) {
      setError("Enter a name with at least two characters, or leave it blank.");
      return;
    }
    begin(displayName || "Anonymous", level, mode, Boolean(displayName) && publishName);
  }

  return (
    <>
      <section className="intro" aria-labelledby="hero-title">
        <div className="intro-copy">
          <h1 id="hero-title">Practice for the Civil Service Exam</h1>
          <p>Take a timed mock of the 2026 pen-and-paper test, or drill one topic at a time with an explanation after every answer.</p>
        </div>
        <AnswerSheetSample />
      </section>

      {draft && <ResumeCard key={draft.id} draft={draft} resume={resume} discard={discard} />}
      <fieldset className="practice-path">
        <legend className="visually-hidden">How do you want to practice?</legend>
        <div className="tabs">
          <Choice name="path" value="timed" selected={path} select={setPath}
            title="Timed mock exam" detail="Graded when you submit" />
          <Choice name="path" value="study" selected={path} select={setPath}
            title="Study by topic" detail="No timer, answers shown as you go" />
        </div>
      </fieldset>
      {path === "study" ? <StudySetup begin={beginStudy} /> : <div className="setup-grid">
        <section className="panel setup-panel" aria-labelledby="setup-title">
          <h2 id="setup-title">Set up your exam</h2>
          <p className="section-intro">Choose your level and how long you want to practice.</p>
          <form onSubmit={start}>
            <label className="field-label" htmlFor="name">Your name (optional)</label>
            <input className="text-input" id="name" name="name" value={name} maxLength={80} autoComplete="off"
              placeholder="Leave blank to take the exam anonymously" aria-describedby={error ? "name-error" : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(event) => { setName(event.target.value); setPublishName(false); setError(""); }}
            />
            {error && <p className="form-error" id="name-error" role="alert">{error}</p>}
            <PublicNameOption name={name} checked={publishName} onChange={setPublishName} />
            <fieldset>
              <legend>Exam level</legend>
              <div className="choices">
                {Object.entries(LEVELS).map(([key, value]) => (
                  <Choice key={key} name="level" value={key} selected={level} select={setLevel}
                    title={value.label} detail={`Includes ${SECTIONS[value.specialty]}`} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Length</legend>
              <div className="choices">
                <Choice name="mode" value="full" selected={mode} select={setMode}
                  title="Full mock exam" detail={`${activeLevel.length} questions in ${durationLabel(activeLevel.minutes)}`} />
                <Choice name="mode" value="quick" selected={mode} select={setMode}
                  title="Quick practice" detail={`${QUICK_MODE.length} questions in ${QUICK_MODE.minutes} min`} />
              </div>
            </fieldset>
            <button className="button primary start-button" type="submit" disabled={!ready || opening || Boolean(draft) || !scoreStorageReady}>
              {opening ? "Preparing your exam…" : "Start the exam"}
            </button>
            {startError && <p className="form-error" role="alert">{startError}</p>}
            {draft && <p className="privacy">Finish or discard your unfinished exam before starting a new one.</p>}
            <p className="privacy">Timed questions change every day at 12:00 AM Philippine time.</p>
            <p className="privacy">{scoreStorageReady
              ? "Your score and name go to a private Google Sheet kept by the site owner. A blank name is saved as Anonymous."
              : "Timed exams aren’t available right now. You can still study by topic."}</p>
          </form>
        </section>
        <section className="panel coverage-panel" id="coverage" aria-labelledby="coverage-title">
          <h2 id="coverage-title">What’s on the {activeLevel.label} exam</h2>
          <table className="coverage-table">
            <thead><tr><th scope="col">Subject</th><th scope="col">Items</th></tr></thead>
            <tbody>
              {Object.entries(activeLevel.sections).map(([key, count]) => (
                <tr key={key}>
                  <th scope="row"><strong>{SECTIONS[key]}</strong><span>{COVERAGE[key]}</span></th>
                  <td>{mode === "full" ? count : QUICK_MODE.length / Object.keys(activeLevel.sections).length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">Total, {durationLabel(activeMode.minutes)}</th><td>{activeMode.length}</td></tr></tfoot>
          </table>
          <a className="source-link" href={CSC_GUIDE} target="_blank" rel="noreferrer">CSC 2026 exam advisory <ArrowUpRight size={14} aria-hidden="true" /></a>
        </section>
      </div>}
    </>
  );
}

function Choice({ name, value, selected, select, title, detail }) {
  return (
    <label className="choice">
      <input type="radio" name={name} value={value} checked={selected === value} onChange={() => select(value)} />
      <span className="choice-content"><span className="radio-dot" /><span><strong>{title}</strong><small>{detail}</small></span></span>
    </label>
  );
}

function Exam({ attempt, onFinish, onQuit, submitting, submitError }) {
  const { questions, deadline, level } = attempt;
  const [progress, setProgress] = useState(attempt.progress);
  const [saved, setSaved] = useState(attempt.saved);
  const [showQuestions, setShowQuestions] = useState(false);
  const { answers, marked, position } = progress;
  const [remaining, setRemaining] = useState(() => deadline - Date.now());
  // Answers lock once a submission is pending, including after a reload mid-submit.
  const [locked, setLocked] = useState(Boolean(attempt.progress.submission));
  const [confirmation, setConfirmation] = useState("");
  const submission = useRef(attempt.progress.submission
    ? { ...attempt.progress.submission, answers: attempt.progress.answers }
    : null);
  const submissionStarted = useRef(false);
  const heading = useRef(null);
  const navigatorHeading = useRef(null);
  const item = questions[position];
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    function tick() { setRemaining(Math.max(0, deadline - Date.now())); }
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [deadline]);

  const finish = useCallback((timedOut = false) => {
    if (submitting) return;
    if (!submission.current) {
      const status = { timedOut: timedOut || Date.now() >= deadline };
      submission.current = { ...status, answers };
      setLocked(true);
      const pending = { ...progress, submission: status };
      setProgress(pending);
      setSaved(saveProgress(attempt.id, pending));
    }
    submissionStarted.current = true;
    setConfirmation("");
    onFinish(submission.current);
  }, [answers, attempt.id, deadline, onFinish, progress, submitting]);

  useEffect(() => {
    if (!submissionStarted.current && (remaining <= 0 || submission.current)) finish(remaining <= 0);
  }, [remaining, finish]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [position]);

  useEffect(() => {
    if (showQuestions && window.matchMedia("(max-width: 710px)").matches) {
      navigatorHeading.current?.focus({ preventScroll: true });
      navigatorHeading.current?.closest("aside").scrollIntoView({ block: "start" });
    }
  }, [showQuestions]);

  useEffect(() => {
    if (saved) return;
    const preventLoss = (event) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [saved]);

  function updateProgress(changes) {
    const next = { ...progress, ...changes };
    setProgress(next);
    setSaved(saveProgress(attempt.id, next));
  }

  function goTo(index) {
    updateProgress({ position: index });
    setShowQuestions(false);
    window.scrollTo(0, 0);
    if (index === position) heading.current?.focus({ preventScroll: true });
  }

  const markedIndexes = questions.flatMap((question, index) => marked.includes(question.id) ? [index] : []);
  const isMarked = marked.includes(item.id);

  // Cycles through marked questions in order, wrapping back to the first one.
  function goToNextMarked() {
    const next = markedIndexes.find((index) => index > position) ?? markedIndexes[0];
    if (next !== undefined) goTo(next);
  }

  function toggleMark() {
    updateProgress({ marked: marked.includes(item.id) ? marked.filter((id) => id !== item.id) : [...marked, item.id] });
  }

  function choose(option) {
    if (submission.current) return;
    if (Date.now() >= deadline) { finish(true); return; }
    updateProgress({ answers: { ...answers, [item.id]: option } });
  }

  // Letter keys shade an answer, like marking the oval on the paper answer sheet.
  useEffect(() => {
    function shortcut(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || confirmation || submitting) return;
      if (event.target.closest?.("input:not([type=radio]), textarea, select, dialog")) return;
      const index = LETTERS.indexOf(event.key.toUpperCase());
      if (index < 0 || item.options[index] === undefined) return;
      event.preventDefault();
      choose(item.options[index]);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  return (
    <>
      <div className="session-heading">
        <div><button type="button" className="text-button" onClick={() => setConfirmation("quit")}><ArrowLeft size={16} /> Exit practice</button>
          <h1>{attempt.mode === "full" ? "Full mock exam" : "Quick practice"}</h1>
          <p>{LEVELS[level].label}</p></div>
      </div>
      <div className="exam-status">
        <div className="exam-status-row">
          <span className="answered-count"><strong>{answeredCount} / {questions.length}</strong> answered</span>
          <div className={remaining < 300000 ? "timer timer-urgent" : "timer"} role="timer" aria-label={`Time remaining ${clockLabel(remaining)}`}>
            <small>Time left</small><strong>{clockLabel(remaining)}</strong>
          </div>
          <button type="button" className="button secondary questions-toggle" aria-expanded={showQuestions}
            aria-controls="exam-navigator" onClick={() => setShowQuestions(!showQuestions)}>
            All questions
            {markedIndexes.length > 0 && <span className="marked-badge">{markedIndexes.length}<span className="visually-hidden"> marked</span></span>}
          </button>
        </div>
        <progress className="exam-progress" value={answeredCount} max={questions.length} aria-label="Questions answered" />
      </div>
      {!saved && <p className="save-warning" role="status">This attempt could not be saved on this device. Keep this tab open to finish it.</p>}
      {submitError && <div className="save-warning" role="alert">{submitError}{" "}
        <button className="text-button" type="button" onClick={() => finish()}>Retry submission</button>
      </div>}
      <div className="session-grid exam-grid">
        <section className="panel question-panel no-copy" aria-labelledby="question-heading" {...PROTECTED_TEXT}>
          <div className="question-meta"><span>{SECTIONS[item.section]}, {item.topic.toLowerCase()}</span>
            <button type="button" className="mark-button" aria-pressed={isMarked} onClick={toggleMark}>
              <Bookmark size={16} fill={isMarked ? "currentColor" : "none"} aria-hidden="true" /> {isMarked ? "Marked for review" : "Mark for review"}
            </button>
          </div>
          <h2 id="question-heading" tabIndex={-1} ref={heading}><span className="visually-hidden">Question </span>{position + 1}<span className="question-total"> of {questions.length}</span></h2>
          <p className="prompt" id="question-prompt">{item.prompt}</p>
          <div className="answer-list" role="radiogroup" aria-labelledby="question-prompt">
            {item.options.map((option, index) => (
              <label key={option} className="answer-option">
                <input type="radio" name={item.id} checked={answers[item.id] === option} disabled={locked}
                  onChange={() => choose(option)} />
                <span><b className="oval">{LETTERS[index]}</b>{option}</span>
              </label>
            ))}
          </div>
          <p className="shortcut-hint">Press A, B, C or D to answer.</p>
          <div className="question-actions">
            <button className="button secondary" type="button" disabled={position === 0} onClick={() => goTo(position - 1)}><ArrowLeft size={17} /> Previous</button>
            {position < questions.length - 1
              ? <button className="button primary" type="button" onClick={() => goTo(position + 1)}>Next <ArrowRight size={17} /></button>
              : <button className="button primary" type="button" onClick={() => setConfirmation("submit")}>Submit exam</button>}
          </div>
          {position < questions.length - 1 && <button className="text-button mobile-submit" type="button"
            onClick={() => setConfirmation("submit")}>Submit exam</button>}
        </section>
        <aside id="exam-navigator" className={`panel navigator${showQuestions ? " navigator-open" : ""}`}>
          <h2 ref={navigatorHeading} tabIndex={-1}>Answer sheet</h2>
          <p className="section-intro">Select a number to go to that question.</p>
          <div className="numbers">
            {questions.map((question, index) => (
              <button type="button" key={question.id} aria-current={index === position ? "step" : undefined}
                aria-label={`Question ${index + 1}${answers[question.id] !== undefined ? ", answered" : ", unanswered"}${marked.includes(question.id) ? ", marked" : ""}`}
                className={`${answers[question.id] !== undefined ? "answered " : ""}${marked.includes(question.id) ? "marked" : ""}`}
                onClick={() => goTo(index)}>{index + 1}</button>
            ))}
          </div>
          <ul className="legend">
            <li><i className="legend-answered" /> Answered ({answeredCount})</li>
            <li><i className="legend-marked" /> Marked for review ({markedIndexes.length})</li>
            <li><i className="legend-current" /> Current question</li>
          </ul>
          {markedIndexes.length > 0 && <button type="button" className="text-button next-marked" onClick={goToNextMarked}>
            <Bookmark size={15} fill="currentColor" aria-hidden="true" /> Go to next marked question
          </button>}
          <button className="button secondary navigator-submit" type="button" onClick={() => setConfirmation("submit")}>Submit exam</button>
        </aside>
      </div>
      {submitting ? <SubmissionLoader /> : confirmation && (
        <Confirmation kind={confirmation} unanswered={questions.length - answeredCount} markedCount={markedIndexes.length} saved={saved}
          onClose={() => setConfirmation("")} onConfirm={confirmation === "submit" ? () => finish() : onQuit} />
      )}
    </>
  );
}

function SubmissionLoader() {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog className="confirmation submission-loader" ref={dialog}
      onCancel={(event) => event.preventDefault()} aria-labelledby="submission-title">
      <div className="submission-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2 id="submission-title">Submitting your exam</h2>
      <p role="status">Grading your answers and saving your score…</p>
    </dialog>
  );
}

function Confirmation({ kind, unanswered, markedCount = 0, saved, onClose, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const submitting = kind === "submit";
  const discarding = kind === "discard";
  const title = submitting ? "Submit your exam?" : discarding ? "Discard this exam?" : "Exit this practice?";
  const action = submitting ? "Submit exam" : discarding ? "Discard exam" : saved ? "Save and exit" : "Exit practice";
  return (
    <dialog className="confirmation" ref={dialog} onCancel={onClose} aria-labelledby="confirm-title">
      <h2 id="confirm-title">{title}</h2>
      <p>{submitting
        ? unanswered ? `You have ${unanswered} unanswered ${unanswered === 1 ? "question" : "questions"}. Blank answers count as incorrect.` : "Your answers are ready to grade."
        : saved && !discarding ? "Your progress stays on this device. The timer keeps running."
          : "This removes the attempt and its answers."}</p>
      {submitting && markedCount > 0 && <p className="confirm-marked">
        {markedCount} {markedCount === 1 ? "question is" : "questions are"} still marked for review.
      </p>}
      <div className="question-actions"><button type="button" autoFocus className="button secondary" onClick={onClose}>{discarding ? "Keep exam" : "Keep practicing"}</button>
        <button type="button" className="button primary" onClick={onConfirm}>{action}</button></div>
    </dialog>
  );
}

function Results({ attempt, result, reset, beginStudy, savedLocally }) {
  const [filter, setFilter] = useState("all");
  const items = attempt.questions.map((question, index) => ({ question, index }));
  const visible = filter === "all" ? items : items.filter(({ question }) => result.answers[question.id] !== question.correct);
  const heading = useRef(null);
  const focusSection = weakestSection(result.sections);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <>
      <section className="panel result-hero">
        <div>
          <h1 ref={heading} tabIndex={-1}>{result.timedOut ? "Time’s up. Here’s your score" : "Here’s your score"}</h1>
          <p>{attempt.name}, {LEVELS[attempt.level].label} {attempt.mode === "full" ? "full mock exam" : "quick practice"}</p>
          <dl className="result-facts">
            <div><dt>Correct</dt><dd>{result.correct} of {result.total}</dd></div>
            <div><dt>Answered</dt><dd>{result.answered}</dd></div>
            <div><dt>Time used</dt><dd>{clockLabel(result.elapsedSeconds * 1000)}</dd></div>
          </dl>
          <p className="save-status" role="status">Your score was recorded.{scoreStorageReady && <> <a href="#leaderboard">See the top scores</a>.</>}</p>
          {result.late
            ? <p className="save-warning">This exam was submitted after its time limit, so the score won’t appear in Top scores.</p>
            : result.tooFast && <p className="save-warning">This exam was finished in less than {Math.ceil(result.total * MIN_SECONDS_PER_ITEM / 60)} minutes, so the score won’t appear in Top scores.</p>}
          {!savedLocally && <p className="save-warning">This browser couldn’t add the score to your history on this device.</p>}
        </div>
        <div className="score-number"><strong>{result.percentage}%</strong></div>
      </section>
      <div className="session-grid results-grid">
        <section className="panel review-panel no-copy" aria-labelledby="review-heading" {...PROTECTED_TEXT}>
          <div className="review-heading">
            <h2 id="review-heading">Answer review</h2>
            <label className="filter">Show <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All questions</option><option value="missed">Incorrect and blank</option>
            </select></label>
          </div>
          {visible.length === 0 && <p>Every question was answered correctly.</p>}
          {visible.map(({ question, index }) => {
            const answer = result.answers[question.id];
            const correct = answer === question.correct;
            return <details className="review-item" key={question.id}>
              <summary><span>{index + 1}. <small>{SECTIONS[question.section]}</small></span>
                <span className={correct ? "answer-state good" : "answer-state"}>{correct ? "Correct" : answer === undefined ? "Blank" : "Incorrect"}</span></summary>
              <div className="review-body"><p className="review-prompt">{question.prompt}</p>
                <p><strong>Your answer</strong> {answer ?? "Unanswered"}</p>
                <p><strong>Correct answer</strong> {question.correct}</p>
                <p>{question.explanation}</p>
                {question.source && <a className="source-link" href={question.source} target="_blank" rel="noreferrer">Source for this answer <ArrowUpRight size={14} aria-hidden="true" /></a>}</div>
            </details>;
          })}
        </section>
        <aside className="panel breakdown"><h2>By subject</h2>
          {focusSection && <section className="focus-section">
            <p>Your weakest subject was <strong>{SECTIONS[focusSection]}</strong>.</p>
            <button className="button primary" type="button" onClick={() => beginStudy(focusSection, "")}>
              Study {SECTIONS[focusSection]}
            </button>
          </section>}
          {Object.entries(result.sections).map(([key, value]) => (
            <div key={key}><span><strong>{SECTIONS[key]}</strong><small>{value.correct} / {value.total}</small></span>
              <progress value={value.correct} max={value.total} aria-label={SECTIONS[key]} /></div>
          ))}
          <button className="button secondary" type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" /> Start another exam</button>
        </aside>
      </div>
      {scoreStorageReady && <Leaderboard initialLevel={attempt.level} initialMode={attempt.mode} />}
    </>
  );
}

const subscribeToNothing = () => () => {};

export default function Reviewer() {
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [opening, setOpening] = useState(false);
  const [startError, setStartError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  // False during the static prerender and true in the browser, so storage reads never mismatch.
  const ready = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const [savedLocally, setSavedLocally] = useState(true);
  const activeRequest = useRef(null);

  useEffect(() => {
    function sync() {
      setDraft(readDraft());
      setHistory(readHistory());
    }
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  async function begin(name, level, mode, publishName) {
    const existing = readDraft();
    if (existing) { setDraft(existing); return; }
    const request = {};
    activeRequest.current = request;
    setOpening(true);
    setStartError("");
    try {
      const exam = await requestExam({ action: "begin", level, mode, recentQuestionIds: readRecentQuestionIds() });
      if (activeRequest.current !== request) return;
      const next = { ...exam, name, level, mode, publishName };
      const saved = createDraft(next);
      setAttempt({ ...next, saved, progress: { answers: {}, marked: [], position: 0 } });
      window.scrollTo(0, 0);
    } catch (error) {
      if (activeRequest.current === request) setStartError(error.message);
    } finally {
      if (activeRequest.current === request) setOpening(false);
    }
  }

  function resume(saved, name, publishName) {
    const current = readDraft();
    if (current?.id !== saved.id) { setDraft(current); return; }
    setAttempt({ ...current, saved: true, name, publishName });
    window.scrollTo(0, 0);
  }

  function discard(id) {
    clearDraft(id);
    setDraft(readDraft());
  }

  function beginStudy(section, topic) {
    activeRequest.current = null;
    setOpening(false);
    setResult(null);
    setAttempt({ id: crypto.randomUUID(), mode: "study", section, topic, questions: makeStudy(section, topic) });
    window.scrollTo(0, 0);
  }

  function addHistory(completed) {
    const recorded = recordScore(attempt, completed);
    setHistory(recorded.history);
    return recorded.saved;
  }

  async function finish({ answers, timedOut }) {
    if (submitting) return;
    const request = {};
    activeRequest.current = request;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { solutions, ...score } = await requestExam({
        action: "submit", ticket: attempt.ticket, name: attempt.name, publishName: attempt.publishName, answers,
      });
      if (activeRequest.current !== request) return;
      const completed = { ...score, answers, timedOut };
      setSavedLocally(addHistory(completed));
      discard(attempt.id);
      setAttempt({ ...attempt, questions: attempt.questions.map((item) => ({ ...item, ...solutions[item.id] })) });
      setResult(completed);
      window.scrollTo(0, 0);
    } catch (error) {
      if (activeRequest.current === request) setSubmitError(error.message);
    } finally {
      if (activeRequest.current === request) setSubmitting(false);
    }
  }

  function reset() {
    activeRequest.current = null;
    setDraft(readDraft());
    setAttempt(null);
    setResult(null);
    setOpening(false);
    setSubmitting(false);
    setSubmitError("");
    setStartError("");
    window.scrollTo(0, 0);
  }

  function goHome(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.hash) window.history.replaceState(window.history.state, "", "/");
    reset();
  }

  return (
    <>
      <header className="site-header"><div className="shell header-inner">
        <Link className="brand" href="/" onClick={goHome}>CSC Reviewer PH</Link>
        <div className="header-actions">
          {attempt && !result
            ? <span className="header-link">{attempt.mode === "study" ? "Studying" : "Exam in progress"}</span>
            : <nav className="header-nav" aria-label="Main navigation">
              {!result && <>
                {scoreStorageReady && <a className="header-link" href="#leaderboard">Top scores</a>}
                <a className="header-link" href="#history">Your history</a>
              </>}
              <SiteResources />
            </nav>}
          <ThemeToggle />
        </div>
      </div></header>
      <main className="shell">
        {!attempt && <>
          <Setup begin={begin} beginStudy={beginStudy} draft={draft} resume={resume} discard={discard}
            ready={ready} opening={opening} startError={startError} />
          {scoreStorageReady && <Leaderboard />}
          <ScoreHistory entries={history} ready={ready} />
          <DailyNotice />
        </>}
        {attempt?.mode === "study" && <StudySession key={attempt.id} attempt={attempt} onComplete={addHistory} onExit={reset} />}
        {attempt && attempt.mode !== "study" && !result && <Exam attempt={attempt} onFinish={finish} onQuit={reset}
          submitting={submitting} submitError={submitError} />}
        {result && <Results attempt={attempt} result={result} savedLocally={savedLocally} reset={reset} beginStudy={beginStudy} />}
      </main>
      <footer className="shell site-footer">
        <p>An unofficial reviewer, not affiliated with the Civil Service Commission. All questions are original.
          Made by Keen David Aguro.</p>
        <nav className="footer-links" aria-label="Project links">
          <a href="https://github.com/agurokeendavid/csc-reviewer" target="_blank" rel="noreferrer">
            <Github size={14} aria-hidden="true" /> Source code
          </a>
          <a href={CSC_GUIDE} target="_blank" rel="noreferrer">Official exam scope</a>
        </nav>
      </footer>
    </>
  );
}
