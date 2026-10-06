# Physical games in the project exhibits

All 32 projects now have a physical game played on their existing 3D exhibition floor. The former HTML game panel, projected Play button, instructions, scoring text, sliders and answer controls are removed. Games share the existing MapLibre/Three renderer and canvas.

Click anywhere on the visible 3D exhibit, including its glass shell, to start. The existing project panel closes and the camera moves directly into the play area. Click objects and destinations, or move with WASD/arrow keys and use E/Space to interact with nearby objects. Enter starts from a focused map canvas, R restarts, and Escape leaves. Wheel and pinch zoom remain available. Touch uses object and floor taps; there are no added game buttons.

Existing project titles, paragraphs, links, photos, embeds and popup rendering are preserved. Two printed signs appear only during play, mounted on the rim outside the playable footprint. One says “Game rules” and explains that specific game's click actions, goal and movement controls. The other says “This is just an AI-generated game. It does not represent anything Batıkan did at this event.” Both are passive physical objects. The Read excerpt / Read more controls, source-note cards, tabs and minus control are removed. Leaving restores the original demonstration and removes the signs. The bespoke Munich radar and its Scan interaction remain available.

## Visual rules

Each game uses recognizable project objects, colored and shaped destinations, hover halos, ghost silhouettes, connecting rails or beams, and a finite completion effect. Matching puzzles use shape motifs as well as color. Wrong placements can be corrected without opening a menu. Rules are printed directly on the physical sign; there are no tutorial popups, game buttons or score screens.

Physical signs retain their 3.3m × 1.85m faces at the floor rim and their two existing 1024 × 640 canvases. Native Arial starts at 85px, with each line's actual ink height normalized to 92px: exactly one third of the previous 276px Read Excerpt lettering. The rules sign has a gold heading and four short lines; the disclaimer has six complete lines. Words remain printed at every viewport size, without icon replacements. The camera fits the full available game area and refits after map or navigation size changes. Viewports at most 360px high fold chronology/context controls only while playing and restore them on exit. Wheel and pinch zoom allow a closer view of the small print.

These are authored miniature interpretations of the public project themes. They do not reproduce confidential systems, medical measurements, financial transactions or real-world evaluations. The catalog uses no network service or user data.

## Coverage

| Existing project slug | Physical activity |
| --- | --- |
| `tesla-gigathon-2026` | Drive a forklift around racks, collect pallets and deliver to matching docks. |
| `hong-kong-talent-engage-eurotech-healthtech-2026` | Turn lenses and a mirror to connect the camera beam to its capture receiver. |
| `decarbon-days-climathon-2026` | Carry pitch orbs into four wells to grow a balanced pitch garden. |
| `pdm-kill-the-search-bar-2026` | Reconcile directory blocks with matching architectural silhouettes. |
| `zero-one-hack-supercompute-industrial-2026` | Assemble wafer-processing parts in their ordered sockets. |
| `huawei-tech-arena-finland-2025` | Rotate and unfold globe tiles into matching flat map sockets. |
| `real-coin-map-2025` | Sort physical coins by their relief motifs into specimen sockets. |
| `ethrome-2025` | Assemble complementary gifts into a pooled gift sculpture. |
| `nasa-space-apps-zurich-2025` | Turn a globe, satellite and mentoring-resource relay into a continuous signal path. |
| `sui-hackathon-poland-2025` | Join complementary patterned blocks into compound assemblies. |
| `decarbon-days-climathon-2025` | Couple battery, turbine and factory controls to fill three load wells. |
| `music-ai-osaka-2025` | Guide a pen through a rising frequency ribbon in space. |
| `european-defense-tech-2025-munich` | Align a miniature radar display beam through lenses and mirrors. |
| `tech-berlin-ai-hackathon-2` | Route a signal through physical context and explanation nodes. |
| `huawei-agorize-2024` | Align three capture cameras around an ear model. |
| `masters-thesis` | Guide a robot through changing corridors and ordered checkpoints. |
| `lauzhack-2024` | Trace a handwriting path above a classroom page. |
| `salzburg-tourism-2024` | Connect signal acquisition, features and scenery nodes into a relay. |
| `zurich-climathon-2024` | Feed droplets into a balanced anonymous-survey grove. |
| `bayer-ai-2024` | Sort image, helix and document objects into matching laboratory sockets. |
| `dsag-ideathon-2024` | Connect the chronological context circuit and steer its packet. |
| `circular-bsh-2024` | Recover appliance components and move them into their reuse slots. |
| `thuega-2024` | Couple solar, storage and turbine outputs to meet three load wells. |
| `solana-ideathon-2024` | Move crystals into two equally filled balance pans. |
| `six-swisshacks-2024` | Build a reporting machine from document, framework and analysis parts. |
| `hackupc-2024` | Fly an airplane through a raised route around a miniature globe. |
| `mdsi-bundesliga-2024` | Guide a football through tactical lines around defenders. |
| `draeger-2023` | Guide an abstract signal through progressively raised horizon rings. |
| `ethmunich-2023` | Match faceted, bowed and open-frame gallery objects to their sockets. |
| `msg-karlsruhe-2023` | Drive a green-route car around islands and deliver matching cargo. |
| `bachelors-thesis` | Match cats to noseprint shape motifs. |
| `tgu-perfect-gpa` | Carry books into balanced study stacks. |

## Implementation and verification

- `exhibitGameCatalog.js` contains all 32 immutable authored layouts across 11 mechanics.
- `exhibitGameSimulation.js` handles local movement, collisions, interactions, recoverable mistakes, progress and completion.
- `exhibitGameObjects.js` builds shared vertex-colored geometry, interactive miniatures, feedback and finite animation. It adds no texture download or separate renderer.
- `exhibitGameRuntime.js` owns one active simulation and requests frames only while movement, interpolation, timers or effects need them.
- `exhibitGameAttachment.js` attaches the runtime to the existing exhibit, inverts its actual projection for picking, cancels stale loads and retains state through scene rebuilds.
- `exhibitGameControls.js` owns native canvas clicks and keyboard input, temporarily disables conflicting map gestures and restores their previous state on exit.
- `exhibitGameCamera.js` fits the playable volume between the existing header and chronology across desktop, portrait and landscape viewports, including elevated roof anchors.
- `exhibitGameSignContent.js` provides immutable, game-specific rules for all 32 projects and the shared AI disclaimer without importing the lazy game catalog.
- `achievementSigns.js` prints the two passive sign faces with no action IDs or reader interaction.
- `exhibitInspectionCamera.js` retains the original exhibit inspection and capsule fitting helpers. The former `exhibitReader.js` and its reader UI are removed.

Automated simulation checks complete all 32 games through real actions. Runtime checks cover zero-delta initial frames, autonomous movement after key release, hold-to-complete behavior and eventual idle rendering. Picking tests cover perspective, scaled/reflected elevated roots and hidden objects. Lifecycle checks cover stale loading, detach/reattach, restoration and resource disposal. Geometry tests bound every initial and completed game below 50 mesh draws and 18,000 triangles; current completed high-water is 40 draws and 15,592 triangles.

The project-data and full-project content-renderer hashes are checked against the files captured before this replacement; the source prose is unchanged. Viewport checks do not establish physical-phone frame rates.

## Printed game rules revision — 5 October 2026

Release `20261005T202712Z-400703f340-a971c4` replaces both source-note actions with the printed Game rules and AI disclaimer signs on staging only. No sign click opens a popup, starts an action or changes the game's objects. Reader DOM, styles, focus-key forwarding and sign-action interception are removed. All 32 rules sets are checked against their actual catalog goals and simulation actions. Game mechanics and the previously verified movement fixes are unchanged.

The final source passes 401 automated Earth tests, with one optional offline original-image-cache check skipped, plus the public build, staging SEO and performance-asset audit. Eight native viewport checks cover Tesla and the dedicated Munich radar at 1280 × 900, 390 × 844, 568 × 320 and 390 × 320. All sixteen projected boards remain unclipped and outside the game pieces; their clicks preserve object transforms and progress. The signs retain their two textures, 5.24 MB texture budget, 92 triangles and five mesh draws.

Native exhibit clicks also verify immediate start, unchanged original popup copy, all four WASD directions and key release. A further R/Escape check verifies reset, sign removal, restored navigation and released map input locks. Evidence is retained in `/tmp/batikanor-game-evidence/printed-signs-20261005` and `/tmp/batikanor-game-evidence/game-rules-flow-20261005`. This revision adds UI checks without repeating the prior 32 full playthroughs and 304 direction assertions below.

The live homepage, manifest, bootstrap, map and lazy game module byte-match the prepared artifact. The staging noindex header is present, and production's manifest remains byte-identical to the pre-deployment snapshot. Verification is recorded in `/tmp/batikanor-game-evidence/game-rules-live-verification.json`. The lazy game bundle is 50.86 kB minified / 18.22 kB gzip. The three authored-content source hashes remain unchanged. Changes remain uncommitted and unpushed.

An independent live-staging check also passes native Tesla and Munich exhibit clicks, both passive sign clicks, all four WASD directions and clean key release. The original authored popup copy remains identical, excluding only its existing transient media-loading status. Exactly two printed signs appear, with the complete rules and disclaimer, no action IDs and no reader DOM. No runtime or browser errors were observed. Live evidence is retained in `/tmp/batikanor-game-evidence/live-game-rules-flow-20261005`.

## Optional game entry revision — 6 October 2026

The achievement summaries no longer inject an Inspect 3D exhibit button. The duplicate Inspect exhibit map action, its listener/visibility handling, styling and unused inspection function are also removed. The existing automatic arrival camera, original project content, chronology, Drive/Scan actions and native keyboard access remain available. Visitors can leave a summary open without entering a game; clicking the physical exhibit still starts play immediately.

Validation passes 55 relevant arrival, camera, transition, game-control and attachment tests, plus the public build, performance-asset audit and staging SEO check. Three obsolete tests for the removed inspection function were retired; the automatic-arrival checks remain. Native Tesla and Munich checks verify no inspection controls anywhere, inactive games after ten seconds with the summary open, and actual exhibit clicks that activate the game, close the unchanged authored popup and display both printed signs. No runtime exceptions were observed. Evidence is in `/tmp/batikanor-game-evidence/no-summary-inspect-native-20261006`. Changes remain uncommitted and unpushed.

Release `20261006T090505Z-400703f340-591bcd` publishes this removal to staging only. The live homepage, manifest, bootstrap, map and lazy game module byte-match the prepared artifact, with staging noindex present and the production manifest unchanged. Live artifact verification is in `/tmp/batikanor-game-evidence/no-summary-inspect-live-verification.json`. All three original project-content source hashes remain unchanged.

Both native flows also pass on the live release: no inspection controls, inactive games while summaries remain open, immediate exhibit-click entry, unchanged popup prose and no runtime exceptions. Live browser evidence is in `/tmp/batikanor-game-evidence/live-no-summary-inspect-native-20261006`.

## Earlier release history

The following dated notes describe previous staging revisions; their reader controls were removed by the printed game rules revision above.

## Staging delivery — 5 October 2026

Release `20261005T104203Z-400703f340-9f6d45` replaces the former form-based games on `https://staging.batikanor.com/` only. Production’s manifest was checked before and after publication and is unchanged. The live homepage, bootstrap, map and lazy game module byte-match the prepared artifact, and the staging noindex header is present. Changes remain uncommitted and unpushed.

Validation passed 395 Earth tests and 18 root tests, both public/static builds, the performance-asset audit and staging SEO checks. One optional original-PNG-cache test was skipped because the offline authoring cache is absent; deployed release assets still pass their independent content-hash checks. The lazy physical game bundle is 50.63 kB minified / 18.15 kB gzip. The existing large map-bundle warning remains.

Clean-build Chrome checks covered desktop 1280 × 633, portrait 390 × 844 and landscape 844 × 390. Actual mouse input picked up and delivered Tesla cargo, reaching 1/3 progress; trusted sustained W input moved the forklift and release cleared held keys. Actual mouse clicks completed the Hong Kong optics path. R reset completion, Escape released the game and map input locks, and the original signs restored. Console and page-error logs were empty. Active games also refit after a viewport resize.

A fresh live-staging check also started Tesla’s game through a real click on its demonstration (without using the debug start function). The opened game reports zero panels and nine visible physical objects. A note-reader marker continues to open its existing unchanged excerpt; clicking the actual demonstration starts play.

## Reader and playtest revision — 5 October 2026

The reader dock belongs to the active game only. It defaults to two compact tabs, keeps at most one excerpt open, and uses a separate side rail or bottom tray. Displays at most 360px high keep the collapsed and expanded readers in a narrow side rail, with chronology/context controls folded during play and restored on exit; expanded compact readers keep the selected tab and minus control; the whole excerpt remains scrollable so its full-project action cannot be clipped. ResizeObserver tracks attribution, navigation and header size changes, including wrapped map credits.

Native browser playtests use the actual canvas, trusted mouse and sustained keyboard events, read-only scene observations and per-game screenshots. Each game is checked for WASD movement, physical interactions, completion, R reset and Escape exit; matching/traversal tests also try incorrect placements or order. These checks found and fixed balance tokens dropping immediately back into their source well, deposited tokens sitting inside receivers, stationary dock clicks cancelled by a moving actor, and distant-venue access sampling against stale terrain tiles. Only the specific stale-DEM RangeError becomes a pending sample; other errors still propagate.

Per-game evidence is retained under `/tmp/batikanor-game-evidence/playtest-20261005-final`, `playtest-20261005-fixed`, `playtest-20261005-settled4`, `playtest-root-20261005` and `playtest-root-final-20261005`. The consolidated record is `/tmp/batikanor-game-evidence/all32-final-playtests.json`.

Final native playthrough coverage is **32/32 passed**: sustained keyboard movement, physical interactions through actual completion, restart before/after winning and Escape exit. All four resource-balancing games also passed retrieving a deposited mesh for correction. The per-project results are recorded in [game-playtest-20261005.md](game-playtest-20261005.md). The dedicated radar additionally passed uninterrupted default arrival and Tesla-to-Munich navigation through the actual explorer UI, followed by native exhibit click and held-D movement. Slow imagery no longer hides that radar while its original project notes are open.

Reader QA passed desktop, 390 × 844 portrait, and 390 × 320/568 × 320 compressed layouts. The compressed collapsed rails measure 172×72px and 257×72px; expanded articles preserve 101–141px of useful scrolling height, and full-project actions remain fully visible after scrolling. The native minus control, physical sign reopening and focused-note Escape cleanup all passed. Original project-data and full-project renderer hashes remain unchanged.

Release `20261005T133308Z-400703f340-c7ea64` publishes this revision to staging only. The live homepage, bootstrap, map runtime and lazy game module byte-match the prepared artifact; the production manifest is unchanged. A live native Tesla exhibit click starts immediately, closes the original popup without changing its text, shows both game signs, and opens/collapses the 22.5px note reader. Browser errors are empty. Validation passes 405 Earth tests and 18 root tests, with one optional offline original-image-cache check skipped, plus the public build, staging SEO and performance-asset audit. The game bundle is 50.82 kB minified / 18.21 kB gzip. Changes remain uncommitted and unpushed.

## Movement and sign legibility revision — 5 October 2026

The miniature vehicles' authored front pointed along local −Z while simulation yaw represents local +Z. Actor bodies now rotate by π within their parent; steering, collision coordinates, puzzle arrows and destination orientations retain their existing basis. Camera-relative input already mapped correctly in the standard reflected scene and the dedicated radar scene. Projection tests cover every catalog actor at five camera bearings, and native checks compare screen travel to the visible vehicle front.

WASD, E and R also work while the non-editable project-note reader has focus. Arrow keys retain reader scrolling, and native buttons retain their keyboard activation. Manual routing no longer snaps a controlled packet to a nearby checkpoint; node registration preserves the player's exact position and yaw, and releasing movement resumes the automatic route. Regression checks exercise all four routing layouts in all cardinal directions, continued manual travel and subsequent automatic completion.

Eight native sign checks cover Tesla and the dedicated radar at 1280 × 900, 390 × 844, 568 × 320 and 390 × 320. Visible lettering measures 36.46–37.82px on desktop and 12.08–12.20px on normal portrait phones; short viewports use page/book symbols. Every case opens the physical excerpt sign, collapses with the minus control, and reopens the physical Read More sign. Projected signs remain outside game pieces in collapsed and expanded states. Both existing 1024 × 640 textures are reused, without additional GPU allocations. Evidence and screenshots are retained in `/tmp/batikanor-game-evidence/sign-readability-20261005`.

The final source passes 412 Earth tests, with one optional offline original-image-cache check skipped, plus 18 root tests, the authored-data/building validators, performance-asset audit, public build and staging SEO checks. The lazy game bundle is 50.86 kB minified / 18.22 kB gzip. Original project-data and full-project renderer hashes remain unchanged.

The revised native sweep passes **32/32 full playthroughs and 304 screen-direction assertions**. Every game covers W/A/S/D and all four arrows; Tesla and Munich additionally cover 30°, 90° and 180° bearings, visible vehicle heading and obstacle-aware floor steering. All four routing games pass final-build retakes, and all four balancing games retain physical resource recovery. Both scene types pass real exhibit clicks that immediately activate controls and close the unchanged popup, then focused-reader WASD, sign opening, minus collapse and sign reopening. No runtime or console errors were observed. The consolidated record is `/tmp/batikanor-game-evidence/all32-direction-playtests.json`; detailed results are in [game-playtest-20261005.md](game-playtest-20261005.md).

Release `20261005T143722Z-400703f340-15fe26` publishes the movement and legibility fixes to staging only. The live homepage, release manifest, bootstrap, map and lazy game module byte-match the prepared artifact. The staging noindex header is present, and production's release manifest remains byte-identical to its pre-deployment snapshot. Verification is recorded in `/tmp/batikanor-game-evidence/direction-final-live-verification.json`. Changes remain uncommitted and unpushed.

The live release additionally passes native Tesla and Munich exhibit clicks, physical sign opening/collapse/reopening, and all four WASD directions with the notes list focused. Authored popup text remains identical; the existing asynchronous “Loading media…” status is excluded from the copy comparison when an image finishes loading. Raw comparisons and live native evidence are retained in `/tmp/batikanor-game-evidence/live-direct-click-direction-20261005`.
