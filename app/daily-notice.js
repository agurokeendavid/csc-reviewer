"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { countdownLabel, nextQuestionRefresh } from "../lib/exam.js";

const NOTICE_KEY = "csc-reviewer:daily-notice-dismissed:v1";
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readDismissed() {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // Blocked storage only means the notice returns on the next visit.
  }
  for (const listener of listeners) listener();
}

// Shown once per browser until dismissed. The static build treats it as dismissed so
// the card never flashes in before the browser can check storage.
export default function DailyNotice() {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  if (dismissed) return null;
  return <NoticeCard />;
}

function NoticeCard() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="daily-notice" aria-labelledby="daily-notice-title">
      <button type="button" className="daily-notice-close" onClick={dismiss} aria-label="Dismiss notice">
        <X size={16} aria-hidden="true" />
      </button>
      <h2 id="daily-notice-title">New timed questions every midnight</h2>
      <p>At 12:00 AM Philippine time, timed exams switch to a new mix of questions, and math and logic items get new numbers.
        Some questions can come back on later days. An exam you’ve already started keeps its questions.</p>
      <p className="daily-notice-next">Next change in {countdownLabel(nextQuestionRefresh(now) - now)}.</p>
      <button type="button" className="button secondary" onClick={dismiss}>Got it</button>
    </section>
  );
}
