# Achievement signs and retained note metadata

## Current product behavior — 6 October 2026

Every project game has two passive printed signs outside its playable floor.
The first is titled “Game rules” and explains that game's actual click actions,
goal and movement controls. The second prints the complete notice: “This is
just an AI-generated game. It does not represent anything Batıkan did at this
event.” Clicking either sign opens no reader, popup or action.

Read excerpt / Read more, source-note cards, tabs, minus controls and reader
DOM are removed. The Inspect 3D exhibit summary button and duplicate Inspect
exhibit map action are also removed. A summary can remain open without
starting a game; clicking the physical exhibit starts play immediately.
Original project titles, prose, media, links and popup rendering remain
unchanged. Current behavior and verification are recorded in
[achievement-games.md](achievement-games.md).

## Retained source metadata

The two complementary `exhibitNotes` lists remain in the project source data,
but are not displayed on the game signs or in a reader dock. Their original
purpose was to separate inputs/methods/contributions from outputs,
implementation choices or limitations. Mentor/jury notes describe actual
contributions and credit another team's work where appropriate.

All 32 projects retain 346 explicit notes (previously 183). No project title,
description, photograph, video, link, venue or other existing field changed.
Full project popups and PDF exports still use their original fields. Notes are
separate metadata, not replacements for the author's full explanations or the
printed game rules.
The original 183 notes are preserved; 163 additional items add 10,704 characters
of useful source-backed detail. Total note text is 20,011 characters (2.15× the
previous 9,307), with at most nine items in a retained list and 86 characters
per item. Rich projects such as Hong Kong, Music AI and Dräger now have nine
items in each list; the NASA mentoring account stays at two per list
because its brief original account does not justify invented detail.

## Source format

`exhibitNotes` is optional structured data in the release's main project source
and its byte-identical Earth-engine mirror:

```js
exhibitNotes: {
  overview: [
    "Muse 2 records EEG while visitors view hobby-related images",
    "Extracted concentration and emotion features per image",
    "EEG features and neural networks estimate Big Five traits",
  ],
  details: [
    "LLM uses the EEG features and personality estimates",
    "RAG retrieves destinations from Austrian travel datasets",
    "Recommendations include an explanation from the LLM",
  ],
},
```

Use short plain-text items per list; the hard schema limit is 12 items
and 120 characters per item, three times the previous four-item capacity.
Use more detail where the original account supports it, not repeated facts or
invented filler to meet a quota. Do not put
bullet glyphs, Markdown, HTML, embeds, URLs or line breaks in source items.
Keep the two retained lists distinct and avoid repeating
the title, event date, award or the complete summary in pieces.

Every factual item must be supported by existing `shortDescription`,
`longDescription` or `technologies`. Preserve distinctions between concepts
and deployments, experiments and validated results, mentoring and authoring,
proposed and completed features. Illustrative model geometry is not evidence
of an actual implemented process—especially for confidential Tesla work.

The test-only `fixtures/exhibitNotesEvidence.json` records exact source quotes
for each item plus pre-note source/record hashes. Update evidence deliberately
with note edits. It is not imported into runtime code or published assets.
Content tests verify coverage, source evidence, concise/non-repeated items and
preservation of every pre-existing source byte and record field.

## Current signs and performance

Physical sign faces remain 3.3 m × 1.85 m. Native Arial starts at 85 px, with
each line's actual ink height normalized to 92 px, exactly one-third of the
previous 276 px Read Excerpt lettering. The rules sign has a gold heading and
four short lines; the AI disclaimer has six complete lines. Words remain
printed at every viewport size, without icon replacements. Wheel and pinch
zoom allow a closer view of the small print.

`exhibitGameSignContent.js` supplies immutable game-specific rules for all
32 projects and the shared disclaimer without importing the lazy game catalog.
The signs have no action IDs, links, touch/keyboard readers or full-project
buttons. Original project content remains available through the existing
project popup. There is no runtime summarizer or AI call.

The same two 1024 × 640 native canvases, 5,242,880 texture bytes, 92 sign
triangles and 5 sign draws are used. There are no additional textures, remote
fonts, model requests, render passes or camera-event canvas redraws. Existing
globe geometry, roof placement and model rendering budgets are unchanged.

## Historical monitor-note releases

The following dated records describe earlier monitor-list and reader
interfaces. Those displays and controls were replaced by the passive signs
above; the source-backed note metadata and historical validation results are
retained.

### Previous 183-note delivery — 2 October 2026

Staging release `20261002T110124Z-400703f340-3e6e60` passed 328 Earth tests,
18 repository tests, the Next static export, public Earth build, staging SEO
artifact checks and unchanged performance-asset budgets. An independent
reviewer audited every one of the 183 facts against the original account and
confirmed all 32 original records and media fields remain unchanged. Test-only
wide-text stress checks preserve complete items for every current list;
impossible future lists reject and release partial resources safely.

Native Chrome staging QA checked both Salzburg lists and the full-project
action on desktop, 390 × 844 portrait and 844 × 390 landscape viewports. Short
landscape readers scroll to additional items and the project button without
covering the close control or navigation. The original complete story and media
references remain available. No console errors were observed. Temporary
viewport overrides were reset; these are layout checks, not physical-device
performance benchmarks.

The live staging manifest matches the prepared artifact; production's manifest
remains unchanged. Changes are uncommitted and unpushed, deployed only to
staging. No production assets, DNS or hosting configuration were changed.

### One-third type, triple capacity and final expanded-note delivery — 2 October 2026

Staging release `20261002T130211Z-400703f340-e33787` contains this pass's
346 source-backed notes, 14 px physical monitor type and 12-item panel capacity.
Independent semantic review checked every one of the 163 added facts against
the unchanged original accounts and retained all 183 previous notes. One
newly redundant master's-thesis item was removed before delivery rather than
padding its panels. No original story, media, link, award or map field changed.

All 334 Earth checks and 18 repository checks passed on the final frozen source,
as did the Next static export, public Earth build, performance-asset audit,
staging overlay and SEO artifact checks. The separate independent focused
review passed 70 model/sign/reader/content checks, all 960 model/camera cases,
and exact full model/sign resource ownership for all 32 definitions.
Conservative wide-glyph checks fit every current list at 14 px without dropping
characters; deliberately impossible future lists fail transactionally.

Native Chrome staging QA confirmed Tesla's new craft details, two native 14 px
monitors and the unchanged full story with its loaded 1350 × 1800 prize photo.
Salzburg's actual 8/7-item panels stay at 14 px, with no overflow, while their
readers retain 15 px text. Desktop, 390 × 844 portrait and 844 × 390 landscape
checks confirmed the longer list scrolls and its full-project button stays
reachable, with the close button and chronology clear. The original complete
Salzburg text and media references remain available. Music AI's actual 9/9-item
panels also render at 14 px without overflow; its refined VR/instrument
assembly and original photo/media references were inspected on staging.
No console errors were observed. Temporary viewport overrides were reset;
these are layout/native rendering checks, not physical-phone FPS measurements.

The same sign texture sampling and resource bounds remain intact. The richer
models retain the unchanged GPU budgets; the CPU-only construction comparison
is documented in `capsule-style.md`. The public main JavaScript chunk increases
from 583.67 to 588.24 KB gzipped (about 4.57 KB for the added code/data); this
pass does not claim zero extra transfer bytes or unchanged device frame rates.

The live staging manifest exactly matches the prepared artifact:
`index-SYqgLqtH.js` / `main-BYlPO4Ph.js`. Production retains
`index-B3owTW7T.js` / `main-B8QOdbFy.js`, verified before and after deployment.
Only staging is published. Changes remain local, uncommitted and unpushed;
production, DNS and hosting configuration are untouched.
