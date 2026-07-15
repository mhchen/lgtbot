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

const VOTING_PERIOD_TIMEZONE = 'America/Los_Angeles';
const VOTING_PERIOD_CUTOFF_HOUR = 9;
const SATURDAY = 6;

// Returns an identifier like "2026-04-04" marking the Saturday 9am PT boundary
// of the current book club voting period. Periods run Sat 9am PT → next Sat 9am PT
// so they align with the close cron and a vote cast Sat 8:59am PT still lands in
// the period that's about to be closed.
export function getCurrentVotingPeriod(now: Date = new Date()): string {
  const zoned = new TZDate(now.getTime(), VOTING_PERIOD_TIMEZONE);
  const dayOfWeek = zoned.getDay();
  const hour = zoned.getHours();

  const daysBack =
    dayOfWeek === SATURDAY
      ? hour >= VOTING_PERIOD_CUTOFF_HOUR
        ? 0
        : 7
      : (dayOfWeek - SATURDAY + 7) % 7;

  return format(subDays(zoned, daysBack), 'yyyy-MM-dd');
}
