import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, RotateCcw } from "lucide-react";
import { grade, SECTIONS, STUDY_LENGTH, studyPool, studyTopics } from "../lib/exam.js";

export function StudySetup({ begin }) {
  const [section, setSection] = useState("verbal");
  const [topic, setTopic] = useState("");
  const count = Math.min(STUDY_LENGTH, studyPool(section, topic).length);
  return (
    <section className="panel setup-panel" aria-labelledby="study-title">
      <h2 id="study-title">Study by topic</h2>
      <p className="section-intro">Answer at your own pace and see an explanation after each question.</p>
      <form onSubmit={(event) => { event.preventDefault(); begin(section, topic); }}>
        <label className="field-label" htmlFor="study-section">Subject</label>
        <select className="study-select" id="study-section" value={section}
          onChange={(event) => { setSection(event.target.value); setTopic(""); }}>
          {Object.entries(SECTIONS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        <label className="field-label study-topic-label" htmlFor="study-topic">Topic</label>
        <select className="study-select" id="study-topic" value={topic} onChange={(event) => setTopic(event.target.value)}>
          <option value="">All topics</option>
          {studyTopics(section).map((value) => <option key={value}>{value}</option>)}
        </select>
        <button className="button primary start-button" type="submit">
          Start study session <ArrowRight size={19} />
        </button>
        <p className="privacy">{count} {count === 1 ? "question" : "questions"} · No time limit · Score history on this device</p>
      </form>
    </section>
  );
}

export function StudySession({ attempt, onComplete, onExit }) {
  const [questions, setQuestions] = useState(attempt.questions);
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState({});
  const [summary, setSummary] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [saved, setSaved] = useState(null);
  const heading = useRef(null);
  const item = questions[position];
  const answer = answers[item.id];
  const answered = answer !== undefined;
  const label = attempt.topic || SECTIONS[attempt.section];

  useEffect(() => { heading.current?.focus(); }, [position, summary]);

  function advance() {
    if (!answered) return;
    if (position < questions.length - 1) {
      setPosition(position + 1);
      return;
    }
    const result = grade(questions, answers);
    setSummary(result);
    if (!retrying) setSaved(onComplete(result));
  }

  function retryMissed() {
    setQuestions(questions.filter((question) => answers[question.id] !== question.correct));
    setPosition(0);
    setAnswers({});
    setSummary(null);
    setRetrying(true);
  }

  if (summary) {
    return (
      <section className="panel result-hero study-result">
        <div>
          <span className="section-icon"><Check size={22} /></span>
          <h1 ref={heading} tabIndex={-1}>{retrying ? "Review complete" : "Study session complete"}</h1>
          <p>{label} · {summary.correct} of {summary.total} correct</p>
          {!retrying && <p className="save-status" role="status">{saved
            ? "Score added to your history on this device."
            : "Your browser could not save this score to local history."}</p>}
          <div className="study-actions">
            <button className="button secondary" type="button" onClick={onExit}><ArrowLeft size={17} /> Back to practice</button>
            {summary.correct < summary.total && <button className="button primary" type="button" onClick={retryMissed}>
              <RotateCcw size={17} /> Retry missed questions
            </button>}
          </div>
        </div>
        <div className="score-number"><strong>{summary.percentage}%</strong><small>{retrying ? "Review score" : "Study score"}</small></div>
      </section>
    );
  }

  return (
    <div className="study-session">
      <div className="session-heading">
        <div><button className="text-button" type="button" onClick={onExit}><ArrowLeft size={16} /> Back to practice</button>
          <h1>{label}</h1><p>{retrying ? "Review missed questions" : "Study mode"} · No time limit</p></div>
        <span className="section-icon"><BookOpen size={21} /></span>
      </div>
      <progress className="exam-progress" value={Object.keys(answers).length} max={questions.length} aria-label="Questions answered" />
      <section className="panel question-panel" aria-labelledby="study-question">
        <div className="question-meta">{SECTIONS[item.section]} · {item.topic}</div>
        <h2 id="study-question" ref={heading} tabIndex={-1}>Question {position + 1} of {questions.length}</h2>
        <p className="prompt" id="study-prompt">{item.prompt}</p>
        <div className="answer-list" role="radiogroup" aria-labelledby="study-prompt">
          {item.options.map((option, index) => (
            <label key={option} className="answer-option" data-correct={answered && option === item.correct ? true : undefined}
              data-incorrect={answered && answer === option && option !== item.correct ? true : undefined}>
              <input type="radio" name={item.id} checked={answer === option} disabled={answered}
                onChange={() => setAnswers((previous) => ({ ...previous, [item.id]: option }))} />
              <span><b>{String.fromCharCode(65 + index)}</b>{option}</span>
            </label>
          ))}
        </div>
        {answered && <div className="study-feedback" role="status">
          <strong>{answer === item.correct ? "Correct" : `Correct answer: ${item.correct}`}</strong>
          <p>{item.explanation}</p>
          {item.source && <a className="source-link" href={item.source} target="_blank" rel="noreferrer">Read the source <ArrowUpRight size={14} /></a>}
        </div>}
        <div className="question-actions study-next">
          <button className="button primary" type="button" disabled={!answered} onClick={advance}>
            {position === questions.length - 1 ? "See study results" : "Next question"} <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
