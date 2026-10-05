# Content review (step 12)

Reviewed by Claude, not by a native speaker (decision: no native-speaker review). Treat the content as good practice material, not as official exam content.

## What was checked
- Every multiple-choice item (618 across units and exams) for answer position, answer length, ambiguity and typos.
- Duplicate or near-duplicate questions, joke or implausible options, gap-choice items with two valid answers.

## Findings and fixes
- **Answer-length bias:** the correct option was the uniquely longest one in 44% of items (chance is about 30%), so learners could guess by length. Distractors were rewritten in the exam files (65% to 37%) and in 78 unit items. Overall now 38%. `npm run stats` prints the metric (target at most 40%).
- **Answer position:** evenly spread (161 / 161 / 146 / 150 for positions 0 to 3). No change needed.
- **Ambiguities, typos, joke options, duplicate questions:** fixed in the basis (werkwoorden-nu, modaal, imperfectum, niet-geen, voorzetsels) and KNM (omgang, geschiedenis, onderwijs, gemengd) units.
- Content ids were not changed (`npm run check-ids` stays green).

## Left for later
- KNM units are still at about 46% (target 40%); the remaining items are mostly facts where a precise answer is naturally longer.
- Facts about Dutch institutions and laws can go out of date; check them against official sources (rijksoverheid.nl, inburgeren.nl) before relying on them.
- A native speaker would still catch unnatural phrasing.

## Flag workflow
Learners can report a wrong item with the report button. Flags live in the progress file and in Settings, "Mijn meldingen". Run `npm run flags -- <progress-file>...` to merge friends' flags into one report, then fix the JSON in `data/course/`, keeping ids stable.
