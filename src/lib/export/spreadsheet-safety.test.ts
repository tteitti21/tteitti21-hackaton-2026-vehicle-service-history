import { describe, expect, it } from "vitest";

import {
  escapeSpreadsheetFormula,
  optionalSpreadsheetText,
  spreadsheetText,
} from "./spreadsheet-safety";

describe("spreadsheet formula injection protection", () => {
  it.each([
    ["=HYPERLINK(\"https://attacker.example\")", "'=HYPERLINK(\"https://attacker.example\")"],
    ["+cmd|' /C calc'!A0", "'+cmd|' /C calc'!A0"],
    ["-2+3", "'-2+3"],
    ["@SUM(1,1)", "'@SUM(1,1)"],
    [" \t=WEBSERVICE(\"https://attacker.example\")", "' \t=WEBSERVICE(\"https://attacker.example\")"],
    ["\r\n@malicious", "'\r\n@malicious"],
  ])("escapes the dangerous prefix in %j", (value, expected) => {
    expect(escapeSpreadsheetFormula(value)).toBe(expected);
  });

  it.each([
    "Toyota",
    "https://manufacturer.example/maintenance",
    "1AD-FTV",
    "Text containing = in the middle",
    "'Already quoted",
    "",
  ])("leaves safe text unchanged: %j", (value) => {
    expect(escapeSpreadsheetFormula(value)).toBe(value);
  });

  it("normalizes absent cell text to an empty string", () => {
    expect(spreadsheetText(null)).toBe("");
    expect(spreadsheetText(undefined)).toBe("");
  });

  it("uses true blank cells for absent optional text", () => {
    expect(optionalSpreadsheetText(null)).toBeNull();
    expect(optionalSpreadsheetText(undefined)).toBeNull();
    expect(optionalSpreadsheetText("")).toBeNull();
    expect(optionalSpreadsheetText("=formula")).toBe("'=formula");
  });
});
