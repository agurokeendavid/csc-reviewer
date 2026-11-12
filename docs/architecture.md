# Architecture

| Path | Responsibility |
| --- | --- |
| `app/layout.js` | App metadata, local fonts, and the pre-hydration theme script |
| `app/page.js` | Static entry point |
| `app/reviewer.js` | Name and exam setup, timer, navigation, review flags, away tracking, and results |
| `app/study.js`, `app/score-history.js` | Topic drills, immediate feedback, and recent score comparisons |
| `app/leaderboard.js` | Public top five scores by level and mode |
| `app/site-resources.js` | References menu and anonymous feedback form |
| `app/theme-toggle.js`, `lib/theme.js` | Light and dark theme toggle, stored in the browser |
| `app/daily-notice.js` | Dismissible notice that timed questions change at midnight in Manila |
| `app/globals.css` | Responsive layout, theme tokens, and styling |
| `lib/exam.js` | Exam rules, question selection, shuffling, grading, and leaderboard limits shared with Apps Script |
| `lib/questions/` | Authored items and procedural variants |
| `lib/scores.js` | JSON requests to the Apps Script endpoint |
| `lib/practice-storage.js` | Timed exam progress and score summaries stored on the current device |
| `google-apps-script/Code.gs` | Timed-exam issuance, ticket verification, grading, Sheet writes, leaderboard, and feedback |
| `google-apps-script/ExamBank.gs` | Private timed bank kept out of Git and installed in Apps Script |
| `test/` | Exam and score-write checks |
| `.github/workflows/ci.yml` | Lint, test, and build on every push and pull request |

## Attempt lifecycle

1. The examinee selects a level and mode. They can enter a name or leave the field blank to be recorded as Anonymous, and can opt in to show the name on the leaderboard.
2. Apps Script samples and shuffles questions from the private bank. The selection rotates at midnight in Manila. The browser receives the prompts, choices, and a signed attempt ticket. It saves those fields with the deadline, selected answers, review flags, question position, and away counts. Names remain in memory.
3. During the exam, the browser counts each time the page is hidden or loses focus for at least a second, and the total time away. Text selection, copying, and the context menu are turned off on the question and the answer review.
4. The browser sends the ticket, selected answers, away counts, and optional name in a form-encoded POST and reads the JSON response. It submits when the user finishes, at the deadline, or when the user resumes an expired attempt.
5. Apps Script verifies the ticket and grades the assigned questions. It marks the attempt late if it arrives more than two minutes after the deadline. A script lock protects the score write. A keyed digest in the attempt ID cell’s note allows identical retries, which report the values first saved, and rejects modified resubmissions.
6. Apps Script returns the score, the late, too-fast, and away flags, and that attempt’s solutions after the Sheet write. Results highlight the lowest-scoring section and link to a study session. Local history keeps the last 30 summaries without names.

The Scores tab contains the attempt ID, timestamp, private name, exam level, mode, correct count, total, percentage, elapsed seconds, public display name, Submitted late, Hide from leaderboard, Times left exam page, and Seconds away. The Feedback tab stores anonymous messages with an ID and timestamp. The Sheet’s sharing settings govern access to both.

The leaderboard returns up to five scores per level and mode, with only the optional public name and score figures. Equal scores rank by time used. It leaves out scores that were submitted late, finished faster than `MIN_SECONDS_PER_ITEM` per question, marked in Hide from leaderboard, or recorded at least `AWAY_LEAVE_LIMIT` leaves or more than `AWAY_SECONDS_LIMIT` seconds away. These constants are defined in both `lib/exam.js` and `Code.gs`, and a test keeps them equal.

Study Mode uses the separate public bank. It gives immediate feedback and saves the first completed round to local history. Apps Script caps reported elapsed time at the exam duration. Away counts come from the browser and can be forged. Enforcing answer times or focus against a modified browser would require server-side checkpoints.

Next.js exports static files to `out/`. The public `NEXT_PUBLIC_SCORE_ENDPOINT` setting is embedded at build time. The spreadsheet identifier stays in Apps Script properties after the organizer runs `setup`. See the [setup guide](../README.md#connect-google-sheets) for deployment and live verification.
