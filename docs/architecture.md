# Architecture

| Path | Responsibility |
| --- | --- |
| `app/layout.js` | App metadata and local fonts |
| `app/page.js` | Static entry point |
| `app/reviewer.js` | Name and exam setup, timer, navigation, and results |
| `app/globals.css` | Responsive layout and styling |
| `lib/exam.js` | Exam rules, question selection, shuffling, and grading |
| `lib/questions/` | Authored items and procedural variants |
| `lib/scores.js` | Browser submission and receipt handling |
| `google-apps-script/Code.gs` | Sheet setup, validation, and score writes |
| `test/` | Exam and score-write checks |

## Attempt lifecycle

1. The examinee selects a level and mode. They can enter a name or leave the field blank to be recorded as Anonymous.
2. The browser samples each section without replacement, balances subtopics, and shuffles answer options. Questions and answers stay in browser memory.
3. The timer uses an absolute deadline and grades the attempt when time expires. The results show each answer, its explanation, and per-section scores.
4. The browser submits the score to Apps Script via a form targeting a hidden frame. The Google-hosted response posts a receipt to the page’s origin with a random request token.
5. Apps Script validates the request, serializes writes with a script lock, and appends one row per attempt ID. A retry keeps the attempt ID and uses a new receipt token.

The Sheet contains the attempt ID, timestamp, display name, exam level, mode, correct count, total, percentage, and elapsed seconds. The endpoint exposes no read API. The Sheet’s sharing settings govern access.

Next.js exports static files to `out/`. The public `NEXT_PUBLIC_SCORE_ENDPOINT` setting is embedded at build time. The spreadsheet identifier stays in Apps Script properties after the organizer runs `setup`. See the [setup guide](../README.md#connect-google-sheets) for deployment and live verification.
