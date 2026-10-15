import {sortAchievementsNewestFirst} from './chronology.js';

/** Preserve the authored rating, including quarter and smaller partial stars. */
export function achievementStarFills(importance = 0) {
  const rating = Math.max(0, Math.min(5, Number(importance) / 2 || 0));
  return Array.from({length: Math.ceil(rating)}, (_, index) => Math.min(1, rating - index));
}

/** The PDF's original amber-to-purple palette, shared by every star display. */
export function achievementStarColor(index = 0) {
  return [245, 158, 11].map((channel, i) => Math.round(channel + ([139, 92, 246][i] - channel) * index / 4));
}

const numericImportance = achievement => {
  const importance = Number(achievement.importance);
  return Number.isFinite(importance) ? importance : 0;
};

/** Highest importance first; equal ratings retain chronology and editorial ties. */
export function sortAchievementsByImportance(achievements) {
  return sortAchievementsNewestFirst(achievements)
    .sort((a, b) => numericImportance(b) - numericImportance(a));
}
