/**
 * Pure achievement-by-achievement navigation. The source dates are deliberately
 * not converted to invented exact days: a month means that whole month, and a
 * range is ordered by when it ends. Equal date spans retain editorial source
 * order rather than being ranked by importance or grouped geographically.
 */

const RANGE_SEPARATOR = /\s+[–—-]\s+/;

function calendarDay(year, month, day, label) {
  const value = Date.UTC(year, month - 1, day);
  const check = new Date(value);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new RangeError(`Invalid achievement date: ${label}`);
  }
  return value;
}

function parsePeriod(raw) {
  let match = /^(\d{4})$/.exec(raw);
  if (match) {
    const year = Number(match[1]);
    return { start: calendarDay(year, 1, 1, raw), end: calendarDay(year, 12, 31, raw) };
  }

  match = /^(\d{1,2})\/(\d{4})$/.exec(raw);
  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);
    if (month < 1 || month > 12) throw new RangeError(`Invalid achievement date: ${raw}`);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: calendarDay(year, month, 1, raw), end: calendarDay(year, month, lastDay, raw) };
  }

  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (match) {
    const [, month, day, year] = match.map(Number);
    const value = calendarDay(year, month, day, raw);
    return { start: value, end: value };
  }

  throw new RangeError(`Unsupported achievement date: ${raw}`);
}

/** Parse YYYY, MM/YYYY, MM/DD/YYYY, and inclusive ranges of those formats. */
export function parseAchievementDate(date) {
  if (typeof date !== 'string' || !date.trim()) throw new TypeError('Achievement date must be a nonempty string');
  const parts = date.trim().split(RANGE_SEPARATOR);
  if (parts.length > 2) throw new RangeError(`Unsupported achievement date range: ${date}`);
  const first = parsePeriod(parts[0]);
  if (parts.length === 1) return first;
  const last = parsePeriod(parts[1]);
  if (first.start > last.end) throw new RangeError(`Achievement date range ends before it starts: ${date}`);
  return { start: first.start, end: last.end };
}

/** Newest completion/end date first; ties retain source order. Does not mutate. */
export function sortAchievementsNewestFirst(achievements) {
  if (!Array.isArray(achievements)) throw new TypeError('Achievements must be an array');
  return achievements.map((achievement, sourceIndex) => ({
    achievement,
    sourceIndex,
    span: parseAchievementDate(achievement.date)
  })).sort((a, b) => b.span.end - a.span.end || a.sourceIndex - b.sourceIndex)
    .map(({ achievement }) => achievement);
}

/**
 * A missing current slug is the unopened navigator: `next` is the newest
 * achievement. Once selected, movement is bounded (not circular) so the
 * direction in time never unexpectedly jumps from oldest back to newest.
 */
export function getChronologyState(ordered, currentSlug = null) {
  if (!Array.isArray(ordered)) throw new TypeError('Chronology must be an array');
  const index = currentSlug == null ? -1 : ordered.findIndex(({ slug }) => slug === currentSlug);
  return {
    index,
    total: ordered.length,
    current: index < 0 ? null : ordered[index],
    previous: index > 0 ? ordered[index - 1] : null,
    next: index + 1 < ordered.length ? ordered[index + 1] : null
  };
}

export function stepChronology(ordered, currentSlug, direction) {
  if (direction !== 'next' && direction !== 'previous') {
    throw new RangeError('Chronology direction must be "next" or "previous"');
  }
  return getChronologyState(ordered, currentSlug)[direction];
}
