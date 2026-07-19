import ExcelJS from "exceljs";
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
  it("creates four readable, formatted report sheets with typed values and trusted formulas", async () => {
    const report = createReport();
    const bytes = await createExcelReportBytes(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toArrayBuffer(bytes));

    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Yhteenveto",
      "Huoltohistoria",
      "Komponentit",
      "Lähteet",
    ]);
    expect(workbook.getWorksheet("Huoltohistoria")?.getCell("E2").value).toBe(
      168_998.8228,
    );
    expect(workbook.getWorksheet("Huoltohistoria")?.getCell("E2").numFmt).toBe(
      "#,##0.####",
    );
    expect(workbook.getWorksheet("Komponentit")?.getCell("J2").value).toBe(
      15_000,
    );
    expect(workbook.getWorksheet("Lähteet")?.getCell("R2").value).toBe(
      "https://toyota.example/avensis-t27",
    );
    expect(workbook.getWorksheet("Komponentit")?.views[0]).toMatchObject({
      state: "frozen",
      ySplit: 1,
      showGridLines: false,
    });

    const formulas: string[] = [];
    workbook.eachSheet((sheet) => {
      expect(sheet.getImages()).toEqual([]);
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
          /^COUNTIF\('Komponentit'!\$C\$2:\$C\$\d+,"overdue"\)$/,
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
      loaded.getWorksheet("Yhteenveto")?.getCell("B5").value,
    ).toBe("'=malicious-make");
    expect(
      loaded.getWorksheet("Huoltohistoria")?.getCell("K2").value,
    ).toBe("'=HYPERLINK(\"https://attacker.example\")");
    expect(
      loaded.getWorksheet("Lähteet")?.getCell("P2").value,
    ).toBe("'+malicious-source-title");
    expect(
      loaded.getWorksheet("Lähteet")?.getCell("T2").value,
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
