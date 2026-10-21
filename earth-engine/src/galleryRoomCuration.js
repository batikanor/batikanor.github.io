/**
 * Editorial desktop wall preferences, reviewed against the authored stories,
 * verified photo dimensions and the owner's Tesla wall screenshot, 16 Oct 2026.
 *
 * A wall is a composition, not a collection of equal-size slots. For each new
 * achievement, inspect its real media and review the resulting desktop and
 * phone screenshots. Give the useful photo, demonstration or document enough
 * space to communicate. Grow caption/credit rows into available space before
 * introducing scrolling, without shrinking the photograph or its type. Do not
 * reward an empty description board merely for
 * its area. Portraits can use the full height beside the story, while slides
 * and videos need broad screens. Check caption/footer space and the map lane.
 *
 * These are presentation preferences, not authored content or fixed coordinates.
 * Keep source URLs, prose, captions, credits, component order and mobile inline
 * media positions intact. Stable media keys identify the source even when its
 * authored placement order differs from its source-array order. The responsive
 * solver must still reject collisions and fall back when a composition cannot
 * fit. A preferredAspect describes a document/video viewport, never permission
 * to crop or stretch a photograph; verified intrinsic photo dimensions win.
 *
 * The current review includes a supplied screenshot and source/geometry checks;
 * it does not claim rendered browser screenshots of all 32 projects.
 */

function profile(family, leadMedia, rationale, preferredAspect) {
  return Object.freeze({family, leadMedia: Object.freeze(leadMedia), rationale,
    ...(preferredAspect ? {preferredAspect: Object.freeze(preferredAspect)} : {})});
}

export const GALLERY_WALL_CURATION = Object.freeze({
  'tesla-gigathon-2026': profile('portrait-led', ['embed:0'],
    'The prize portrait should fill the available height left of the short story, rather than become a thumbnail above the globe.'),
  'hong-kong-talent-engage-eurotech-healthtech-2026': profile('story-led', ['embed:0', 'embed:1'],
    'Keep the detailed trip and health-tech narrative readable, with a broad pitch screen, wide delegation photograph and complete References.',
    {'embed:1': 16 / 9}),
  'decarbon-days-climathon-2026': profile('paired-photos', ['embed:0', 'embed:1'],
    'The jury and winning-team photographs deserve equal prominence as a landscape pair beside or below the story.'),
  'pdm-kill-the-search-bar-2026': profile('media-led', ['embed:0'],
    'Give the first-place certificate a useful document viewport beside the account of the competition and its References.',
    {'embed:0': 4 / 3}),
  'zero-one-hack-supercompute-industrial-2026': profile('story-led', [],
    'This account has no embedded media; devote the wall to readable technical copy and its complete References.'),
  'huawei-tech-arena-finland-2025': profile('media-led', ['embed:0'],
    'The verified landscape certificate is the main visual evidence; keep it large with its native aspect beside the Gralobe story.'),
  'real-coin-map-2025': profile('media-led', ['embed:0'],
    'A broad pitching-video screen communicates the result better than a tall generic viewer beside the short account.',
    {'embed:0': 16 / 9}),
  'ethrome-2025': profile('media-led', ['embed:0'],
    'The two-minute SecSanta pitch needs a broad playable screen, with enough story and References space to explain the idea.',
    {'embed:0': 16 / 9}),
  'nasa-space-apps-zurich-2025': profile('media-led', ['embed:0'],
    'Let the mentor certificate lead; the brief mentoring description does not need an oversized empty board.',
    {'embed:0': 4 / 3}),
  'sui-hackathon-poland-2025': profile('gallery-led', ['embed:3', 'embed:0'],
    'Use the trophy photograph and scissors portrait as distinct anchors, with the sleeping portrait and group photograph retaining their own proportions.'),
  'decarbon-days-climathon-2025': profile('gallery-led', ['embed:0', 'embed:1'],
    'Feature handing the award to the winners and the group photograph, while preserving all five scenes and their credits.'),
  'music-ai-osaka-2025': profile('gallery-led', ['embed:0', 'embed:2'],
    'Feature the winner-card photograph and working demo, with the temple group, interface and other photographs supporting the substantial narrative.',
    {'embed:2': 16 / 9}),
  'european-defense-tech-2025-munich': profile('portrait-led', ['embed:0'],
    'The tall radar-system photograph should stand beside the technical story and a broad pitch-deck viewer.',
    {'embed:1': 16 / 9}),
  'tech-berlin-ai-hackathon-2': profile('gallery-led', ['embed:2', 'embed:0'],
    'Give the app demonstration and architecture diagram broad native-aspect space; the pitching photograph and slides support them.',
    {'embed:3': 16 / 9}),
  'huawei-agorize-2024': profile('gallery-led', ['embed:2', 'embed:0'],
    'Feature the landscape award photograph beside the method slides, keeping the portrait and remaining source visible as supporting evidence.',
    {'embed:0': 16 / 9}),
  'masters-thesis': profile('story-led', [],
    'A text-led research wall should explain TEA clearly and retain its paper reference without inventing a visual hero.'),
  'lauzhack-2024': profile('media-led', ['embed:0'],
    'The playable VR-classroom demonstration is the main visual and needs a landscape video screen beside the explanatory story.',
    {'embed:0': 16 / 9}),
  'salzburg-tourism-2024': profile('paired-photos', ['embed:0', 'embed:1'],
    'Keep both landscape photographs prominent as a pair while retaining readable room for the EEG pipeline explanation.'),
  'zurich-climathon-2024': profile('gallery-led', ['embed:1', 'embed:2'],
    'Anchor the mixed collection with its verified landscape photograph and presentation, with the document and remaining source in supporting screens.',
    {'embed:2': 16 / 9, 'embed:3': 4 / 3}),
  'bayer-ai-2024': profile('media-led', ['embed:0'],
    'The single original source should have a generous viewer beside the concise account, without assigning its unverified file a photo aspect.'),
  'dsag-ideathon-2024': profile('balanced', ['embed:1', 'embed:0'],
    'Balance the verified landscape photograph, broad fraud-detection pitch deck and concise technical account.',
    {'embed:0': 16 / 9}),
  'circular-bsh-2024': profile('gallery-led', ['embed:3', 'embed:0'],
    'Give the verified prototype photograph and solution slides prominence, while retaining useful space for both remaining demonstration sources.',
    {'embed:0': 16 / 9}),
  'thuega-2024': profile('media-led', ['embed:0', 'embed:1', 'embed:2'],
    'The solution slides and two videos need broad screens; three slender full-height viewer columns obscure the energy-management demonstrations.',
    {'embed:0': 16 / 9, 'embed:1': 16 / 9, 'embed:2': 16 / 9}),
  'solana-ideathon-2024': profile('media-led', ['embed:0'],
    'Let the broad microbetting pitch deck lead beside the short story and compact References.',
    {'embed:0': 16 / 9}),
  'six-swisshacks-2024': profile('balanced', ['embed:0', 'embed:1'],
    'Give the landscape award photograph and presentation comparable prominence alongside the sustainability-platform account.',
    {'embed:1': 16 / 9}),
  'hackupc-2024': profile('gallery-led', ['embed:0', 'embed:1'],
    'Pair the verified photograph with a broad playable demonstration and supporting slide deck; the brief story should not dominate.',
    {'embed:1': 16 / 9, 'embed:2': 16 / 9}),
  'mdsi-bundesliga-2024': profile('balanced', ['embed:0', 'embed:1'],
    'Balance the technical account with a broad slide deck and the second original viewer, preserving confidentiality-related prose.',
    {'embed:0': 16 / 9}),
  'draeger-2023': profile('portrait-led', ['embed:0'],
    'Give the verified tall photograph full-height presence beside the substantial medical prediction story and compact References.'),
  'ethmunich-2023': profile('media-led', ['embed:0'],
    'The landscape prize photograph should lead; the short NFT-similarity explanation and References need a compact companion board.'),
  'msg-karlsruhe-2023': profile('media-led', ['embed:1', 'embed:0'],
    'Feature the verified landscape photograph and retain a useful original viewer; the very short route-planner account needs little height.'),
  'bachelors-thesis': profile('portrait-led', ['embed:0'],
    'Give the verified tall research visual its own generous native-aspect area beside the cat-identification explanation.'),
  'tgu-perfect-gpa': profile('media-led', ['embed:0'],
    'The verified landscape graduation visual should remain prominent beside the longer account of the university and perfect GPA.'),
});

const DEFAULT_WALL_CURATION = profile('balanced', [],
  'Unreviewed achievements use the responsive composition until their real sources and resulting screenshots receive an editorial review.');

/** Resolve presentation by stable slug; never mutate the supplied project. */
export function galleryWallCuration(projectOrSlug) {
  const slug = typeof projectOrSlug === 'string' ? projectOrSlug : projectOrSlug?.slug;
  return typeof slug === 'string' && Object.hasOwn(GALLERY_WALL_CURATION, slug)
    ? GALLERY_WALL_CURATION[slug] : DEFAULT_WALL_CURATION;
}
