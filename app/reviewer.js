"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, BriefcaseBusiness,
  Calculator, Check, ChevronRight, ClipboardCheck, Clock3, FileText, GraduationCap,
  Landmark, ListChecks, LockKeyhole, RotateCcw, Timer, UserRound, Workflow, Zap,
} from "lucide-react";
import { clockLabel, CSC_GUIDE, durationLabel, LEVELS, makeStudy, QUICK_MODE, SECTIONS, weakestSection } from "../lib/exam.js";
import { requestExam, scoreStorageReady } from "../lib/scores.js";
import { clearDraft, createDraft, readDraft, readHistory, recordScore, saveProgress } from "../lib/practice-storage.js";
import ScoreHistory from "./score-history.js";
import { StudySession, StudySetup } from "./study.js";

const COVERAGE = {
  verbal: [BookOpen, "English and Filipino comprehension, vocabulary, and grammar"],
  numerical: [Calculator, "Basic operations, sequences, and word problems"],
  analytical: [Workflow, "Logic, analogies, assumptions, and data interpretation"],
  clerical: [FileText, "Alphabetical filing and spelling"],
  general: [Landmark, "Constitution, public ethics, human rights, and the environment"],
};

function ResumeCard({ draft, resume, discard }) {
  const [name, setName] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const count = Object.keys(draft.progress.answers).length;
  const label = draft.mode === "full" ? "Full mock exam" : "Quick practice";
  return (
    <section className="panel resume-panel" aria-labelledby="resume-title">
      <div className="coverage-heading"><span className="section-icon"><Clock3 size={20} /></span>
        <div><h2 id="resume-title">Continue your timed exam</h2>
          <p className="section-intro">{LEVELS[draft.level].label} · {label} · {count} of {draft.questions.length} answered</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); resume(draft, name.trim() || "Anonymous"); }}>
        <label className="field-label" htmlFor="resume-name">Name for your score (optional)</label>
        <div className="resume-actions">
          <input className="study-select" id="resume-name" value={name} maxLength={80}
            pattern="\s*(?:\S.*\S)?\s*" autoComplete="off" placeholder="Leave blank for Anonymous"
            onChange={(event) => setName(event.target.value)} />
          <button className="button primary" type="submit">Resume exam <ArrowRight size={17} /></button>
          <button className="text-button" type="button" onClick={() => setConfirmDiscard(true)}>Discard exam</button>
        </div>
        <p className="privacy">The original timer keeps running. If time has expired, resuming opens your results.</p>
      </form>
      {confirmDiscard && <Confirmation kind="discard" onClose={() => setConfirmDiscard(false)} onConfirm={() => discard(draft.id)} />}
    </section>
  );
}

function Setup({ begin, beginStudy, draft, resume, discard, ready, opening, startError }) {
  const [path, setPath] = useState(scoreStorageReady ? "timed" : "study");
  const [name, setName] = useState("");
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
    begin(displayName || "Anonymous", level, mode);
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="hero-kicker"><span /> 2026 CSE-PPT practice</span>
          <h1 id="hero-title">Civil Service<br />Exam Practice<span className="hero-period">.</span></h1>
          <p>Build confidence one topic at a time, or practice under exam conditions.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          <div className="paper-back" />
          <div className="paper">
            <div className="paper-heading"><ListChecks size={23} /><span /></div>
            {[0, 1, 2].map((row) => (
              <div className="paper-row" key={row}><span className={row < 2 ? "paper-check checked" : "paper-check"}>{row < 2 && <Check size={11} strokeWidth={3} />}</span><span className="paper-line" /></div>
            ))}
          </div>
          <div className="art-check"><Check size={27} strokeWidth={3} /></div>
          <ArrowDownRight className="art-arrow" size={28} strokeWidth={1.5} />
          <span className="art-dot" />
        </div>
      </section>

      {draft && <ResumeCard key={draft.id} draft={draft} resume={resume} discard={discard} />}
      <fieldset className="practice-path">
        <legend className="visually-hidden">How do you want to practice?</legend>
        <div className="choices">
          <Choice name="path" value="timed" selected={path} select={setPath} icon={Timer}
            title="Take a timed mock" detail="Full mock exam or quick practice" />
          <Choice name="path" value="study" selected={path} select={setPath} icon={BookOpen}
            title="Study by topic" detail="Immediate explanations and no timer" />
        </div>
      </fieldset>
      {path === "study" ? <StudySetup begin={beginStudy} /> : <div className="setup-grid">
        <section className="panel setup-panel" aria-labelledby="setup-title">
          <h2 id="setup-title">Set up your exam</h2>
          <p className="section-intro">Choose your level and how long you want to practice.</p>
          <form onSubmit={start}>
            <label className="field-label" htmlFor="name">Your name (optional)</label>
            <div className="name-field"><UserRound size={18} aria-hidden="true" /><input
              id="name" name="name" value={name} maxLength={80} autoComplete="off"
              placeholder="Leave blank to take the exam anonymously" aria-describedby={error ? "name-error" : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(event) => { setName(event.target.value); setError(""); }}
            /></div>
            {error && <p className="form-error" id="name-error" role="alert">{error}</p>}
            <fieldset>
              <legend>Exam level</legend>
              <div className="choices">
                {Object.entries(LEVELS).map(([key, value]) => (
                  <Choice key={key} name="level" value={key} selected={level} select={setLevel}
                    icon={key === "professional" ? GraduationCap : BriefcaseBusiness}
                    title={value.label} detail={SECTIONS[value.specialty]} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Practice mode</legend>
              <div className="choices">
                <Choice name="mode" value="full" selected={mode} select={setMode} icon={ClipboardCheck}
                  title="Full mock exam" detail={`${activeLevel.length} questions · ${durationLabel(activeLevel.minutes)}`} />
                <Choice name="mode" value="quick" selected={mode} select={setMode} icon={Zap}
                  title="Quick practice" detail="20 questions · 25 min" />
              </div>
            </fieldset>
            <button className="button primary start-button" type="submit" disabled={!ready || opening || Boolean(draft) || !scoreStorageReady}>
              {opening ? "Loading your exam…" : "Start practice"} <ArrowRight size={19} />
            </button>
            {startError && <p className="form-error" role="alert">{startError}</p>}
            {draft && <p className="privacy">Resume or discard your saved exam to start a new timed attempt.</p>}
            <p className="privacy"><LockKeyhole size={14} aria-hidden="true" />{scoreStorageReady
              ? "Your score and the name you enter are saved to the organizer’s private Google Sheet. Blank names are saved as Anonymous."
              : "Timed exams require the secure Apps Script deployment. Study Mode is available."}</p>
          </form>
        </section>
        <section className="panel coverage-panel" id="coverage" aria-labelledby="coverage-title">
          <div className="coverage-heading"><span className="section-icon"><BookOpen size={20} /></span><h2 id="coverage-title">Exam coverage</h2></div>
          <p className="section-intro">{activeLevel.label} level</p>
          <ul className="coverage-list">
            {Object.keys(activeLevel.sections).map((key) => {
              const [Icon, detail] = COVERAGE[key];
              return <li key={key}><Icon size={19} aria-hidden="true" /><div><strong>{SECTIONS[key]}</strong><p>{detail}</p></div></li>;
            })}
          </ul>
          <div className="duration-card">
            <Timer size={19} aria-hidden="true" /><span><strong>{durationLabel(activeMode.minutes)}</strong><small>Time limit</small></span>
            <span className="duration-divider" />
            <ListChecks size={19} aria-hidden="true" /><span><strong>{activeMode.length} items</strong><small>Scored questions</small></span>
          </div>
          <a className="source-link" href={CSC_GUIDE} target="_blank" rel="noreferrer">2026 CSC exam advisory <ArrowUpRight size={15} /></a>
        </section>
      </div>}
    </>
  );
}

function Choice({ name, value, selected, select, icon: Icon, title, detail }) {
  return (
    <label className="choice">
      <input type="radio" name={name} value={value} checked={selected === value} onChange={() => select(value)} />
      <span className="choice-content"><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small>{detail}</small></span><span className="radio-dot" /></span>
    </label>
  );
}

function Exam({ attempt, onFinish, onQuit, submitting, submitError }) {
  const { questions, deadline, level } = attempt;
  const [progress, setProgress] = useState(attempt.progress);
  const [saved, setSaved] = useState(attempt.saved);
  const [showQuestions, setShowQuestions] = useState(false);
  const { answers, marked, position } = progress;
  const [remaining, setRemaining] = useState(deadline - Date.now());
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

  function toggleMark() {
    updateProgress({ marked: marked.includes(item.id) ? marked.filter((id) => id !== item.id) : [...marked, item.id] });
  }

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
          <div className={remaining < 60000 ? "timer timer-urgent" : "timer"} aria-label={`Time remaining ${clockLabel(remaining)}`}>
            <Clock3 size={21} /> <span><small>Time remaining</small><strong>{clockLabel(remaining)}</strong></span>
          </div>
          <button type="button" className="button secondary questions-toggle" aria-expanded={showQuestions}
            aria-controls="exam-navigator" onClick={() => setShowQuestions(!showQuestions)}>
            <ListChecks size={17} /> Questions
          </button>
        </div>
        <progress className="exam-progress" value={answeredCount} max={questions.length} aria-label="Questions answered" />
      </div>
      {!saved && <p className="save-warning" role="status">This attempt could not be saved on this device. Keep this tab open to finish it.</p>}
      {submitError && <div className="save-warning" role="alert">{submitError}{" "}
        <button className="text-button" type="button" onClick={() => finish()}>Retry submission</button>
      </div>}
      <div className="session-grid">
        <section className="panel question-panel" aria-labelledby="question-heading">
          <div className="question-meta"><span>{SECTIONS[item.section]} · {item.topic}</span>
            <button type="button" className="text-button mark-button" aria-pressed={marked.includes(item.id)} onClick={toggleMark}>
              <Bookmark size={17} fill={marked.includes(item.id) ? "currentColor" : "none"} /> {marked.includes(item.id) ? "Marked" : "Mark for review"}
            </button>
          </div>
          <h2 id="question-heading" tabIndex={-1} ref={heading}>Question {position + 1} of {questions.length}</h2>
          <p className="prompt" id="question-prompt">{item.prompt}</p>
          <div className="answer-list" role="radiogroup" aria-labelledby="question-prompt">
            {item.options.map((option, index) => (
              <label key={option} className="answer-option">
                <input type="radio" name={item.id} checked={answers[item.id] === option} disabled={Boolean(submission.current)}
                  onChange={() => {
                    if (Date.now() >= deadline) { finish(true); return; }
                    updateProgress({ answers: { ...answers, [item.id]: option } });
                  }} />
                <span><b>{String.fromCharCode(65 + index)}</b>{option}</span>
              </label>
            ))}
          </div>
          <div className="question-actions">
            <button className="button secondary" type="button" disabled={position === 0} onClick={() => goTo(position - 1)}><ArrowLeft size={17} /> Previous</button>
            {position < questions.length - 1
              ? <button className="button primary" type="button" onClick={() => goTo(position + 1)}>Next <ArrowRight size={17} /></button>
              : <button className="button primary" type="button" onClick={() => setConfirmation("submit")}>Submit exam <ArrowRight size={17} /></button>}
          </div>
          {position < questions.length - 1 && <button className="text-button mobile-submit" type="button"
            onClick={() => setConfirmation("submit")}>Submit exam</button>}
        </section>
        <aside id="exam-navigator" className={`panel navigator${showQuestions ? " navigator-open" : ""}`}>
          <h2 ref={navigatorHeading} tabIndex={-1}>Question navigator</h2>
          <p className="section-intro">Jump to any question.</p>
          <div className="numbers">
            {questions.map((question, index) => (
              <button type="button" key={question.id} aria-current={index === position ? "step" : undefined}
                aria-label={`Question ${index + 1}${answers[question.id] !== undefined ? ", answered" : ", unanswered"}${marked.includes(question.id) ? ", marked" : ""}`}
                className={`${answers[question.id] !== undefined ? "answered " : ""}${marked.includes(question.id) ? "marked" : ""}`}
                onClick={() => goTo(index)}>{index + 1}</button>
            ))}
          </div>
          <div className="legend"><span><i /> Answered</span><span><i /> Marked</span></div>
          <button className="button secondary navigator-submit" type="button" onClick={() => setConfirmation("submit")}>Submit exam <ChevronRight size={17} /></button>
        </aside>
      </div>
      {submitting ? <SubmissionLoader /> : confirmation && (
        <Confirmation kind={confirmation} unanswered={questions.length - answeredCount} saved={saved}
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
      <div className="submission-spinner" aria-hidden="true" />
      <h2 id="submission-title">Submitting your exam</h2>
      <p role="status">Grading your answers and saving your score…</p>
    </dialog>
  );
}

function Confirmation({ kind, unanswered, saved, onClose, onConfirm }) {
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
          <span className="section-icon"><ClipboardCheck size={22} /></span>
          <h1 ref={heading} tabIndex={-1}>Your practice results</h1>
          <p>{attempt.name} · {LEVELS[attempt.level].label} · {attempt.mode === "full" ? "Full mock exam" : "Quick practice"}</p>
          <p>{result.timedOut ? "Time expired. " : ""}{result.correct} correct · {result.answered} answered · {clockLabel(result.elapsedSeconds * 1000)} elapsed</p>
          <div className="save-status" role="status"><Check size={17} /> Saved to Google Sheets</div>
          {!savedLocally && <p className="save-warning">Your browser could not save this score to local history.</p>}
        </div>
        <div className="score-number"><strong>{result.percentage}%</strong><small>Practice score</small></div>
      </section>
      <div className="session-grid results-grid">
        <section className="panel review-panel" aria-labelledby="review-heading">
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
              <summary><span>Question {index + 1} <small>{SECTIONS[question.section]}</small></span>
                <span className={correct ? "answer-state good" : "answer-state"}>{correct ? "Correct" : answer === undefined ? "Blank" : "Incorrect"}</span></summary>
              <div className="review-body"><p className="review-prompt">{question.prompt}</p>
                <p><strong>Your answer</strong> {answer ?? "Unanswered"}</p>
                <p><strong>Correct answer</strong> {question.correct}</p>
                <p>{question.explanation}</p>
                {question.source && <a className="source-link" href={question.source} target="_blank" rel="noreferrer">{question.topic} source <ArrowUpRight size={14} /></a>}</div>
            </details>;
          })}
        </section>
        <aside className="panel breakdown"><h2>Section scores</h2>
          {focusSection && <section className="focus-section">
            <p>Lowest-scoring section</p>
            <strong>{SECTIONS[focusSection]}</strong>
            <button className="button primary" type="button" onClick={() => beginStudy(focusSection, "")}>
              Practice this topic <ArrowRight size={17} />
            </button>
          </section>}
          {Object.entries(result.sections).map(([key, value]) => (
            <div key={key}><span><strong>{SECTIONS[key]}</strong><small>{value.correct} / {value.total}</small></span>
              <progress value={value.correct} max={value.total} aria-label={SECTIONS[key]} /></div>
          ))}
          <button className="button secondary" type="button" onClick={reset}><RotateCcw size={17} /> New practice</button>
        </aside>
      </div>
    </>
  );
}

export default function Reviewer() {
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [opening, setOpening] = useState(false);
  const [startError, setStartError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [savedLocally, setSavedLocally] = useState(true);
  const activeRequest = useRef(null);

  useEffect(() => {
    function sync() {
      setDraft(readDraft());
      setHistory(readHistory());
    }
    sync();
    setReady(true);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  async function begin(name, level, mode) {
    const existing = readDraft();
    if (existing) { setDraft(existing); return; }
    const request = {};
    activeRequest.current = request;
    setOpening(true);
    setStartError("");
    try {
      const exam = await requestExam({ action: "begin", level, mode });
      if (activeRequest.current !== request) return;
      const next = { ...exam, name, level, mode };
      const saved = createDraft(next);
      setAttempt({ ...next, saved, progress: { answers: {}, marked: [], position: 0 } });
      window.scrollTo(0, 0);
    } catch (error) {
      if (activeRequest.current === request) setStartError(error.message);
    } finally {
      if (activeRequest.current === request) setOpening(false);
    }
  }

  function resume(saved, name) {
    const current = readDraft();
    if (current?.id !== saved.id) { setDraft(current); return; }
    setAttempt({ ...current, saved: true, name });
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
      const { solutions, ...score } = await requestExam({ action: "submit", ticket: attempt.ticket, name: attempt.name, answers });
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
        <a className="brand" href="/" aria-label="CSC Reviewer PH home" onClick={goHome}>
          <span><BookOpen size={21} strokeWidth={2.3} aria-hidden="true" /></span> CSC Reviewer <b>PH</b>
        </a>
        {attempt
          ? <span className="header-link"><span className="status-dot" /> {result ? "Practice complete" : "Practice in progress"}</span>
          : <a className="header-link" href="#history">Score history <ArrowDownRight size={15} /></a>}
      </div></header>
      <main className="shell">
        {!attempt && <>
          <Setup begin={begin} beginStudy={beginStudy} draft={draft} resume={resume} discard={discard}
            ready={ready} opening={opening} startError={startError} />
          <ScoreHistory entries={history} ready={ready} />
        </>}
        {attempt?.mode === "study" && <StudySession key={attempt.id} attempt={attempt} onComplete={addHistory} onExit={reset} />}
        {attempt && attempt.mode !== "study" && !result && <Exam attempt={attempt} onFinish={finish} onQuit={reset}
          submitting={submitting} submitError={submitError} />}
        {result && <Results attempt={attempt} result={result} savedLocally={savedLocally} reset={reset} beginStudy={beginStudy} />}
      </main>
      <footer className="shell site-footer"><p>Unofficial Philippine Civil Service Exam reviewer · Original practice questions</p>
        <p>Created by Keen David Aguro</p>
        <a href={CSC_GUIDE} target="_blank" rel="noreferrer">Official exam scope <ArrowUpRight size={14} /></a></footer>
    </>
  );
}
