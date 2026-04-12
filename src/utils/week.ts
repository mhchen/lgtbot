import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  setISOWeek,
  setISOWeekYear,
  endOfDay,
  subDays,
} from 'date-fns';
import { TZDate } from '@date-fns/tz';

export function getCurrentWeek(): string {
  return format(new Date(), "RRRR-'W'II");
}

export function getWeekDateRange(weekIdentifier: string): {
  start: Date;
  end: Date;
} {
  const [year, week] = weekIdentifier.split('-W').map(Number);

  const baseDate = new Date(year, 0, 1);
  const weekDate = setISOWeek(setISOWeekYear(baseDate, year), week);

  const start = startOfISOWeek(weekDate);
  const end = endOfDay(endOfISOWeek(weekDate));

  return { start, end };
}

const VOTING_PERIOD_TIMEZONE = 'America/New_York';
const VOTING_PERIOD_CUTOFF_HOUR = 9;
const TUESDAY = 2;

// Returns an identifier like "2026-04-07" marking the Tuesday 9am ET boundary
// of the current book club voting period. Periods run Tue 9am ET → next Tue 9am ET
// so they align with the close cron and a vote cast Tue 8:59am ET still lands in
// the period that's about to be closed.
export function getCurrentVotingPeriod(now: Date = new Date()): string {
  const zoned = new TZDate(now.getTime(), VOTING_PERIOD_TIMEZONE);
  const dayOfWeek = zoned.getDay();
  const hour = zoned.getHours();

  const daysBack =
    dayOfWeek === TUESDAY
      ? hour >= VOTING_PERIOD_CUTOFF_HOUR
        ? 0
        : 7
      : (dayOfWeek - TUESDAY + 7) % 7;

  return format(subDays(zoned, daysBack), 'yyyy-MM-dd');
}
