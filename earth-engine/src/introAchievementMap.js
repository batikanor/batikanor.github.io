import {createGalleryRoomGlobe} from './galleryRoomGlobe.js';
import {sortAchievementsNewestFirst} from './chronology.js';

/** The entrance uses the gallery's real geographic navigator, starting at Earth. */
export function startIntroAchievementMap({container, achievements, onSelect = () => {}}) {
  const ordered = sortAchievementsNewestFirst(achievements);
  const slugs = new Set(ordered.map(achievement => achievement.slug));
  const originalInert = container?.inert;
  let disposed = false, selectedSlug = null;
  const globe = createGalleryRoomGlobe({container, achievements: ordered, initialSlug: null,
    onSelect(slug) {
      if (disposed || selectedSlug !== null || !slugs.has(slug)) return;
      selectedSlug = slug;
      // Keep repeated taps from starting another entry transition before disposal.
      container.inert = true;
      onSelect(slug);
    }});

  function dispose() {
    if (disposed) return;
    disposed = true;
    try {globe.dispose();} finally {container.inert = originalInert;}
  }

  return {dispose, resize: () => {if (!disposed) globe.resize();},
    getStats: () => ({...globe.getStats(), selectedSlug, disposed})};
}
