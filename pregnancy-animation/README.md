# האנטומיה של ההריון — 3D medical animation (procedural)

A ~4-minute educational 3D animation about the mother's body and fetal development across the three
trimesters. Everything is generated from code: real-time 3D geometry (Three.js) rendered frame by frame
in headless Chromium and encoded with ffmpeg. The anatomy evolves on screen, so the camera is not just
moving around fixed models:

- The embryo/fetus is a parametric metaball body driven by gestational age (LMP weeks). Proportions,
  curvature, limb buds → paddles → separated fingers, tail regression, fat and head/body ratio change
  continuously.
- The uterus is a lathe surface rebuilt every frame from week-based length/width tables. The mother's
  belly is a metaball shell that follows the uterus.
- Cut-away views show the uterine wall in cross-section (muscle + lining), placenta, amnion, cord,
  diaphragm, stomach and esophageal sphincter, intestines, bladder, vessels, pelvis and joints.

## Output

| File | What |
|---|---|
| `pregnancy_anatomy_he.mp4` | Final video, 1920×1080, 24 fps, ~4:10, **silent** (see narration) |
| `chapters/chapter_N.mp4` | The same video as 8 separate chapter clips (1–8) for editing |
| `narration_he.txt` | The Hebrew narration script, verbatim, per chapter |
| `narration_he.srt` | Suggested narration timing (cue per sentence, aligned to the chapter clips) |
| `stills/` | Key review stills from every chapter |

**Narration:** no Hebrew TTS was available in the render environment, so the video is silent. Record
or synthesize `narration_he.txt` with an adult male Hebrew voice and lay each chapter's text over its
chapter (timings in `narration_he.srt`). Chapter lengths were set from the word count of each chapter
(about 2 words/second): 28, 36, 32, 26, 26, 50, 22, 30 s (chapter 8 includes the 4-second end card).

## Chapter timeline (seconds)

| # | Title | Start | Length | Main animation |
|---|---|---|---|---|
| 1 | האנטומיה של ההריון | 0 | 28 | Translucent figure, glowing uterus, 40-week bead ring split into trimesters (13/14/13), fertilization spark at week 3, uterus/belly/fetus preview growth |
| 2 | מערכת הרבייה הנשית | 28 | 36 | Uterus, ovaries, tubes, cervix, vagina highlighted in turn; ovulation, fertilization in the ampulla, cleavage 1→2→4→8→16 → blastocyst during transport, cut-away implantation in the lining, villi + early placenta, O₂/nutrients in, waste out, hormones |
| 3 | שליש ראשון | 64 | 32 | Embryo week 5.5→13: neural tube/brain glow, heart pulsing, limb buds → fingers separating, tail regresses, kidneys + urine, fingernails; then mother with 3D icons: nausea, fatigue, breast tenderness (soft rings), appetite |
| 4 | שליש שני | 96 | 26 | Week 14→27: bones harden (x-ray skeleton), sound ripples + head turn, kicks with uterine/belly bulge, flutters, belly rounds; back ache, stretch marks, facial pigmentation |
| 5 | שליש שלישי | 122 | 26 | Week 28→39.5: weight gain, lungs + alveoli insert with surfactant film, brain/nerves, the fetus turns head-down (cephalic), continued growth |
| 6 | השינויים בגוף האם | 148 | 50 | Blood volume ↑, cardiac output column 1→1.5×, progesterone particles, sphincter relaxes → reflux + heartburn glow, slower peristalsis, deeper breathing, uterus grows from pear size → diaphragm rises, lungs compressed, bladder pressed, pelvic joints/ligaments soften and widen |
| 7 | ההכנה ללידה | 198 | 22 | Baby settles lower, cervix shortens/thins (effacement), practice vs. regular contractions (bands travelling from the fundus) |
| 8 | לסיכום | 220 | 30 | One continuous morph from fertilized egg to term baby along a timeline of earlier stages; end card held 4 s |

## Medical-accuracy notes

- Gestational age is counted from the last menstrual period (LMP): weeks 1–2 are shown as pale
  pre-fertilization beads; fertilization is at about week 3. Trimesters: 1–13, 14–27, 28–birth (≈40).
- Fetal size follows standard crown-rump length values (e.g. 1.6 cm at 8 weeks, 5.4 cm at 12,
  16.4 cm at 20, 25 cm at 28, 36 cm at 40), head-to-body ratio decreasing with age. Late-pregnancy
  fetal scale is reduced ~10% so the flexed fetus sits inside the uterus without clipping.
- Uterine size tracks the fundal height landmarks (pubic symphysis ≈12 wk, umbilicus ≈20 wk,
  near the xiphoid ≈36 wk, slight descent near term).
- The head-down turn is shown for this fetus; the narration says *most* fetuses turn, and descent is
  described as happening "in many pregnancies".
- Scale exaggerations (egg, sperm and early cells are enlarged relative to the tube) are standard
  visualization conventions; no extra organs or positions are invented.
- References used: ACOG "How Your Fetus Grows During Pregnancy", ACOG "Changes During Pregnancy",
  OWH womenshealth.gov "Stages of Pregnancy", Merck Manual Professional "Physiology of Pregnancy".
  Please have a clinician review the stills before publishing.

## Re-rendering

```bash
npm i three@0.160.0 @fontsource/heebo@5.0.8      # into some folder, then:
export NODE_MODULES=/path/to/node_modules
node render.mjs out 24            # all chapters -> out/chapter_N.mp4 (needs Playwright + Chromium)
node render.mjs out 24 5,7        # only chapters 5 and 7
./snap.sh index.html "renderAt(12);;renderAt(40)" review   # quick stills contact sheet
```

`src/main.js` holds the timeline (one function per chapter); `src/fetus.js` the parametric fetus;
`src/mother.js` the mother, uterus and organs; `src/repro.js` chapter 2; `src/extras.js` the embryo
close-up, symptom icons, week beads, alveoli and summary timeline.
