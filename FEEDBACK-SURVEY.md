# Teacher feedback survey: protocol and questions

The anonymous survey collects teachers' experiences of using *Deep Elements* with learners. It is designed to (1) improve the game and (2) provide data for an education research paper. It runs in Microsoft Forms through Queen's University Belfast's Microsoft 365 and is linked from the section "Share your feedback" at the end of `TEACHERS_GUIDE.md`. Inside the game, the guide can also show the form in the page, but only after the teacher clicks "Show the survey here", so pupils who open the guide never contact Microsoft.

**The live form:** https://forms.cloud.microsoft/e/hwk5CwFcxa ("Deep Elements: teacher feedback survey", "Anyone can respond", anonymous). Checked against the form's published data on 2026-10-17: the questions below are the ones in the form, in the same order.

It follows the same structure and numbering as the survey for *Hidden Treasure in Your Pocket*, so results from the two resources can be compared. Only the questions about the resource itself differ (the parts used, engagement with each part, the learning objectives, and how far learners got).

## What an education paper typically needs, and where it comes from

| Typically reported | Survey sections |
|---|---|
| Context: level and age of learners, type of setting, country or curriculum | A, B |
| Sample: number of learners, classes, teachers (responses) | B, plus the number of responses |
| Implementation: time, format, devices, which parts of the game were used, instructions given | C |
| Engagement and learner perceptions (rated on a 1–5 scale) | D |
| Learning: achievement of the stated objectives, progress in the game, any before/after check, observed evidence | E |
| Usability and fit with the curriculum (teacher perceptions) | F |
| Open comments: strengths, problems, improvements, learner voice (for short quotes) | C, D, F, G |
| Ethics statement: approval by a research ethics committee and informed consent | Consent questions and the information for participants |

The learning objectives in section E are the six stated in the teacher's guide, so the results can be reported against them.

## Before the results are used for research

1. **Research ethics approval** from the relevant Queen's University Belfast research ethics committee, covering: an anonymous online survey of adult teachers; class-level information only (no data about individual learners, no new data collected from learners); publication of aggregated results and optional anonymous quotes.
2. **Data protection check** with the University's Information Compliance Unit: the lawful basis stated in the guide (public task, UK GDPR Article 6(1)(e)), retention period, and whether a data protection impact assessment is needed.
3. **Confirm with the University** that an "Anyone can respond" Microsoft form is allowed for this purpose.
4. **Update the guide** once approval is given: replace the sentence "Research ethics approval ... is being sought" with the committee and reference, and add the retention period if it differs from the University's policy.

## To change in the form (noted November 2026)

Questions 20, 23 and 26 name the *Deep Element Run*. The game now has three *Element Runs*
(*The First Twenty*, the *Deep Element Run* and *The Table Run*). The questions below are
left as they stand in the live form; when the form is next edited, "Deep Element Run"
should become "Element Runs" in all three, and this file should be changed with it.

## The form in Microsoft Forms

Title: **Deep Elements: teacher feedback survey**.

Description: *Have you used Deep Elements with learners? Please tell us how it went. The survey takes about 10 minutes, and every question except the consent questions is optional. Please read the information for participants in the game's teacher's guide (section "Share your feedback") before you start. Do not include names or any details that could identify you, your school, colleagues or learners.*

- **Sections:** Consent first, then A–G, each shown as a separate page.
- **Consent:** questions 1–4 are **Required**, each with the single choice "I agree". Question 5 (quotes) is an optional Yes/No.
- **Tick-all-that-apply questions** (7, 12, 18, 19, 20) allow **Multiple answers**.
- **Rating tables** (23, 25 and 32) are **Likert** questions: the statements are the rows; the columns are 1 to 5 with their labels plus "Not used", "Not observed" or "Not sure".
- **Number questions** (14, 15, 17, 27) have the **Number** restriction; the free-text questions use **Long answer**.
- **Settings:** **Anyone can respond**, so teachers outside the University can answer and Forms records no names or email addresses. Do not forward the response notifications to other mailboxes.
- **Continuity:** a form belongs to the account that created it. Add a co-owner or move it to a Microsoft 365 group, so the responses are not lost if the account changes.

If the form is ever replaced, update the two addresses on the `<!-- survey ... -->` line and the link in the "Share your feedback" section of `TEACHERS_GUIDE.md`, and rebuild `docs-inline.js` with `node generate-docs-inline.js`.

## Design choices for anonymity

- No names, email addresses, school names or exact dates (month and year only); location only as UK nation, Ireland, another European country or outside Europe.
- Only class-level information about learners; free-text boxes remind teachers not to include identifying details.
- The game itself uses no cookies, analytics or tracking. The survey is only loaded from Microsoft when a teacher chooses to open it.
- Because answers are anonymous, they cannot be withdrawn after submission; the information for participants says so.
- Consent for publishing short anonymous quotes is a separate, optional question (5). Only use quotes from responses where it is "Yes".

## Handling the data

- Download the responses with **Open results in Excel** in Microsoft Forms, keep the file on University storage, and delete the responses from the form at the end of the retention period.
- Before analysis or sharing, read the free-text answers and remove anything that could still identify a person or school.
- Report combined results (counts, medians and ranges for the 1–5 scales, total learners reached); avoid reporting small subgroups that could identify a school.
- If the data is shared openly with a paper, share only the cleaned, anonymised file.

## The questions

Every question except consent questions 1–4 is optional. The short names are suggested column names for analysis; the Excel export from Forms is headed by the question text, with one column per row for the rating tables. Multiple answers are separated by semicolons.

**Consent**

| # | Column | Question | Answer format |
|---|---|---|---|
| 1 | `consent_read` | I have read the information for participants. | "I agree" (required) |
| 2 | `consent_adult` | I am 18 or over and used the game as a teacher or educator. | "I agree" (required) |
| 3 | `consent_use` | I agree that my anonymous answers can be used to improve the game and in research publications and presentations. | "I agree" (required) |
| 4 | `consent_noid` | I will not include names or other details that could identify me, my school or any learner. | "I agree" (required) |
| 5 | `consent_quotes` | Do you agree that short anonymous quotes from your written answers may be published? | one of: Yes / No |

**A. You and your setting**

| # | Column | Question | Answer format |
|---|---|---|---|
| 6 | `role` | Your role | one of: Secondary school teacher / Primary school teacher / Post-16 / college teacher / Teaching assistant or technician / Outreach, STEM ambassador or museum educator / University staff or student / Other |
| 7 | `subjects` | Subject(s) in which you used it (tick all that apply) | any of: Chemistry / General science / Physics / Geography / Computing / Citizenship / sustainability / Other |
| 8 | `experience` | Your teaching experience | one of: Less than 3 years / 3–10 years / More than 10 years |
| 9 | `region` | Where you teach | one of: Northern Ireland / England / Scotland / Wales / Republic of Ireland / Another European country / Outside Europe |
| 10 | `setting` | Setting | one of: State-funded school / Independent school / Further education or sixth-form college / After-school or code club / Outreach event, science festival or museum / Home education / Other |
| 11 | `month_used` | When did you use it? Month and year only (e.g. March 2026) | short text |

**B. Your learners**

| # | Column | Question | Answer format |
|---|---|---|---|
| 12 | `age_groups` | Age group(s) of the learners (tick all that apply) | any of: Under 11 / 11–12 / 12–14 / 14–16 / 16–18 / Adults |
| 13 | `level` | Year group, level or course (e.g. Year 9, S2, GCSE Chemistry) | short text |
| 14 | `n_learners` | About how many learners took part in total? | number |
| 15 | `n_groups` | In how many classes or groups? | number |
| 16 | `prior` | How much had the learners already learned about critical minerals and where the metals in everyday technology come from? | one of: Very little / Some / A lot |

**C. How you used the game**

| # | Column | Question | Answer format |
|---|---|---|---|
| 17 | `minutes` | About how many minutes did learners spend on it in total? | number |
| 18 | `format` | How was it used? (tick all that apply) | any of: Whole class, shown on a board or screen / Individually on devices / In pairs or small groups / As homework / At an event, science festival or exhibition / Other |
| 19 | `devices` | Devices (tick all that apply) | any of: Desktop computers or laptops / Chromebooks / Tablets / Phones / Interactive whiteboard or projector |
| 20 | `parts_used` | Which parts did learners use? (tick all that apply) | any of: Tutorials / Critical Missions (world map) / Quiz pads in the missions / Deep Element Run / Endless Depths / Field notebook / Shared levels or the level editor / Lesson plan, Game vs. Reality table or discussion questions from the teacher's guide |
| 21 | `plan` | Which best describes your lesson? | one of: I followed the suggested classroom flow / I adapted the suggested classroom flow / I used my own lesson plan / Learners explored freely with little instruction |
| 22 | `instructions` | Briefly describe the instructions or tasks you gave the learners. | free text |

**D. Engagement**

Question 23: *How engaged were your learners with each part?* Columns: 1 very low / 2 low / 3 medium / 4 high / 5 very high / Not used.

| # | Column | Row | Answer format |
|---|---|---|---|
| 23 | `eng_tutorials` | Tutorials | 1–5 or "Not used" |
| 23 | `eng_missions` | Critical Missions | 1–5 or "Not used" |
| 23 | `eng_quiz` | Quiz pads in the missions | 1–5 or "Not used" |
| 23 | `eng_run` | Deep Element Run | 1–5 or "Not used" |
| 23 | `eng_endless` | Endless Depths | 1–5 or "Not used" |
| 23 | `eng_notebook` | Field notebook | 1–5 or "Not used" |
| 23 | `eng_cards` | Element fact cards | 1–5 or "Not used" |
| 23 | `eng_reality` | Game vs. Reality discussion | 1–5 or "Not used" |
| 23 | `eng_overall` | Overall | 1–5 or "Not used" |
| 24 | `eng_best` | Which part worked best with your learners, and why? | free text |

**E. Learning**

Question 25: *In your judgement, how well did learners achieve these learning objectives?* Columns: 1 not at all / 2 a little / 3 partly / 4 mostly / 5 fully / Not observed.

| # | Column | Row | Answer format |
|---|---|---|---|
| 25 | `lo_devices` | Name elements inside everyday devices and match them to the part they make work | 1–5 or "Not observed" |
| 25 | `lo_critical` | Explain why some raw materials are "critical" | 1–5 or "Not observed" |
| 25 | `lo_mines` | Locate real mines on a world map and link them to everyday technology | 1–5 or "Not observed" |
| 25 | `lo_families` | Recognise families of the periodic table and their shared behaviour | 1–5 or "Not observed" |
| 25 | `lo_synthetic` | Tell naturally occurring elements from synthetic, lab-made ones | 1–5 or "Not observed" |
| 25 | `lo_model` | Identify where the game simplifies reality, and why | 1–5 or "Not observed" |
| 26 | `progress` | How far did a typical learner get? | one of: Tutorials only / 1–2 missions / 3–5 missions / More than 5 missions / They also played the Deep Element Run or Endless Depths |
| 27 | `notebook_n` | If known: about how many elements did a typical learner have in the field notebook at the end? | number |
| 28 | `quiz_pads` | How did learners do at the quiz pads in the missions? | one of: Mostly right first time / A mix of right and wrong / Mostly guessed / Not observed |
| 29 | `prepost` | Did you check learners' knowledge before and after (e.g. a short test or show of hands)? | one of: Yes / No |
| 30 | `prepost_results` | If yes: what did it show? (class-level results only) | free text |
| 31 | `evidence` | What evidence of learning did you notice (e.g. questions asked, discussions, notebook pages)? | free text |

**F. Using the game**

Question 32: *How far do you agree?* Columns: 1 strongly disagree / 2 disagree / 3 neutral / 4 agree / 5 strongly agree / Not sure.

| # | Column | Row | Answer format |
|---|---|---|---|
| 32 | `use_easy` | It was easy to set up and use in class | 1–5 or "Not sure" |
| 32 | `use_level` | The content was at the right level for my learners | 1–5 or "Not sure" |
| 32 | `use_curriculum` | It fits my curriculum | 1–5 or "Not sure" |
| 32 | `use_clear` | The information is clear and accurate | 1–5 or "Not sure" |
| 32 | `use_devices` | It worked well on our devices | 1–5 or "Not sure" |
| 32 | `use_difficulty` | The game's difficulty was about right | 1–5 or "Not sure" |
| 32 | `use_balance` | The game helped the learning rather than distracting from it | 1–5 or "Not sure" |
| 32 | `use_again` | I would use it again | 1–5 or "Not sure" |
| 32 | `use_recommend` | I would recommend it to colleagues | 1–5 or "Not sure" |
| 33 | `problems` | Did you have any technical or practical problems? | free text |

**G. Your views**

| # | Column | Question | Answer format |
|---|---|---|---|
| 34 | `improve` | What should be improved, added or changed? | free text |
| 35 | `learner_voice` | Comments, questions or ideas from your learners worth sharing (anonymous paraphrases, no names) | free text |
| 36 | `general` | Any other feedback | free text |
