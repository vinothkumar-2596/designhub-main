import { endOfDay, isValid, parseISO, startOfDay, subDays } from 'date-fns';

export type DateRangeOption = 'day' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export const getDateRange = (
  option: DateRangeOption,
  customStart?: string,
  customEnd?: string
): DateRange | null => {
  const now = new Date();

  if (option === 'day') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (option === 'week') {
    return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }

  if (option === 'month') {
    return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }

  if (option === 'custom') {
    if (!customStart || !customEnd) return null;
    const start = startOfDay(parseISO(customStart));
    const end = endOfDay(parseISO(customEnd));
    if (!isValid(start) || !isValid(end)) return null;
    return { start, end };
  }

  return null;
};

export const isWithinRange = (date: Date, range: DateRange | null) => {
  if (!range) return true;
  return date >= range.start && date <= range.end;
};
