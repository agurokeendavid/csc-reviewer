# Question bank

Use the [2026 CSC exam advisory](https://csc.gov.ph/examination-advisories/exam-advisory-no2s2026) for the scope, item counts, and timing. Write original practice items and verify facts against authoritative sources. CSC explains its position on actual exam materials in its [reviewer advisory](https://csc.gov.ph/csc-warns-public-against-civil-service-reviewers-review-centers).

- Verbal covers vocabulary, sentence completion and structure, error recognition, paragraph organization, and reading in English and Filipino.
- Numerical covers arithmetic, number sequences, and word problems.
- Analytical covers analogies, symbolic and abstract reasoning, assumptions and conclusions, and data interpretation for Professional exams.
- Clerical covers filing and spelling for Subprofessional exams.
- Philippine Constitution questions cite the [1987 Constitution](https://lawphil.net/consti/cons1987.html).
- Public ethics questions cite [R.A. 6713](https://lawphil.net/statutes/repacts/ra1989/ra_6713_1989.html).
- Human rights questions cite the [Universal Declaration of Human Rights](https://www.un.org/en/about-us/universal-declaration-of-human-rights/).
- Environmental questions cite the [Ecological Solid Waste Management Act](https://lawphil.net/statutes/repacts/ra2001/ra_9003_2001.html) and [Clean Air Act](https://lawphil.net/statutes/repacts/ra1999/ra_8749_1999.html).

## Add an item

1. Use `lib/questions/verbal.js` for English or Filipino verbal items, `general.js` for sourced knowledge, and `skills.js` for numerical, analytical, and clerical items.
2. Follow the existing tuple shape with a topic, prompt, correct answer, three distinct distractors, and an explanation. General Information groups supply their topic and source separately.
3. Write explanations independent of option letters. Answer order changes on every attempt.
4. Keep prompts distinct within each section. For spelling exercises, the options identify the word being tested. Verify the arithmetic and distractors across every generated variant.
5. Run `npm test` after changing the bank or section allocations.

## Practice allocation

| Section | Professional | Subprofessional | Quick practice |
| --- | ---: | ---: | --- |
| Verbal | 43 | 42 | 5 |
| Numerical | 37 | 35 | 5 |
| Analytical | 38 | — | 5 in Professional |
| Clerical | — | 38 | 5 in Subprofessional |
| General Information | 32 | 30 | 5 |

Study Mode uses the bundled public bank. Timed exams draw from the separate private `google-apps-script/ExamBank.gs` in Apps Script. Keep the timed file out of version control and preserve a private backup. Each timed item supplies a topic, prompt, correct choice, three distractors, explanation, and optional source URL.

Each new timed exam uses the issue date in Manila to rotate which items it favors within each topic. Numerical, Analytical, and Clerical also include template variants generated from that date. Verbal and General Information rotate through authored items. General Information has 78 questions with sources. The selector skips identical answer-choice sets within a section and gives first priority to questions outside the previous timed attempt in the same browser. Some questions can recur on later days. The signed ticket carries the issue date and bank version so an attempt can be graded after midnight. Preserve the published bank version and generator when introducing a replacement so existing tickets can still be graded.

Deploy the updated `Code.gs` and private `ExamBank.gs` together as a new version of the existing Apps Script web app. Run `npm test` with the private file present to validate the generated variants and General Information retakes.

The CSC’s published coverage guides original question writing. Its [test banking description](https://csc.gov.ph/office-functions/erpo) describes its internal exam development process. This project has no dependency on a third-party questionnaire API.
