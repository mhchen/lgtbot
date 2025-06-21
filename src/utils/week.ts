import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  setISOWeek,
  setISOWeekYear,
  endOfDay,
} from 'date-fns';

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
