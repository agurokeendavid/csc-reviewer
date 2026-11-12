import { LEVELS, SECTIONS } from "../lib/exam.js";

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

function sameFormat(first, second) {
  return first.mode === second.mode && first.level === second.level &&
    first.section === second.section && first.topic === second.topic;
}

function attemptLabel(entry) {
  if (entry.mode === "study") return `Study: ${entry.topic || SECTIONS[entry.section]}`;
  return `${LEVELS[entry.level].label}, ${entry.mode === "full" ? "full mock" : "quick practice"}`;
}

function changeLabel(score, previous) {
  if (!previous) return "";
  const difference = Number((100 * (score.correct / score.total - previous.correct / previous.total)).toFixed(1));
  if (difference === 0) return "No change";
  return difference > 0 ? `Up ${difference} pp` : `Down ${Math.abs(difference)} pp`;
}

export default function ScoreHistory({ entries, ready }) {
  return (
    <section className="panel history-panel" id="history" aria-labelledby="history-title">
      <h2 id="history-title">Your history</h2>
      <p className="section-intro">Your last 30 scores, saved in this browser only. Open one to compare subjects with your previous try.</p>
      {ready && entries.length === 0 && <p className="history-empty">Nothing yet. Your scores will show up here after you finish an exam or study session.</p>}
      {entries.map((entry, index) => {
        const previous = entries.slice(index + 1).find((older) => sameFormat(entry, older));
        return (
          <details className="review-item history-entry" key={entry.id}>
            <summary><span>{attemptLabel(entry)} <small>{dateFormat.format(entry.date)}</small></span>
              <strong>{entry.percentage}%</strong></summary>
            <div className="history-breakdown">
              {previous && <p>Change from your previous try in the same format, in percentage points.</p>}
              <ul>
                {Object.entries(entry.sections).map(([key, score]) => (
                  <li key={key}><span>{SECTIONS[key]}</span><strong>{score.correct} / {score.total}</strong>
                    <small>{changeLabel(score, previous?.sections[key])}</small></li>
                ))}
              </ul>
            </div>
          </details>
        );
      })}
    </section>
  );
}
