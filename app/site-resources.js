"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { CSC_GUIDE } from "../lib/exam.js";
import { generalGroups } from "../lib/questions/general.js";
import { requestExam, scoreStorageReady } from "../lib/scores.js";

const references = [
  { source: CSC_GUIDE, sourceTitle: "Civil Service Commission exam coverage and format" },
  ...generalGroups,
];
const MAX_FEEDBACK_LENGTH = 2000;

function FeedbackForm({ onClose, status, setStatus }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef(null);
  const pending = status === "pending";

  async function submit(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content || pending) return;
    if (request.current?.message !== content) {
      request.current = { action: "feedback", id: crypto.randomUUID(), message: content };
    }
    setStatus("pending");
    setError("");
    try {
      await requestExam(request.current);
      setStatus("saved");
    } catch (failure) {
      setError(failure.message);
      setStatus("idle");
    }
  }

  if (status === "saved") return (
    <>
      <p role="status">Thanks. Your feedback was sent to the site owner.</p>
      <div className="question-actions"><button type="button" className="button primary" onClick={onClose}>Done</button></div>
    </>
  );

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <p id="feedback-hint">Share a suggestion or report a problem. Your message goes to the site owner.</p>
      <label className="field-label feedback-label" htmlFor="feedback-message">Your feedback</label>
      <textarea id="feedback-message" className="feedback-message" value={message}
        onChange={(event) => setMessage(event.target.value)} maxLength={MAX_FEEDBACK_LENGTH}
        rows={5} required readOnly={pending} aria-describedby="feedback-hint" />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!scoreStorageReady && <p role="status">Feedback is currently unavailable.</p>}
      <div className="question-actions">
        <button type="button" className="button secondary" disabled={pending} onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary" disabled={pending || !message.trim() || !scoreStorageReady}>
          {pending ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </form>
  );
}

function ResourceDialog({ menu, onClose }) {
  const dialog = useRef(null);
  const [status, setStatus] = useState("idle");
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const feedback = menu === "feedback";

  return (
    <dialog ref={dialog} className="confirmation resource-dialog" aria-labelledby="resource-title"
      onCancel={(event) => {
        event.preventDefault();
        if (status !== "pending") onClose();
      }}>
      <h2 id="resource-title">{feedback ? "Feedback" : "References"}</h2>
      {feedback ? <FeedbackForm onClose={onClose} status={status} setStatus={setStatus} /> : (
        <>
          <p>We use the CSC exam scope to choose topics and these references to verify the answers to our General Information questions.</p>
          <ul className="reference-list">
            {references.map(({ source, sourceTitle }) => (
              <li key={source}>
                <a className="source-link" href={source} target="_blank" rel="noreferrer">
                  {sourceTitle} <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <div className="question-actions"><button type="button" className="button secondary" onClick={onClose}>Close</button></div>
        </>
      )}
    </dialog>
  );
}

export default function SiteResources() {
  const [menu, setMenu] = useState(null);
  return (
    <>
      <button type="button" className="header-link resource-link" aria-haspopup="dialog"
        onClick={() => setMenu("feedback")}>Feedback</button>
      <button type="button" className="header-link resource-link" aria-haspopup="dialog"
        onClick={() => setMenu("references")}>References</button>
      {menu && <ResourceDialog menu={menu} onClose={() => setMenu(null)} />}
    </>
  );
}
