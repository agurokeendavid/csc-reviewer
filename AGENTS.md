# Project instructions

## Purpose

- CSC Reviewer PH is an unofficial practice app for the Philippine Career Service Examination. It includes timed Professional and Subprofessional mocks, quick practice, and answer explanations.
- Keep the Next.js App Router frontend as a static Netlify export. Issue and grade timed exams in Apps Script, then save named or anonymous scores to the organizer's private Google Sheet.
- Start with [README.md](README.md) for setup, [architecture](docs/architecture.md) for data flow, and [question authoring](docs/question-bank.md) for coverage and sources.

## Development

- Use Node.js 22. Run `npm ci`, `npm run dev`, `npm test`, and `npm run build`. Netlify serves `out/`.
- The interface lives in `app/reviewer.js` and `app/globals.css`. Exam rules and content live in `lib/exam.js` and `lib/questions/`.
- If you change exam lengths, durations, or score fields, update both the frontend and `google-apps-script/Code.gs`.
- Use original questions with authoritative references for factual explanations. Exclude leaked exam items. Section allocations and percentages are practice metrics.
- Keep the timed answer bank in the private Apps Script project. The browser receives timed solutions only after a completed score write. Study Mode uses the separate public bank.
- Save the active timed exam and the last 30 score summaries in browser storage without names. Keep Study Mode answers in memory. Treat the score endpoint as public and the destination Sheet as private.
- Keep the name optional. Save a blank name as `Anonymous` in the existing Name column.
- Verify changes through the normal exam flow. For a live score test, leave the name blank and confirm a single Anonymous row.

## Secret protection

Follow the owner's mandatory secret-protection rules for ASP.NET application settings and IIS web configuration files, including all environment variants and transforms. Exclude them from searches and do not open, copy, summarize, diff, upload, or change them. Refer to needed settings only by key and let the owner edit their values. If a secret appears in tool output, warn the owner without repeating it. Never bypass the secret-protection hook.
