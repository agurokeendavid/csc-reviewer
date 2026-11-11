# CSC Reviewer PH

An unofficial Philippine Civil Service Exam reviewer with timed Professional and Subprofessional mock exams, randomized practice questions, answer explanations, and optional Google Sheets score tracking.

## Features

- Full-length mocks based on the 2026 Career Service Examination, Pen and Paper Test (CSE-PPT), plus a 20-question quick practice mode.
- A bundled bank of 433 original practice items, including English and Filipino verbal questions. Each attempt samples the bank and shuffles answer choices.
- A countdown timer, question navigator, and review flags. After submission, examinees can see their answers, explanations, and scores by section.
- An optional name field. When Google Sheets is connected, completed attempts with a blank name appear in the organizer's private sheet as **Anonymous**.

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

Open [localhost:3000](http://localhost:3000). Practice works before you connect score storage. Examinees can leave their name blank to practice anonymously. After submission, they can review explanations and see scores by section. Reloading or exiting clears the current attempt.

## Connect Google Sheets

1. Open your score spreadsheet or create one. Keep its sharing restricted to the organizer and authorized viewers.
2. Open **Extensions → Apps Script** in the spreadsheet. Paste [Code.gs](google-apps-script/Code.gs) into the editor and save.
3. Select and run **setup** in the editor. Complete Google’s authorization prompt and confirm that the **Scores** tab appeared.
4. Select **Deploy → New deployment → Web app**. Choose **Execute as me** and set **Who has access** to **Anyone** so examinees can submit without signing in. Copy the deployment URL ending in `/exec`. If your Workspace policy prevents anonymous web apps, use a Google account that allows this access.
5. To test locally, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_SCORE_ENDPOINT` to the deployment URL, and restart the dev server. Set the same key in Netlify’s build environment before deploying.
6. In a private browser window, submit a quick attempt with the name blank. Confirm that the app displays **Saved to Google Sheets** and that the sheet contains one matching row with **Anonymous** in the Name column.

After editing Apps Script, release a new version via **Deploy → Manage deployments**. The endpoint validates score fields and deduplicates retries. The URL is public. Because the browser grades the test, the endpoint accepts well-formed scores from anyone with the URL. The sheet’s sharing settings control who can read names and scores.

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
- Run `npm test` for question generation, grading, and score-write checks with mocked Google services. Run `npm run build` to verify the static export.
