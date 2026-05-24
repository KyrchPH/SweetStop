import { HttpError } from "./http-error.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value, fieldName) {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw new HttpError(400, `Invalid ${fieldName}. Expected UUID.`);
  }
}

export function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${fieldName} is required.`);
  }
}

export function parsePositiveNumber(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive number.`);
  }

  return numberValue;
}

export function parseNonNegativeNumber(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative number.`);
  }

  return numberValue;
}

export function parseBooleanOrUndefined(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, `${fieldName} must be a boolean.`);
  }

  return value;
}

export function parseIsoDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid date/time.`);
  }

  return date.toISOString();
}

export function parseDateOnly(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${fieldName} must be in YYYY-MM-DD format.`);
  }

  return value;
}
