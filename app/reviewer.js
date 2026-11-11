"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, BriefcaseBusiness,
  Calculator, Check, ChevronRight, ClipboardCheck, Clock3, FileText, GraduationCap,
  Landmark, ListChecks, LockKeyhole, RotateCcw, Timer, UserRound, Workflow, Zap,
} from "lucide-react";
import { clockLabel, CSC_GUIDE, durationLabel, grade, LEVELS, makeExam, QUICK_MODE, SECTIONS } from "../lib/exam.js";
import { saveScore, scoreStorageReady } from "../lib/scores.js";

const COVERAGE = {
  verbal: [BookOpen, "English and Filipino comprehension, vocabulary, and grammar"],
  numerical: [Calculator, "Basic operations, sequences, and word problems"],
  analytical: [Workflow, "Logic, analogies, assumptions, and data interpretation"],
  clerical: [FileText, "Alphabetical filing and spelling"],
  general: [Landmark, "Constitution, public ethics, human rights, and the environment"],
};

function Setup({ begin }) {
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
          <h1 id="hero-title">Civil Service<br />Mock Exam<span className="hero-period">.</span></h1>
          <p>Practice under timed conditions, then review your answers and see where to focus next.</p>
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

      <div className="setup-grid">
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
            <button className="button primary start-button" type="submit">Start practice <ArrowRight size={19} /></button>
            <p className="privacy"><LockKeyhole size={14} aria-hidden="true" />{scoreStorageReady
              ? "Your score and the name you enter are saved to the organizer’s private Google Sheet. Blank names are saved as Anonymous."
              : "Practice mode is available. Score saving is turned off until Google Sheets is connected."}</p>
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
      </div>
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

function Exam({ attempt, onFinish, onQuit }) {
  const { questions, deadline, level } = attempt;
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(new Set());
  const [position, setPosition] = useState(0);
  const [remaining, setRemaining] = useState(deadline - Date.now());
  const [confirmation, setConfirmation] = useState("");
  const finished = useRef(false);
  const heading = useRef(null);
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
    if (finished.current) return;
    finished.current = true;
    onFinish(answers, timedOut || Date.now() >= deadline);
  }, [answers, deadline, onFinish]);

  useEffect(() => {
    if (remaining <= 0) finish(true);
  }, [remaining, finish]);

  useEffect(() => {
    heading.current?.focus();
  }, [position]);

  useEffect(() => {
    const preventLoss = (event) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, []);

  function goTo(index) {
    setPosition(index);
  }

  function toggleMark() {
    setMarked((previous) => {
      const next = new Set(previous);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  return (
    <>
      <div className="session-heading">
        <div><button type="button" className="text-button" onClick={() => setConfirmation("quit")}><ArrowLeft size={16} /> Exit practice</button>
          <h1>{attempt.mode === "full" ? "Full mock exam" : "Quick practice"}</h1>
          <p>{LEVELS[level].label} · {answeredCount} of {questions.length} answered</p></div>
        <div className={remaining < 60000 ? "timer timer-urgent" : "timer"} aria-label={`Time remaining ${clockLabel(remaining)}`}>
          <Clock3 size={21} /> <span><small>Time remaining</small><strong>{clockLabel(remaining)}</strong></span>
        </div>
      </div>
      <progress className="exam-progress" value={answeredCount} max={questions.length} aria-label="Questions answered" />
      <div className="session-grid">
        <section className="panel question-panel" aria-labelledby="question-heading">
          <div className="question-meta"><span>{SECTIONS[item.section]} · {item.topic}</span>
            <button type="button" className="text-button mark-button" aria-pressed={marked.has(item.id)} onClick={toggleMark}>
              <Bookmark size={17} fill={marked.has(item.id) ? "currentColor" : "none"} /> {marked.has(item.id) ? "Marked" : "Mark for review"}
            </button>
          </div>
          <h2 id="question-heading" tabIndex={-1} ref={heading}>Question {position + 1} of {questions.length}</h2>
          <p className="prompt" id="question-prompt">{item.prompt}</p>
          <div className="answer-list" role="radiogroup" aria-labelledby="question-prompt">
            {item.options.map((option, index) => (
              <label key={option} className="answer-option">
                <input type="radio" name={item.id} checked={answers[item.id] === option}
                  onChange={() => {
                    if (Date.now() >= deadline) { finish(true); return; }
                    setAnswers((current) => ({ ...current, [item.id]: option }));
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
        </section>
        <aside className="panel navigator">
          <h2>Question navigator</h2>
          <p className="section-intro">Jump to any question.</p>
          <div className="numbers">
            {questions.map((question, index) => (
              <button type="button" key={question.id} aria-current={index === position ? "step" : undefined}
                aria-label={`Question ${index + 1}${answers[question.id] !== undefined ? ", answered" : ", unanswered"}${marked.has(question.id) ? ", marked" : ""}`}
                className={`${answers[question.id] !== undefined ? "answered " : ""}${marked.has(question.id) ? "marked" : ""}`}
                onClick={() => goTo(index)}>{index + 1}</button>
            ))}
          </div>
          <div className="legend"><span><i /> Answered</span><span><i /> Marked</span></div>
          <button className="button secondary navigator-submit" type="button" onClick={() => setConfirmation("submit")}>Submit exam <ChevronRight size={17} /></button>
        </aside>
      </div>
      {confirmation && (
        <Confirmation kind={confirmation} unanswered={questions.length - answeredCount}
          onClose={() => setConfirmation("")} onConfirm={confirmation === "submit" ? () => finish() : onQuit} />
      )}
    </>
  );
}

function Confirmation({ kind, unanswered, onClose, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const submitting = kind === "submit";
  return (
    <dialog className="confirmation" ref={dialog} onCancel={onClose} aria-labelledby="confirm-title">
      <h2 id="confirm-title">{submitting ? "Submit your exam?" : "Exit this practice?"}</h2>
      <p>{submitting
        ? unanswered ? `You have ${unanswered} unanswered ${unanswered === 1 ? "question" : "questions"}. Blank answers count as incorrect.` : "Your answers are ready to grade."
        : "Exiting ends this attempt and clears your answers."}</p>
      <div className="question-actions"><button type="button" autoFocus className="button secondary" onClick={onClose}>Keep practicing</button>
        <button type="button" className="button primary" onClick={onConfirm}>{submitting ? "Submit exam" : "Exit practice"}</button></div>
    </dialog>
  );
}

function Results({ attempt, result, storage, retry, reset }) {
  const [filter, setFilter] = useState("all");
  const items = attempt.questions.map((question, index) => ({ question, index }));
  const visible = filter === "all" ? items : items.filter(({ question }) => result.answers[question.id] !== question.correct);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <>
      <section className="panel result-hero">
        <div>
          <span className="section-icon"><ClipboardCheck size={22} /></span>
          <h1 ref={heading} tabIndex={-1}>Your practice results</h1>
          <p>{attempt.name} · {LEVELS[attempt.level].label} · {attempt.mode === "full" ? "Full mock exam" : "Quick practice"}</p>
          <p>{result.timedOut ? "Time expired. " : ""}{result.correct} correct · {result.answered} answered · {clockLabel(result.elapsedSeconds * 1000)} elapsed</p>
          <div className="save-status" role="status">
            {storage === "off" && "Google Sheets is disconnected. This score was not saved."}
            {storage === "saving" && "Saving score to Google Sheets…"}
            {storage === "saved" && <><Check size={17} /> Saved to Google Sheets</>}
            {storage === "error" && <>Google Sheets did not confirm the save. <button type="button" className="text-button" onClick={retry}>Retry save</button></>}
          </div>
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
          {Object.entries(result.sections).map(([key, value]) => (
            <div key={key}><span><strong>{SECTIONS[key]}</strong><small>{value.correct} / {value.total}</small></span>
              <progress value={value.correct} max={value.total} aria-label={SECTIONS[key]} /></div>
          ))}
          <button className="button secondary" type="button" disabled={storage === "saving"} onClick={reset}><RotateCcw size={17} /> New practice</button>
        </aside>
      </div>
    </>
  );
}

export default function Reviewer() {
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [storage, setStorage] = useState("off");

  function begin(name, level, mode) {
    const questions = makeExam(level, mode);
    const start = Date.now();
    const duration = (mode === "full" ? LEVELS[level].minutes : QUICK_MODE.minutes) * 60000;
    setAttempt({ id: crypto.randomUUID(), name, level, mode, questions, start, deadline: start + duration });
    window.scrollTo(0, 0);
  }

  function persist(completed) {
    if (!scoreStorageReady) return;
    setStorage("saving");
    saveScore({
      id: attempt.id, name: attempt.name, level: attempt.level, mode: attempt.mode,
      correct: completed.correct, total: completed.total, elapsedSeconds: completed.elapsedSeconds,
    }).then(() => setStorage("saved"), () => setStorage("error"));
  }

  function finish(answers, timedOut) {
    const end = timedOut ? attempt.deadline : Math.min(Date.now(), attempt.deadline);
    const elapsedSeconds = Math.max(0, Math.floor((end - attempt.start) / 1000));
    const completed = { ...grade(attempt.questions, answers), answers, elapsedSeconds, timedOut };
    setResult(completed);
    persist(completed);
    window.scrollTo(0, 0);
  }

  function reset() {
    setAttempt(null);
    setResult(null);
    setStorage("off");
    window.scrollTo(0, 0);
  }

  return (
    <>
      <header className="site-header"><div className="shell header-inner">
        <div className="brand"><span><BookOpen size={21} strokeWidth={2.3} /></span> CSC Reviewer <b>PH</b></div>
        {attempt
          ? <span className="header-link"><span className="status-dot" /> {result ? "Practice complete" : "Practice in progress"}</span>
          : <a className="header-link" href="#coverage">Exam coverage <ArrowDownRight size={15} /></a>}
      </div></header>
      <main className="shell">
        {!attempt && <Setup begin={begin} />}
        {attempt && !result && <Exam attempt={attempt} onFinish={finish} onQuit={reset} />}
        {result && <Results attempt={attempt} result={result} storage={storage} retry={() => persist(result)} reset={reset} />}
      </main>
      <footer className="shell site-footer"><p>Unofficial Philippine Civil Service Exam reviewer · Original practice questions</p>
        <a href={CSC_GUIDE} target="_blank" rel="noreferrer">Official exam scope <ArrowUpRight size={14} /></a></footer>
    </>
  );
}
