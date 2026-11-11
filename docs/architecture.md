# Architecture

| Path | Responsibility |
| --- | --- |
| `app/layout.js` | App metadata and local fonts |
| `app/page.js` | Static entry point |
| `app/reviewer.js` | Name and exam setup, timer, navigation, and results |
| `app/study.js`, `app/score-history.js` | Topic drills, immediate feedback, and recent score comparisons |
| `app/globals.css` | Responsive layout and styling |
| `lib/exam.js` | Exam rules, question selection, shuffling, and grading |
| `lib/questions/` | Authored items and procedural variants |
| `lib/scores.js` | Timed-exam requests and receipt handling |
| `lib/practice-storage.js` | Timed exam progress and score summaries stored on the current device |
| `google-apps-script/Code.gs` | Timed-exam issuance, ticket verification, grading, and Sheet writes |
| `google-apps-script/ExamBank.gs` | Private timed bank kept out of Git and installed in Apps Script |
| `test/` | Exam and score-write checks |

## Attempt lifecycle

1. The examinee selects a level and mode. They can enter a name or leave the field blank to be recorded as Anonymous.
2. Apps Script samples and shuffles questions from the private bank. The browser receives the prompts, choices, and a signed attempt ticket. It saves those fields with the deadline, selected answers, review flags, and question position. Names remain in memory.
3. The browser sends the ticket, selected answers, and optional name in a form-encoded POST and reads the JSON response. It submits when the user finishes, at the deadline, or when the user resumes an expired attempt.
4. Apps Script verifies the ticket and grades the assigned questions. A script lock protects the score write. A keyed digest in the attempt ID cell’s note allows identical retries and rejects modified resubmissions.
5. Apps Script returns the score and that attempt’s solutions after the Sheet write. Results highlight the lowest-scoring section and link to a study session. Local history keeps the last 30 summaries without names.

The Sheet contains the attempt ID, timestamp, display name, exam level, mode, correct count, total, percentage, and elapsed seconds. The endpoint exposes no read API. The Sheet’s sharing settings govern access.

Study Mode uses the separate public bank. It gives immediate feedback and saves the first completed round to local history. Apps Script caps reported elapsed time at the exam duration. Enforcing answer times against a modified browser would require server-side checkpoints.

Next.js exports static files to `out/`. The public `NEXT_PUBLIC_SCORE_ENDPOINT` setting is embedded at build time. The spreadsheet identifier stays in Apps Script properties after the organizer runs `setup`. See the [setup guide](../README.md#connect-google-sheets) for deployment and live verification.
