import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { LEVELS } from "../lib/exam.js";
import { requestExam } from "../lib/scores.js";

export default function Leaderboard({ initialLevel = "professional", initialMode = "full" }) {
  const [level, setLevel] = useState(initialLevel);
  const [mode, setMode] = useState(initialMode);
  const [requestCount, setRequestCount] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = `${level}/${mode}/${requestCount}`;
  const current = result?.key === requestKey ? result : null;

  useEffect(() => {
    let active = true;
    requestExam({ action: "leaderboard", level, mode }).then(
      ({ scores }) => { if (active) setResult({ key: requestKey, scores }); },
      () => { if (active) setResult({ key: requestKey, failed: true }); },
    );
    return () => { active = false; };
  }, [level, mode, requestKey]);

  return (
    <section className="panel leaderboard" id="leaderboard" aria-labelledby="leaderboard-title">
      <div className="coverage-heading">
        <span className="section-icon"><Trophy size={20} aria-hidden="true" /></span>
        <h2 id="leaderboard-title">Top 5 scores</h2>
      </div>
      <div className="leaderboard-filters">
        <label>Level
          <select className="study-select" value={level} onChange={(event) => setLevel(event.target.value)}>
            {Object.entries(LEVELS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <label>Mode
          <select className="study-select" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="full">Full mock exam</option>
            <option value="quick">Quick practice</option>
          </select>
        </label>
      </div>
      {!current && <p className="section-intro" role="status">Loading top scores…</p>}
      {current?.failed && <p className="section-intro" role="status">Top scores are unavailable.{" "}
        <button type="button" className="text-button" onClick={() => setRequestCount((count) => count + 1)}>Retry</button>
      </p>}
      {current?.scores?.length === 0 && <p className="section-intro" role="status">No scores yet for this format.</p>}
      {current?.scores?.length > 0 && (
        <ol className="leaderboard-list">
          {current.scores.map(({ displayName, correct, total, percentage }, index) => (
            <li key={index}>
              <span className="leaderboard-rank" aria-hidden="true">{index + 1}</span>
              <strong className="leaderboard-name">{displayName}</strong>
              <span className="leaderboard-score"><strong>{percentage}%</strong><small>{correct} / {total}</small></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
