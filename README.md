# CSC Reviewer PH

An unofficial Philippine Civil Service Exam reviewer with timed Professional and Subprofessional mock exams, randomized practice questions, answer explanations, and optional Google Sheets score tracking.

## Features

- Full-length mocks based on the 2026 Career Service Examination, Pen and Paper Test (CSE-PPT), plus a 20-question quick practice mode.
- Separate banks of original timed-exam and study questions, including English and Filipino verbal items.
- A countdown timer, question navigator, review flags, and A to D keyboard shortcuts. After submission, examinees can see their answers, explanations, and scores by section.
- A public leaderboard with the top five timed scores per exam level and mode. Examinees can opt in to show their name.
- An optional name field. When Google Sheets is connected, completed attempts with a blank name appear in the organizer's private sheet as **Anonymous**.
- A References menu for the exam scope and question sources, and anonymous feedback saved to the organizer's private **Feedback** tab.
- Untimed Study Mode by subject or topic, with immediate explanations and a retry round for missed questions.
- Resume a timed exam after a refresh or after closing the tab. The timer uses the original deadline.
- A dismissible notice, with a countdown, explaining that timed questions change at midnight Philippine time.
- Score history on this device, with changes by subject compared to the previous attempt in the same format.
- A light theme by default and a dark mode toggle in the header. The choice is remembered in that browser.

## Exam formats

| Level | Full mock | Time | Level-specific section |
| --- | ---: | ---: | --- |
| Professional | 150 questions | 3 hr 10 min | Analytical Ability |
| Subprofessional | 145 questions | 2 hr 40 min | Clerical Ability |

Both levels include English and Filipino verbal ability, numerical ability, and general information. Quick practice has 20 questions and a 25-minute timer. Full mocks follow the scored item counts and timing in the [2026 CSC advisory](https://csc.gov.ph/examination-advisories/exam-advisory-no2s2026). The separate examinee questionnaire is outside the practice scope. Section allocations and raw percentages are specific to this reviewer.

## Run locally

Use Node.js 22.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Study Mode works before you connect Apps Script. Timed exams use Apps Script to issue questions, grade answers, and save scores. Timed progress stays in the same browser, and the name field is optional again when you resume. The browser keeps the last 30 timed exam and study scores without names.

## Connect Google Sheets

1. Open your score spreadsheet or create one. Keep its sharing restricted to the organizer and authorized viewers.
2. Open **Extensions → Apps Script** in the spreadsheet. Replace the main script with [Code.gs](google-apps-script/Code.gs). Add a second **Script** file named **ExamBank** and paste the contents of the private local `google-apps-script/ExamBank.gs` into it. Keep the timed bank in the private Apps Script project and an offline backup. Git ignores this file.
3. Select and run **setup** in the editor. Complete Google’s authorization prompt and confirm that the **Scores** tab appeared.
4. For an existing web app, open **Deploy → Manage deployments**, edit the active deployment, choose **New version**, and deploy. This keeps your existing `/exec` URL. For a new deployment, choose **Web app**, **Execute as me**, and access for **Anyone** so examinees can submit anonymously. Archive any other active deployments that still accept client-calculated scores.
5. To test locally, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_SCORE_ENDPOINT` to the deployment URL, and restart the dev server. Set the same key in Netlify’s build environment before deploying.
6. In a private browser window, submit a quick attempt with the name blank. Confirm that the app displays **Your score was recorded** and that the sheet contains one matching row with **Anonymous** in the Name column.

The start response contains question text, shuffled choices, and a signed ticket. Apps Script checks the ticket, grades the assigned questions, and returns explanations after saving the score. Identical retries reuse the original score row. The web app accepts anonymous submissions, and the Sheet’s sharing settings control who can read names and scores.

The public leaderboard includes existing scores as Anonymous. Names appear only when an examinee opts in for that attempt. Run `setup` after updating the script to add the **Public display name**, **Submitted late** and **Hide from leaderboard** columns to the existing Scores sheet.

Apps Script answers every request with JSON, and the older iframe receipt has been removed. Earlier builds of the site already try JSON first, so they keep working with the new `Code.gs`.

A submission that arrives more than two minutes after the exam deadline is still graded and saved, but the row is marked **Yes** in a **Submitted late** column and the score stays off the leaderboard. This happens when someone resumes an expired exam after closing the tab. Scores finished faster than 15 seconds per question on average (5 minutes for quick practice) are also left off, because that pace usually means answers were pasted from a collected key. To remove any other score, type **Yes** in its **Hide from leaderboard** cell, or insert checkboxes in that column and tick them. A string of blank or very low Anonymous scores in a short time usually means someone is collecting answers.

On the timed exam and its answer review, text selection, copying and the right-click menu are turned off. That stops casual copy-and-paste into a search, but not screenshots or retyping. The answer review reveals that attempt’s solutions after submission. For a higher-stakes assessment, consider delaying answer release, adding rate limits or access codes, and recording answers server-side before the deadline.

## Deploy on Netlify

1. In Netlify, open **Add new project → Import an existing project → GitHub**. Authorize repository access and select `agurokeendavid/csc-reviewer`.
2. Choose `main` as the production branch and leave the base directory empty. The included [netlify.toml](netlify.toml) sets Node.js 22, runs `npm run build`, and publishes `out`.
3. Add `NEXT_PUBLIC_SCORE_ENDPOINT` with your deployed Apps Script `/exec` URL. Set it for **Production** and include the **Builds** scope if Netlify shows scope controls. If the import screen has already started the first build, add the variable under **Project configuration → Environment variables** and trigger a new production deploy. Next.js reads this value at build time.
4. Publish the site. Open its `netlify.app` URL in a private window, submit a quick practice attempt with the name blank, and verify the **Anonymous** row in the **Scores** tab.

The frontend is a static export. Google Apps Script handles score writes. See the [Netlify Git deployment guide](https://docs.netlify.com/start/quickstarts/deploy-from-repository/) and [build environment variable guide](https://docs.netlify.com/build/configure-builds/environment-variables/).

## Maintain the project

- [Architecture and data flow](docs/architecture.md)
- [Question authoring and sources](docs/question-bank.md)
- [AI CLI project instructions](AGENTS.md)
- Run `npm run lint` for ESLint with the Next.js rules, `npm test` for question generation, grading, and score-write checks with mocked Google services, and `npm run build` to verify the static export.
- GitHub Actions runs all three on every push and pull request. Tests that need the private question bank are skipped there because `ExamBank.gs` isn't in the repository.
