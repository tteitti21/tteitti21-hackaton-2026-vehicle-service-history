import ExcelJS, { type Worksheet } from "exceljs";
import { describe, expect, it } from "vitest";

import { createVehicleReportModel } from "@/domain/report/report-model";
import type { ServiceHistory } from "@/domain/schemas/service-history";
import { maintenanceResearchFixture } from "@/test/maintenance-research-fixture";
import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";
import {
  createExcelReportBytes,
  createExcelReportWorkbook,
} from "./excel-export";

const reviewedHistory: ServiceHistory = {
  images: [
    {
      image_id: "image-secret-metadata",
      readability: 1,
      notes: "original-image.png",
    },
  ],
  events: [
    {
      event_id: "event-1",
      source_image_ids: ["image-1"],
      raw_evidence: "=HYPERLINK(\"https://attacker.example\")",
      service_date: {
        value: "2026-01-15",
        precision: "day",
        confidence: 0.9,
      },
      odometer: { value: 105_011, unit: "mi", confidence: 0.8 },
      actions: [
        {
          component_code: "engine_oil",
          component_label: "+malicious-component-label",
          action_type: "replaced",
          description: "-malicious-action",
          confidence: 0.9,
        },
      ],
      workshop: "@malicious-workshop",
      notes: " \t=malicious-note",
      confidence: 0.9,
      ambiguities: ["\r\n@malicious-ambiguity"],
    },
  ],
  warnings: ["=malicious-warning"],
};

describe("Excel report export", () => {
  it("creates four portrait, two-column sheets that read vertically", async () => {
    const report = createReport();
    const bytes = await createExcelReportBytes(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toArrayBuffer(bytes));

    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Service history",
      "Components",
      "Sources",
    ]);
    workbook.eachSheet((sheet) => {
      expect(sheet.actualColumnCount).toBeLessThanOrEqual(2);
      expect(sheet.pageSetup.orientation).toBe("portrait");
      expect(sheet.pageSetup.fitToWidth).toBe(1);
      expect(sheet.views[0]).toMatchObject({
        state: "frozen",
        ySplit: 2,
        showGridLines: false,
      });
      expect(sheet.getImages()).toEqual([]);
      assertDetailRowsHaveValues(sheet);
    });

    const serviceSheet = workbook.getWorksheet("Service history")!;
    const odometerCell = findValueCell(serviceSheet, "Odometer reading (km)");
    expect(odometerCell.value).toBe(168_998.822784);
    expect(odometerCell.numFmt).toBe("#,##0.####");

    const componentSheet = workbook.getWorksheet("Components")!;
    expect(findValueCell(componentSheet, "Maintenance interval (km)").value).toBe(
      15_000,
    );
    expect(
      findAllValueCells(componentSheet, "trustworthiness_level").map(
        (cell) => cell.value,
      ),
    ).toEqual(expect.arrayContaining(["High (high)", "Low (low)"]));
    expect(
      findAllValueCells(componentSheet, "Component code").map(
        (cell) => cell.value,
      ),
    ).toEqual(
      expect.arrayContaining([
        "engine_oil",
        "oil_filter",
        "transmission_fluid",
        "brake_fluid",
        "fuel_filter",
        "air_filter",
        "cabin_filter",
        "coolant",
      ]),
    );

    const sourceSheet = workbook.getWorksheet("Sources")!;
    expect(
      findAllValueCells(sourceSheet, "URL").map((cell) => cell.value),
    ).toContain("https://toyota.example/avensis-t27");
    expect(
      findAllValueCells(sourceSheet, "Claim ID").map((cell) => cell.value),
    ).toEqual(expect.arrayContaining(["claim-2", "claim-3"]));

    const formulas: string[] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.type === ExcelJS.ValueType.Formula) {
            const value = cell.value;
            if (
              typeof value === "object" &&
              value !== null &&
              "formula" in value &&
              typeof value.formula === "string"
            ) {
              formulas.push(value.formula);
            }
          }
        });
      });
    });
    expect(formulas).toHaveLength(7);
    expect(formulas).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^COUNTIF\('Components'!\$B\$1:\$B\$\d+,"overdue"\)$/,
        ),
      ]),
    );
  });

  it("escapes every untrusted formula prefix and includes no image metadata", async () => {
    const report = createReport();
    report.vehicle.make = "=malicious-make";
    report.sources[0]!.title = "+malicious-source-title";
    report.sources[0]!.evidence = "@malicious-source-evidence";
    const workbook = createExcelReportWorkbook(report);
    const bytes = await createExcelReportBytes(report);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(toArrayBuffer(bytes));

    const dangerousStrings: string[] = [];
    loaded.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (
            cell.type !== ExcelJS.ValueType.Formula &&
            typeof cell.value === "string" &&
            /^[\s\uFEFF]*[=+\-@]/u.test(cell.value)
          ) {
            dangerousStrings.push(cell.value);
          }
        });
      });
    });

    expect(dangerousStrings).toEqual([]);
    expect(
      findValueCell(loaded.getWorksheet("Summary")!, "Make").value,
    ).toBe("'=malicious-make");
    expect(
      findValueCell(
        loaded.getWorksheet("Service history")!,
        "Raw evidence",
      ).value,
    ).toBe("'=HYPERLINK(\"https://attacker.example\")");
    expect(
      findValueCell(loaded.getWorksheet("Sources")!, "Title").value,
    ).toBe("'+malicious-source-title");
    expect(
      findValueCell(loaded.getWorksheet("Sources")!, "Source evidence").value,
    ).toBe("'@malicious-source-evidence");
    expect(JSON.stringify(workbook.model)).not.toContain("original-image.png");
    workbook.eachSheet((sheet) => expect(sheet.getImages()).toEqual([]));
  });
});

function createReport() {
  return createVehicleReportModel({
    confirmedVehicle: confirmedVehicleFixture,
    confirmedVehicleCandidateId: "candidate-1",
    vehicleResolution: vehicleResolutionFixture,
    serviceHistory: reviewedHistory,
    maintenanceResearch: maintenanceResearchFixture,
    generatedAt: new Date("2026-07-19T14:30:00.000Z"),
  });
}

function findValueCell(sheet: Worksheet, label: string): ExcelJS.Cell {
  const cells = findAllValueCells(sheet, label);
  if (cells.length === 0) {
    throw new Error(`Missing workbook field: ${sheet.name}/${label}`);
  }
  return cells[0]!;
}

function findAllValueCells(
  sheet: Worksheet,
  label: string,
): ExcelJS.Cell[] {
  const cells: ExcelJS.Cell[] = [];
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) {
      cells.push(row.getCell(2));
    }
  });
  return cells;
}

function assertDetailRowsHaveValues(sheet: Worksheet): void {
  sheet.eachRow((row) => {
    const label = row.getCell(1);
    const value = row.getCell(2);
    if (
      typeof label.value === "string" &&
      value.type !== ExcelJS.ValueType.Merge
    ) {
      expect(value.value, `${sheet.name}/${label.value}`).not.toBeNull();
      expect(value.value, `${sheet.name}/${label.value}`).not.toBe("");
    }
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
