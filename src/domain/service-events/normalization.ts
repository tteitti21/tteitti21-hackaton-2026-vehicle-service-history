import type {
  ServiceEvent,
  ServiceHistory,
} from "@/domain/schemas/service-history";

export const MILES_TO_KILOMETRES = 1.609344;
const DISTANCE_DECIMAL_SCALE = 1_000_000;

export interface NormalizedServiceDate {
  status: "missing" | "valid" | "unverified" | "invalid";
  value: string | null;
  earliestUtc: number | null;
  latestUtc: number | null;
}

export interface NormalizedOdometer {
  status: "missing" | "valid" | "unverified" | "invalid";
  originalValue: number | null;
  originalUnit: "km" | "mi" | "unknown" | null;
  kilometres: number | null;
}

export interface NormalizedServiceEvent {
  event: ServiceEvent;
  date: NormalizedServiceDate;
  odometer: NormalizedOdometer;
}

type ServiceDate = NonNullable<ServiceEvent["service_date"]>;
type ServiceDatePrecision = ServiceDate["precision"];

export interface InferredServiceDateInput {
  value: string;
  precision: ServiceDatePrecision;
}

export function normalizeServiceEvent(
  event: ServiceEvent,
): NormalizedServiceEvent {
  return {
    event,
    date: normalizeServiceDate(event.service_date),
    odometer: normalizeOdometer(event.odometer),
  };
}

export function inferServiceDateInput(
  input: string,
): InferredServiceDateInput {
  const value = input.trim();
  const finnishDay = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (finnishDay !== null) {
    return {
      value: `${finnishDay[3]}-${finnishDay[2]}-${finnishDay[1]}`,
      precision: "day",
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { value, precision: "day" };
  }

  const finnishMonth = /^(\d{2})\.(\d{4})$/.exec(value);
  if (finnishMonth !== null) {
    return {
      value: `${finnishMonth[2]}-${finnishMonth[1]}`,
      precision: "month",
    };
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return { value, precision: "month" };
  }

  if (/^\d{4}$/.test(value)) {
    return { value, precision: "year" };
  }

  return { value, precision: "unknown" };
}

export function createServiceDateFromInput(
  input: string,
  confidence: number,
): ServiceDate | null {
  const inferred = inferServiceDateInput(input);
  return inferred.value === ""
    ? null
    : {
        ...inferred,
        confidence,
      };
}

export function formatServiceDateInput(
  serviceDate: ServiceEvent["service_date"],
): string {
  if (serviceDate === null) {
    return "";
  }

  const inferred = inferServiceDateInput(serviceDate.value);
  if (inferred.precision === "day") {
    const [year, month, day] = inferred.value.split("-");
    return `${day}.${month}.${year}`;
  }
  if (inferred.precision === "month") {
    const [year, month] = inferred.value.split("-");
    return `${month}.${year}`;
  }
  return inferred.value;
}

export function reconcileServiceDatePrecision(
  serviceDate: ServiceEvent["service_date"],
): ServiceEvent["service_date"] {
  if (serviceDate === null) {
    return null;
  }
  return {
    ...serviceDate,
    ...inferServiceDateInput(serviceDate.value),
  };
}

export function reconcileServiceHistoryDatePrecisions(
  serviceHistory: ServiceHistory,
): ServiceHistory {
  return {
    ...serviceHistory,
    events: serviceHistory.events.map((event) => ({
      ...event,
      service_date: reconcileServiceDatePrecision(event.service_date),
    })),
  };
}

export function normalizeServiceDate(
  serviceDate: ServiceEvent["service_date"],
): NormalizedServiceDate {
  if (serviceDate === null) {
    return {
      status: "missing",
      value: null,
      earliestUtc: null,
      latestUtc: null,
    };
  }

  if (serviceDate.precision === "unknown") {
    return {
      status: "unverified",
      value: serviceDate.value,
      earliestUtc: null,
      latestUtc: null,
    };
  }

  if (serviceDate.precision === "year") {
    const match = /^(\d{4})$/.exec(serviceDate.value);
    const year = match ? Number(match[1]) : Number.NaN;

    return Number.isInteger(year) && year >= 1886
      ? validDate(
          serviceDate.value,
          Date.UTC(year, 0, 1),
          Date.UTC(year, 11, 31),
        )
      : invalidDate(serviceDate.value);
  }

  if (serviceDate.precision === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(serviceDate.value);
    const year = match ? Number(match[1]) : Number.NaN;
    const month = match ? Number(match[2]) : Number.NaN;

    if (
      !Number.isInteger(year) ||
      year < 1886 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return invalidDate(serviceDate.value);
    }

    return validDate(
      serviceDate.value,
      Date.UTC(year, month - 1, 1),
      Date.UTC(year, month, 0),
    );
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate.value);
  const year = match ? Number(match[1]) : Number.NaN;
  const month = match ? Number(match[2]) : Number.NaN;
  const day = match ? Number(match[3]) : Number.NaN;
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  const isValid =
    Number.isInteger(year) &&
    year >= 1886 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isValid
    ? validDate(serviceDate.value, timestamp, timestamp)
    : invalidDate(serviceDate.value);
}

export function normalizeOdometer(
  odometer: ServiceEvent["odometer"],
): NormalizedOdometer {
  if (odometer === null) {
    return {
      status: "missing",
      originalValue: null,
      originalUnit: null,
      kilometres: null,
    };
  }

  if (!Number.isSafeInteger(odometer.value) || odometer.value < 0) {
    return {
      status: "invalid",
      originalValue: odometer.value,
      originalUnit: odometer.unit,
      kilometres: null,
    };
  }

  if (odometer.unit === "unknown") {
    return {
      status: "unverified",
      originalValue: odometer.value,
      originalUnit: odometer.unit,
      kilometres: null,
    };
  }

  return {
    status: "valid",
    originalValue: odometer.value,
    originalUnit: odometer.unit,
    kilometres:
      odometer.unit === "mi"
        ? convertMilesToKilometres(odometer.value)
        : odometer.value,
  };
}

export function convertMilesToKilometres(miles: number): number {
  return (
    Math.round(
      miles * MILES_TO_KILOMETRES * DISTANCE_DECIMAL_SCALE,
    ) / DISTANCE_DECIMAL_SCALE
  );
}

function validDate(
  value: string,
  earliestUtc: number,
  latestUtc: number,
): NormalizedServiceDate {
  return {
    status: "valid",
    value,
    earliestUtc,
    latestUtc,
  };
}

function invalidDate(value: string): NormalizedServiceDate {
  return {
    status: "invalid",
    value,
    earliestUtc: null,
    latestUtc: null,
  };
}
