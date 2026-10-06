# Native browser playtests — 5 October 2026

The current printed-sign follow-up passes eight native viewport checks for Tesla and the dedicated Munich radar, plus direct exhibit clicks, all four WASD directions, R reset and Escape exit. Each game now has a passive Game rules sign and the complete AI disclaimer, with 92px glyph ink (one third of the previous lettering). All 32 rules sets are checked against the catalog and simulation. Reader actions, popups and controls are removed; game mechanics are unchanged. Current evidence is in `/tmp/batikanor-game-evidence/printed-signs-20261005` and `/tmp/batikanor-game-evidence/game-rules-flow-20261005`. The all-game playthrough record below predates this sign replacement; it remains the verified record of unchanged gameplay.

The published staging revision independently passes native Tesla and Munich starts, inert sign clicks, all four WASD directions and unchanged authored popup copy, with no runtime or browser errors. Live evidence is in `/tmp/batikanor-game-evidence/live-game-rules-flow-20261005`. Production remains unchanged.

All 32 games pass the revised movement and facing checks, physical interactions through actual completion, reset before/after winning and Escape exit. There are 304 native screen-direction checks: W/A/S/D and all four arrows for every game, with Tesla and the dedicated Munich radar additionally checked at 30°, 90° and 180° camera bearings. Directional miniatures also face along their projected travel.

The browser was launched using agent-browser; CDP supplied trusted mouse and keyboard input, and scene/picker/projection observations were read-only. No direct simulation actions or state writes completed the playtests. All four routing games were retested on the final build after removing manual checkpoint snapping. The routing probe holds the key through a bounded renderer warmup before separately asserting sustained manual travel. Rotation puzzles wait for the visible spring to settle before asserting orientation.

Incorrect sockets, assembly stages, orientation and traversal order were checked where applicable. All four balancing games also pass retrieving a deposited physical resource for correction. Tesla and Munich separately pass real exhibit clicks that immediately activate the game and close the unchanged original popup; native W/A/S/D still works with the notes list focused.

| Project | Mechanic | Native direction checks | Minimum projected primary movement (px) | Minimum front/travel dot | Complete / restart / exit |
| --- | --- | ---: | ---: | ---: | --- |
| `tesla-gigathon-2026` | delivery | 32 | 5.72 | 0.998 | Pass / pass / pass |
| `hong-kong-talent-engage-eurotech-healthtech-2026` | optics | 8 | 5.18 | 0.993 | Pass / pass / pass |
| `decarbon-days-climathon-2026` | balance | 8 | 5.49 | 0.991 | Pass / pass / pass |
| `pdm-kill-the-search-bar-2026` | sort | 8 | 5.02 | 0.988 | Pass / pass / pass |
| `zero-one-hack-supercompute-industrial-2026` | assembly | 8 | 5.37 | 0.994 | Pass / pass / pass |
| `huawei-tech-arena-finland-2025` | morph | 8 | 5.19 | 0.998 | Pass / pass / pass |
| `real-coin-map-2025` | sort | 8 | 6.32 | 0.992 | Pass / pass / pass |
| `ethrome-2025` | assembly | 8 | 5.16 | 0.990 | Pass / pass / pass |
| `nasa-space-apps-zurich-2025` | routing | 8 | 5.03 | — | Pass / pass / pass |
| `sui-hackathon-poland-2025` | assembly | 8 | 5.28 | 0.997 | Pass / pass / pass |
| `decarbon-days-climathon-2025` | energy | 8 | 5.10 | 0.990 | Pass / pass / pass |
| `music-ai-osaka-2025` | trace | 8 | 5.16 | — | Pass / pass / pass |
| `european-defense-tech-2025-munich` | optics | 32 | 4.99 | 0.956 | Pass / pass / pass |
| `tech-berlin-ai-hackathon-2` | routing | 8 | 5.32 | — | Pass / pass / pass |
| `huawei-agorize-2024` | optics | 8 | 5.60 | 0.993 | Pass / pass / pass |
| `masters-thesis` | maze | 8 | 5.16 | 0.991 | Pass / pass / pass |
| `lauzhack-2024` | trace | 8 | 7.12 | — | Pass / pass / pass |
| `salzburg-tourism-2024` | routing | 8 | 22.42 | — | Pass / pass / pass |
| `zurich-climathon-2024` | balance | 8 | 8.20 | 0.999 | Pass / pass / pass |
| `bayer-ai-2024` | sort | 8 | 5.01 | 1.000 | Pass / pass / pass |
| `dsag-ideathon-2024` | routing | 8 | 21.34 | — | Pass / pass / pass |
| `circular-bsh-2024` | assembly | 8 | 8.17 | 0.999 | Pass / pass / pass |
| `thuega-2024` | energy | 8 | 6.50 | 0.999 | Pass / pass / pass |
| `solana-ideathon-2024` | balance | 8 | 6.50 | 0.999 | Pass / pass / pass |
| `six-swisshacks-2024` | assembly | 8 | 8.05 | 1.000 | Pass / pass / pass |
| `hackupc-2024` | flight | 8 | 6.88 | 0.997 | Pass / pass / pass |
| `mdsi-bundesliga-2024` | flight | 8 | 8.89 | — | Pass / pass / pass |
| `draeger-2023` | flight | 8 | 8.53 | — | Pass / pass / pass |
| `ethmunich-2023` | sort | 8 | 9.55 | 0.999 | Pass / pass / pass |
| `msg-karlsruhe-2023` | delivery | 8 | 6.78 | 0.999 | Pass / pass / pass |
| `bachelors-thesis` | sort | 8 | 6.61 | 0.997 | Pass / pass / pass |
| `tgu-perfect-gpa` | balance | 8 | 8.02 | 0.999 | Pass / pass / pass |

At the previous revision, eight additional sign checks covered standard and Munich scenes at desktop, normal portrait phone and two compressed viewports. Those reader controls and icon substitutions have since been removed; the current sign checks above supersede them.

Per-game native actions, screen movement, visible heading and screenshots are retained in `/tmp/batikanor-game-evidence/all32-direction-playtests.json` and its cited files. Sign evidence is in `/tmp/batikanor-game-evidence/sign-readability-20261005`; direct-click and focused-reader evidence is in `/tmp/batikanor-game-evidence/direct-click-direction-20261005`. These checks do not measure physical-phone frame rates.
