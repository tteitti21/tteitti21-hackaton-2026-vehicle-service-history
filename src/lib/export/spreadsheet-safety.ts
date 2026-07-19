const FORMULA_PREFIX = /^[\s\uFEFF]*[=+\-@]/u;

export function escapeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function spreadsheetText(
  value: string | null | undefined,
): string {
  return escapeSpreadsheetFormula(value ?? "");
}

export function optionalSpreadsheetText(
  value: string | null | undefined,
): string | null {
  return value === null || value === undefined || value === ""
    ? null
    : escapeSpreadsheetFormula(value);
}
