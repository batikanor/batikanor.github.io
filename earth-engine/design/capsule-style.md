# Achievement capsule art direction

The repeatable outdoor square court and four decorative trees are replaced by a
glass exhibition globe. The actual project demonstration remains the subject;
the architecture is an explicitly illustrative installation, not a surveyed
building or a claim that an installation exists at the achievement venue.

## Anatomy

- The canonical 20 m globe is displayed at four times its original linear
  scale: 80 m diameter, centre 44 m and glass crown 84 m above its host roof.
  Scaling the existing assembly does not multiply geometry or texture memory.
- The 28.8 m internal exhibition floor is carried by a forked mast and three small
  footings. There is no opaque surrounding ground pad.
- Active rooftop access uses a short guarded bridge from the original portal
  landing to an exterior landing, followed by a terrain-adaptive ladder down
  to the ground. Its two independent shoes meet the sampled terrain beneath
  each foot, including on slopes; the ladder no longer ends above the roof.
  The 22-rung inclined assembly is retained only as a standalone preview
  fallback, not as the live rooftop ground connection.
- The genuine 12.8 m wide arched aperture and original entry landing remain
  intact. Its glass door is visibly swung open 65°.
- Continuous, 24-segment cradle-to-cradle meridians and one upper latitude halo
  articulate the glass silhouette. Sparse collar/support details vary across
  orbital, biological, energy, audio, engineering and ledger topic families.
- Authored demonstration geometry is preserved and enlarged with the globe.
  During a game it hides, and two passive printed signs appear on the rim
  outside the playable footprint. One says “Game rules” and explains that
  project's click actions, goal and movement controls. The other says
  “This is just an AI-generated game. It does not represent anything Batıkan
  did at this event.” Leaving restores the demonstration and removes the signs.
  The retained source-note metadata is not displayed on either sign.
  The 3.3 m × 1.85 m faces use the same two 1024 × 640 canvases. Native Arial
  starts at 85 px, with actual line ink normalized to 92 px, one-third of the
  previous 276 px Read Excerpt lettering. Rules have a gold heading and four
  short lines; the complete disclaimer has six lines. Words remain printed
  at every viewport size, without icon replacements or interactive readers.
- Each venue's longest mapped building hosts the globe. Length is measured in
  the footprint plane, not by roof height or floor area; the selected anchor
  stays inside the footprint. The real achievement pin does not move. Before
  local geography is available, no fictional host building is invented.
- Surveyed/compact mode retains the globe, doorway, grounded access and demonstration;
  it removes one meridian and optional rear collar details, not the experience.

## Glass and performance

The shell and open door share one front-sided transparent shader draw. A dark
teal Fresnel rim stays visible against bright roofs; a near-clear centre keeps
the demonstration readable. A controlled analytic pearly sky glint suggests
glass. The viewing-direction uniform is updated in place from public map
bearing/pitch measurements.

There is no physical refraction, framebuffer capture, transmission render
target, glass texture, decoder, network request or perpetual animation. This
avoids a second full-viewport render and prevents a refraction pass from losing
the MapLibre aerial background. The artistic reflection is deliberately not a
physically measured environment reflection.

The grounded-access release of 2 October 2026 measured a high-water across all
32 complete live exhibits, including its signs, game console and access, of
12,593 triangles, 810,272 bytes of geometry/instance buffers and 15 mesh draws.
Its combined limits were 13,500 triangles, 900,000 bytes and 16 draws; the
earlier 12,000-triangle ceiling excluded the ground-reaching attachment.
These are historical baseline measurements, not the current physical-game
budgets, which are documented in [achievement-games.md](achievement-games.md).
Glazing alone is unchanged at 2,097 triangles and 150,984 bytes.
Only the active achievement creates GPU geometry and sign textures; navigation,
home, detail opt-out and layer removal dispose owned resources.

The bespoke Munich defense radar retains its existing purpose-built scene.
Mapped buildings, genuine OSM trees, automatic arrival cameras and the original
project popups remain. Games are optional: a summary can stay open without
starting one. The Inspect 3D exhibit summary button and duplicate Inspect
exhibit map action are removed. Clicking any visible part of the physical
exhibit, including its glass shell, starts play and closes the project panel.
Objects and destinations respond to clicks; WASD/arrow keys move, E/Space
interact, R restarts and Escape leaves. Enter starts from a focused map canvas,
and wheel/pinch zoom remain available.

The Game rules and AI disclaimer signs have no actions or click IDs.
Read excerpt / Read more, source-note cards, tabs, minus controls and reader
DOM are removed. Original titles, paragraphs, links, photos, embeds and popup
rendering are unchanged. There is no HTML gameplay panel, projected Play
button or score screen. See [achievement-games.md](achievement-games.md) for
the current implementation and verification; the dated console and reader
records below describe earlier releases.

## Verification and dated release history

The release records below describe their checks, interfaces and budgets at the
time of each release on 2026-10-02. Their console, monitor-note and reader
behavior is historical and has been replaced by the current physical games
and passive signs described above. The final grounded-access record documents
the access anatomy and budget change at that time; later revisions do not
retroactively change its measurements or validation results.

Focused capsule and scene tests validate the real trimmed aperture, outward
face winding, unchanged demonstration containment, deterministic family
geometry, compact-mode access, one transparent draw, geometry budgets and exact
resource disposal. Native Three/MapLibre visual QA, including pale factory
imagery, drove the stronger dark rim and full-crown suspension treatment.

The first capsule release passed 283 Earth checks and 18 repository tests, the public
build, staging SEO checks and the performance-asset audit. Real runtime
regressions cover roof-supported PDM, NASA Zurich and Dräger framing as well
as cumulative subpixel reader movement, marker reuse and release.

Staging release `20261002T091325Z-400703f340-e6b93c` was checked in Chrome on
desktop, 390 × 844 portrait and 844 × 390 landscape. Tesla and NASA Zurich
inspection and excerpt controls work on the live preview. The active globe
uses one lightweight glazing draw; original roof sampling is unchanged.
Changes remain uncommitted and are not promoted to production.

### Four-times rooftop update — 2026-10-02

Staging release `20261002T100417Z-400703f340-daed7d` introduces the 4× assembly,
longest-building roof anchors and both internal lecterns. All 306 Earth tests,
18 repository tests, the public build, performance-asset audit and staging SEO
artifact checks passed. Independent checks compared all 1,696 real footprint
diameters and 10,000 seeded footprints with exhaustive measurement; 540 actual
roof/viewport/popup-shift camera cases fit their safe view bounds.

Arrival waits for the prepared real roof instead of first flying to an old
image centre. Project text and media open immediately, without that wait.
Inspection and settled popup repositioning refit the full enlarged assembly;
native image-quality zoom limits remain in effect. Reader controls follow the
actual raised sign projection rather than a ground-level map marker.

Live staging Chrome QA confirmed Tesla's 341 m host building, 4× scale,
full-crown inspection and both original-prose readers on desktop, 390 × 844
portrait and 844 × 390 landscape viewports. Opening the full project restores
its unchanged text and prize photo. Local high-roof Real Coin inspection and
popup-side arrival were also visually checked. Responsive viewport checks are
not a physical-device performance benchmark.

The public staging manifest matches the prepared artifact; production's
manifest remains unchanged. This update remains uncommitted and unpushed.

### More comprehensive demonstrations — 2026-10-02

All 32 procedural demonstration definitions now include connected explanatory
systems, rather than isolated topic tokens. Examples include Tesla's scanning
arch, forklift, transfer conveyor and loading/routing bays; Vienna's wafer
cassette, transfer gripper and HPC sequence rack; NASA Zurich's observation
optics, wing/feed trusses and geography tile table; Real Coin's specimen
drawers, optical gantry and geometric coin reliefs; and Salzburg's EEG feature
extraction and recommendation pipeline. The 2026 jury's cheque and the GPA
hourglass are explicitly supported by the author's original explanations.

These are still illustrative public models, not reconstructions of confidential
Tesla equipment/data, a real spacecraft built by the author, historically
identified coins or actual medical measurements. Original site copy, media,
event pins, longest-roof selection, 4× orb dimensions and interior sign
positions are unchanged. The separate bespoke Munich radar remains preserved.

More meaningful geometry replaces expensive cosmetic torus details: parcel
bows have flat ribbon folds, and coins have solid layered rims and milled edge
details. The complete-model geometry high-water remains below the prior pass.
There are no new model downloads, textures, render passes or animation loops;
Finland and NASA use one additional existing-material batch each. Only the
active project owns GPU geometry and the same two native sign textures.

The first complete-pass local Node benchmark measured 320 warmed constructions
and disposals: median 2.920 ms, p95 4.607 ms, versus prior 2.562/3.706 ms.
This excludes native canvas, WebGL and device GPU performance; it is not a
physical-phone benchmark. Exact default arrival/inspection sign clearance and
all lifted geometry's containment within the 10 m canonical glass sphere are
checked independently, in addition to the unchanged memory/draw/resource tests.

The final placement pass moves jury microphones rearward on their desks,
departure gates inward and the front thesis pendulum onto a properly supported
rear extension. A durable exact triangle/board test covers 960 combinations
of all 32 models and 30 camera poses against the previous source's recorded
contact masks: there are no newly affected poses. Default 42° bearing / 54°
pitch remains clear for every model. Free-rotation billboard sweeps can still
intersect older foreground props in 12 scenes at other angles; this is not a
claim that the existing sign mounting system is universally collision-free.

Staging release `20261002T104126Z-400703f340-a8dc37` passed all 314 Earth tests,
18 repository tests, the public build, unchanged performance-asset budgets and
staging SEO artifact checks. Its public manifest matches the prepared artifact;
the production manifest is unchanged. Native Chrome staging QA confirmed the
richer Tesla machinery, smaller physical sign text, original excerpt reader
and unchanged complete project/prize photo on desktop, 390 × 844 portrait and
844 × 390 landscape viewport layouts. Temporary viewport overrides were reset.
Live NASA Zurich inspection also confirmed its observation optics, trussed
solar wings and geography table; the original mentor certificate still loads.
No console errors were observed during these deployed exhibit checks.
Local visual checks additionally covered Vienna, NASA Zurich, Salzburg and
the Cottbus jury model. These are responsive viewport checks, not a physical
mobile-device frame-rate benchmark. Changes remain uncommitted and unpushed;
this release is staging-only.

### Close-up craftsmanship and denser monitors — 2026-10-02

This pass keeps every prior model kind and meaningful named component, and adds
68 object-specific craft components across the 32 procedural definitions:
Tesla tread blocks, mast hydraulics, steps and rack bracing; semiconductor
wafer clamps and gripper fasteners; satellite hinge brackets, radiator fins and
optical collars; camera calibration fittings, EEG electrodes and acquisition
controls; archival drawer grips, football goal netting and academic hourglass
collars. The separate existing bespoke Munich radar scene is still preserved.

The VR pen's recessed infrared windows, collar and tip now follow its actual
rotated axis instead of floating beads. A flat arched adjustable headset band
replaces a purely cosmetic round strap, maintaining its silhouette while
funding recognizable speaker controls. Machinery and signal traces remain
explicitly illustrative, not evidence of proprietary Tesla systems, a
spacecraft the author built, actual medical measurements or clinical validation.

The temporary primitive-command ceiling increases from 200 to 240 to allow
these small assembled details; actual maximum is 232. This is a construction
CPU limit, not a relaxed GPU budget. The complete 12,000-triangle, 900,000-byte
and 15-draw budgets remain unchanged, with no additional model downloads,
textures, render passes or animation loops. Only the active exhibit owns GPU
geometry and the same two 1024 × 640 sign canvases.

At this craft-only release, before the grounded access and game console,
Tesla measured 11,881 triangles and 852,752 bytes including both signs;
the 32 definitions used at most 14 draws. These historical measurements
precede the combined live limits in the current record below.

An independent alternating benchmark of 320 actual complete capsule builds
per version, using the same frozen host after two warmup passes, measured
median construction 3.037 → 3.184 ms and p95 4.551 → 5.237 ms. The median
increase is 0.147 ms and p95 increase 0.686 ms. These CPU-only local Node
measurements exclude native canvas, WebGL and device GPU performance; they are
not physical-phone frame-rate claims.

All 960 model/camera combinations were independently checked against the
already-rich source immediately before this pass, not an older more permissive
first-pass baseline. NASA and Solana both retain their stricter zero-contact
masks. There are no newly affected camera poses; all models are clear in the
default 42° bearing / 54° pitch view. Existing other-angle mounting limitations
in 12 scenes remain documented above. Geometry stays within the glass sphere
and owned resources are released exactly once.

Staging release `20261002T130211Z-400703f340-e33787` includes this craft pass
and the smaller, denser source-backed monitor notes. All 334 Earth tests,
18 repository tests, both builds, performance-asset audit and staging SEO
checks passed. Independent review confirmed all 32 original model kinds and
meaningful components, 960 camera cases and exact geometry/material/sign
texture disposal. Native Chrome staging inspection covered Tesla, Salzburg
and Music AI, including portrait and landscape note-reader layout checks;
no console errors were observed. Temporary viewport overrides were reset.
The live staging artifact matches its prepared manifest and production's
manifest remains unchanged. Changes are uncommitted and unpushed, staging only.

### Historical: ground-reaching access and project-game consoles — 2026-10-02

Staging release `20261002T151509Z-400703f340-fa267b` replaces the live
roof-relative ladder with a short guarded horizontal bridge and exterior
ground-reaching ladder. The bridge joins the original portal exactly and
stays above the host roof until its exterior landing. Deterministic planning
places the entire landing and both ladder shoes outside the host and supplied
nearby mapped footprints, allowing short forward-side routes where a direct
forward exit is blocked. The longest-roof anchor and actual event pin do not
move. The standalone preview can still use the original inclined ladder;
the live assembly omits only its 22 rungs, two rails and two grab segments.
The globe, floor, doorway, existing landing guards, suspension, original
demonstrations and two project-note monitors are preserved.

Grounding uses a centre sample plus independent samples beneath both shoes,
relative to the chapter-origin terrain. The scene's existing 12 cm drawing
offset is subtracted so each shoe's **bottom**, rather than its centre, meets
the actual sampled ground. Terrain-source changes and settled navigation
refresh those heights; a changed origin sample observed during rendering
schedules a coalesced update outside the frame. Identical samples retain the
existing attachment. Navigation and removal invalidate queued work and dispose
the old instance buffers, geometry and material. No per-frame geometry rebuild,
animation loop or perpetual repaint is introduced.

Missing DEM samples use the currently rendered flat or centre-height fallback,
with flat/pending provenance recorded explicitly. When individual samples
arrive, they replace the fallback rather than inventing a surveyed ground
height. Steep rising terrain can raise the bridge and add a portal-side ladder
section while preserving the real supplied endpoint. All 30 current mapped
exit corridors were independently checked and are clear. This is illustrative
access, not a surveyed walking route: landing-footprint clearance does not
guarantee that unknown or future taller neighbours cannot obstruct a bridge.

The attachment has its own finite one-material, one-instanced-draw budget:
at most 96 rungs, 24 deck slats, 150 box instances, 1,800 rendered triangles
and 14,000 bytes. Extreme heights increase rung spacing rather than allocating
unlimited geometry; both ground endpoints remain exact. Across the current
32 locations the measured maximum is 124 instances, 1,488 triangles and
12,240 bytes in one draw. The tallest selected host roof is 90 m; a taller
unrelated building never determines the globe's support height.

A tiny six-part console inside each standard globe adds only 72 triangles,
batched with existing materials, without a new image, texture or render pass.
Its Play control opens one intent-loaded, optional project minigame; the
bespoke Munich radar reuses its existing console instead. The projected control
follows the actual current 3D frame and console location. Game sessions remain
local to the visit, and reopening or changing projects cannot revive detached
controls from an earlier panel. Native range controls retain focus and drag
continuity; compact layouts keep the close button available and the content
scrollable without covering the achievement chronology. Original project
copy, media, full-project access and the special Munich scene are unchanged.

The complete active-globe high-water is **12,593 triangles, 810,272 bytes and
15 draws**, within the current combined **13,500-triangle, 900,000-byte and
16-draw** limits. Only the active project owns this geometry. These figures
include the grounded attachment, console and both signs; they do not claim the
previous combined 12,000-triangle ceiling is unchanged. Existing sign texture
sampling and native aerial-image quality are not reduced to fund the access.

The final prepared release passed 395 Earth tests and 18 repository tests and
was deployed successfully to staging. Focused and independent checks cover
all 32 grounded endpoints, slope/negative/extreme-height cases, current mapped
footprint clearance, finite resource budgets, disposal and cancelled queued
updates, single game-panel/marker ownership, stale reopened controls and valid
console projection. Local warmed CPU measurements for 150 access
plan/resolve/build visits were median 0.265 ms and p95 0.635 ms; these exclude
native canvas, WebGL and device GPU work and are **not phone frame-rate claims**.
Native staging checks confirmed the complete Tesla globe, exterior bridge and ground-reaching ladder beside the game panel, with origin/foot/both-shoe terrain samples complete; the final release also passed keyboard continuation and Escape focus restoration. Desktop, portrait and short landscape game layouts were checked, with details in `achievement-games.md`. This record is staging-only;
it does not assert a production promotion, commit or push.
