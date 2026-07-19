const MILLISECONDS_PER_DAY = 86_400_000;

export function completeCalendarMonthsBetween(
  start: Date,
  end: Date,
): number {
  assertValidDate(start);
  assertValidDate(end);
  if (end.getTime() < start.getTime()) {
    throw new RangeError("End date must not precede start date.");
  }

  const rawMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth();
  const anniversary = addCalendarMonths(start, rawMonths);

  return anniversary.getTime() <= end.getTime()
    ? rawMonths
    : rawMonths - 1;
}

export function addCalendarMonths(date: Date, months: number): Date {
  assertValidDate(date);
  if (!Number.isInteger(months)) {
    throw new RangeError("Months must be an integer.");
  }

  const targetMonthStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
    ),
  );
  const lastTargetDay = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(date.getUTCDate(), lastTargetDay),
    ),
  );
}

export function toUtcDateOnly(date: Date): Date {
  assertValidDate(date);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

export function formatIsoDate(date: Date): string {
  return toUtcDateOnly(date).toISOString().slice(0, 10);
}

export function daysBetween(start: Date, end: Date): number {
  return Math.floor(
    (toUtcDateOnly(end).getTime() - toUtcDateOnly(start).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Date must be valid.");
  }
}
