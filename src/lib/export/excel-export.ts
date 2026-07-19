import ExcelJS, {
  type CellValue,
  type Worksheet,
} from "exceljs";

import {
  REPORT_COMPATIBILITY_LABELS_FI,
  REPORT_RESOLUTION_LABELS_FI,
  REPORT_STATUS_LABELS_FI,
  type ReportComponent,
  type ReportServiceEvent,
  type ReportSource,
  type VehicleReportModel,
} from "@/domain/report/report-model";
import {
  optionalSpreadsheetText,
  spreadsheetText,
} from "./spreadsheet-safety";

const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const STATUS_ORDER = [
  "overdue",
  "due",
  "due_soon",
  "unknown",
  "conflicting_sources",
  "insufficient_evidence",
  "ok",
] as const;

const ACTION_LABELS: Record<ReportServiceEvent["actions"][number]["action_type"], string> = {
  replaced: "vaihdettu",
  serviced: "huollettu",
  repaired: "korjattu",
  inspected: "tarkastettu",
  adjusted: "säädetty",
  unknown: "epäselvä",
};

const STATUS_COLORS: Record<
  ReportComponent["status"],
  { fill: string; font: string }
> = {
  overdue: { fill: "F7D9D3", font: "8B2C20" },
  due: { fill: "FDE6C8", font: "7A4100" },
  due_soon: { fill: "FFF3C4", font: "66500E" },
  unknown: { fill: "E8E4DF", font: "4E4944" },
  insufficient_evidence: { fill: "E4E9EC", font: "3F515B" },
  conflicting_sources: { fill: "E5DDF4", font: "543A78" },
  ok: { fill: "DDEEDF", font: "174B33" },
};

export async function createExcelReportBlob(
  report: VehicleReportModel,
): Promise<Blob> {
  const bytes = await createExcelReportBytes(report);
  return new Blob([bytes.slice().buffer], { type: EXCEL_CONTENT_TYPE });
}

export async function createExcelReportBytes(
  report: VehicleReportModel,
): Promise<Uint8Array> {
  const workbook = createExcelReportWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export function createExcelReportWorkbook(
  report: VehicleReportModel,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date(report.metadata.generated_at);
  workbook.creator = "AutoHuolto AI";
  workbook.lastModifiedBy = "AutoHuolto AI";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.title = `${report.vehicle.make} ${report.vehicle.model} – huoltoraportti`;
  workbook.subject = "Paikallisesti luotu ajoneuvon huoltohistorian raportti";
  workbook.company = "AutoHuolto AI";
  workbook.calcProperties.fullCalcOnLoad = true;

  const summarySheet = workbook.addWorksheet("Yhteenveto", {
    views: [{ showGridLines: false }],
  });
  const serviceSheet = workbook.addWorksheet("Huoltohistoria", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  const componentSheet = workbook.addWorksheet("Komponentit", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  const sourceSheet = workbook.addWorksheet("Lähteet", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });

  writeServiceHistorySheet(serviceSheet, report.service_history);
  writeComponentSheet(componentSheet, report.components);
  writeSourceSheet(sourceSheet, report.sources);
  writeSummarySheet(summarySheet, report);

  return workbook;
}

function writeSummarySheet(
  sheet: Worksheet,
  report: VehicleReportModel,
): void {
  sheet.columns = [
    { width: 30 },
    { width: 42 },
    { width: 18 },
    { width: 24 },
  ];
  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = "AutoHuolto AI – huoltoraportti";
  sheet.getCell("A1").style = {
    fill: solidFill("153C30"),
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 20 },
    alignment: { vertical: "middle" },
  };
  sheet.getRow(1).height = 34;

  sheet.mergeCells("A2:D2");
  sheet.getCell("A2").value = spreadsheetText(
    "Raportti luotiin paikallisesti selaimessa. Se ei sisällä kuvia eikä sitä lähetetty vientiä varten palvelimelle.",
  );
  sheet.getCell("A2").style = {
    fill: solidFill("DDEBE3"),
    font: { color: { argb: "FF234B3B" }, italic: true },
    alignment: { wrapText: true, vertical: "middle" },
  };
  sheet.getRow(2).height = 34;

  writeSectionHeading(sheet, 4, "Ajoneuvo");
  const vehicleRows: Array<[string, CellValue]> = [
    ["Merkki", spreadsheetText(report.vehicle.make)],
    ["Malli", spreadsheetText(report.vehicle.model)],
    ["Sukupolvi", optionalSpreadsheetText(report.vehicle.generation)],
    ["Mallivuosi", report.vehicle.model_year],
    [
      "Moottori",
      optionalSpreadsheetText(report.vehicle.resolved_variant.engine),
    ],
    [
      "Vaihteisto",
      optionalSpreadsheetText(report.vehicle.resolved_variant.transmission),
    ],
    [
      "Markkina",
      optionalSpreadsheetText(report.vehicle.resolved_variant.market),
    ],
    [
      "Nykyinen mittarilukema (km)",
      spreadsheetKilometres(report.vehicle.current_odometer_km),
    ],
    [
      "Variantin yhteensopivuus",
      REPORT_COMPATIBILITY_LABELS_FI[
        report.vehicle.resolution.compatibility
      ],
    ],
    [
      "Variantin epävarmuus",
      spreadsheetText(
        [...new Set([
          report.vehicle.resolution.compatibility_explanation,
          ...report.vehicle.resolution.missing_distinguishing_fields,
          ...report.vehicle.resolution.unresolved_variant_fields,
        ])].join(" | "),
      ),
    ],
  ];
  vehicleRows.forEach(([label, value], index) => {
    const row = 5 + index;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 2).value = value;
    sheet.getCell(row, 1).font = { bold: true, color: { argb: "FF365C4E" } };
    sheet.getCell(row, 2).alignment = { wrapText: true, vertical: "top" };
  });
  sheet.getCell("B12").numFmt = "#,##0";

  const statusHeadingRow = 16;
  writeSectionHeading(sheet, statusHeadingRow, "Komponenttien tilat");
  const statusHeaderRow = statusHeadingRow + 1;
  sheet.getRow(statusHeaderRow).values = ["Tilakoodi", "Tila", "Määrä"];
  styleHeaderRow(sheet.getRow(statusHeaderRow), 3);
  const componentLastRow = Math.max(2, report.components.length + 1);
  STATUS_ORDER.forEach((status, index) => {
    const row = statusHeaderRow + 1 + index;
    const colors = STATUS_COLORS[status];
    sheet.getCell(row, 1).value = status;
    sheet.getCell(row, 2).value = REPORT_STATUS_LABELS_FI[status];
    sheet.getCell(row, 3).value = {
      formula: `COUNTIF('Komponentit'!$C$2:$C$${componentLastRow},"${status}")`,
      result: report.summary.status_counts[status],
    };
    const statusStyle: Partial<ExcelJS.Style> = {
      fill: solidFill(colors.fill),
      font: { color: { argb: `FF${colors.font}` } },
    };
    for (let column = 1; column <= 3; column += 1) {
      sheet.getCell(row, column).style = statusStyle;
    }
    sheet.getCell(row, 3).numFmt = "0";
  });

  const metadataRow = statusHeaderRow + STATUS_ORDER.length + 3;
  writeSectionHeading(sheet, metadataRow, "Raportin tiedot");
  const metadataRows: Array<[string, CellValue]> = [
    ["Luotu", toExcelDate(report.metadata.generated_at)],
    ["Laskentapäivä", toExcelDate(report.metadata.analysis_date)],
    ["Huoltotapahtumia", report.summary.service_event_count],
    ["Komponentteja", report.summary.component_count],
    ["Lähderivejä", report.summary.source_count],
    [
      "Korkein prioriteetti",
      report.summary.highest_priority_status === null
        ? null
        : REPORT_STATUS_LABELS_FI[report.summary.highest_priority_status],
    ],
  ];
  metadataRows.forEach(([label, value], index) => {
    const row = metadataRow + 1 + index;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 2).value = value;
    sheet.getCell(row, 1).font = { bold: true, color: { argb: "FF365C4E" } };
  });
  sheet.getCell(metadataRow + 1, 2).numFmt = "yyyy-mm-dd hh:mm";
  sheet.getCell(metadataRow + 2, 2).numFmt = "yyyy-mm-dd";

  const warningRow = metadataRow + metadataRows.length + 2;
  writeSectionHeading(sheet, warningRow, "Varoitukset ja rajaukset");
  sheet.mergeCells(`A${warningRow + 1}:D${warningRow + 1}`);
  sheet.getCell(warningRow + 1, 1).value = spreadsheetText(
    [
      ...report.warnings.service_history,
      ...report.warnings.vehicle_resolution,
      ...report.warnings.maintenance_research,
    ].join("\n") || "Ei erillisiä varoituksia.",
  );
  sheet.getCell(warningRow + 1, 1).alignment = {
    wrapText: true,
    vertical: "top",
  };
  sheet.getRow(warningRow + 1).height = 48;
  sheet.mergeCells(`A${warningRow + 2}:D${warningRow + 2}`);
  sheet.getCell(warningRow + 2, 1).value = spreadsheetText(
    report.metadata.disclaimer_fi,
  );
  sheet.getCell(warningRow + 2, 1).font = {
    italic: true,
    color: { argb: "FF5F6864" },
  };
  sheet.getCell(warningRow + 2, 1).alignment = { wrapText: true };

  sheet.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
}

function writeServiceHistorySheet(
  sheet: Worksheet,
  events: ReportServiceEvent[],
): void {
  const headers = [
    "Tapahtuma-ID",
    "Huoltopäivä",
    "Päivän tarkkuus",
    "Päivän luottamus",
    "Mittarilukema (km)",
    "Alkuperäinen mittarilukema",
    "Alkuperäinen yksikkö",
    "Mittarilukeman luottamus",
    "Toimenpiteet",
    "Korjaamo",
    "Raaka näyttö",
    "Muistiinpanot",
    "Epävarmuudet",
    "Tapahtuman luottamus",
    "Lähdekuvien tunnisteet",
  ];
  const rows = events.map((event) => [
    spreadsheetText(event.event_id),
    event.service_date === null
      ? null
      : event.service_date.precision === "day"
        ? toExcelDate(event.service_date.value)
        : spreadsheetText(event.service_date.value),
    optionalSpreadsheetText(event.service_date?.precision),
    event.service_date?.confidence ?? null,
    spreadsheetKilometres(event.odometer_km),
    event.original_odometer_value,
    optionalSpreadsheetText(event.original_odometer_unit),
    event.odometer_confidence,
    optionalSpreadsheetText(formatActions(event)),
    optionalSpreadsheetText(event.workshop),
    optionalSpreadsheetText(event.raw_evidence),
    optionalSpreadsheetText(event.notes),
    optionalSpreadsheetText(event.ambiguities.join(" | ")),
    event.confidence,
    spreadsheetText(event.source_image_ids.join(" | ")),
  ]);

  addDataTable(sheet, "ServiceHistoryTable", headers, rows);
  setColumnWidths(sheet, [
    18, 14, 15, 16, 20, 24, 19, 24, 45, 24, 55, 38, 38, 21, 30,
  ]);
  setColumnFormats(sheet, events.length, {
    2: "yyyy-mm-dd",
    4: "0%",
    5: "#,##0.####",
    6: "#,##0.####",
    8: "0%",
    14: "0%",
  });
  wrapColumns(sheet, events.length, [9, 10, 11, 12, 13, 15]);
}

function writeComponentSheet(
  sheet: Worksheet,
  components: ReportComponent[],
): void {
  const headers = [
    "Komponenttikoodi",
    "Komponentti",
    "Tilakoodi",
    "Tila",
    "Syykoodit",
    "Lähderatkaisu",
    "Ristiriita tai epävarmuus",
    "Väitteitä",
    "Valittu väite",
    "Huoltoväli (km)",
    "Huoltoväli (kk)",
    "Ensin täyttyvä",
    "Ehdot",
    "Viimeisin huoltotapahtuma",
    "Käytetty matka (km)",
    "Matkaa jäljellä (km)",
    "Käytetty aika (kk)",
    "Aikaa jäljellä (kk)",
    "Erääntymislukema (km)",
    "Erääntymispäivä",
  ];
  const rows = components.map((component) => [
    component.component_code,
    spreadsheetText(component.component_label),
    component.status,
    component.status_label_fi,
    component.reason_codes.join(" | "),
    REPORT_RESOLUTION_LABELS_FI[component.resolution],
    optionalSpreadsheetText(component.conflict_summary),
    component.interval_claim_count,
    optionalSpreadsheetText(component.recommended_claim_id),
    spreadsheetKilometres(component.recommended_interval_km),
    component.recommended_interval_months,
    formatBoolean(component.whichever_first),
    optionalSpreadsheetText(component.conditions),
    optionalSpreadsheetText(component.last_service_event_id),
    spreadsheetKilometres(component.distance_used_km),
    spreadsheetKilometres(component.distance_remaining_km),
    component.months_used,
    component.months_remaining,
    spreadsheetKilometres(component.due_odometer_km),
    component.due_date === null ? null : toExcelDate(component.due_date),
  ]);

  addDataTable(sheet, "ComponentsTable", headers, rows);
  setColumnWidths(sheet, [
    21, 24, 23, 24, 42, 24, 48, 12, 18, 19, 17, 17, 38, 26, 22, 23, 20,
    21, 24, 20,
  ]);
  setColumnFormats(sheet, components.length, {
    8: "0",
    10: "#,##0",
    11: "0",
    15: "#,##0",
    16: "#,##0",
    17: "0",
    18: "0",
    19: "#,##0",
    20: "yyyy-mm-dd",
  });
  wrapColumns(sheet, components.length, [5, 7, 13]);
  components.forEach((component, index) => {
    const row = index + 2;
    const colors = STATUS_COLORS[component.status];
    const statusStyle: Partial<ExcelJS.Style> = {
      fill: solidFill(colors.fill),
      font: { bold: true, color: { argb: `FF${colors.font}` } },
    };
    sheet.getCell(row, 3).style = statusStyle;
    sheet.getCell(row, 4).style = statusStyle;
  });
}

function writeSourceSheet(
  sheet: Worksheet,
  sources: ReportSource[],
): void {
  const headers = [
    "Lähde-ID",
    "Lähteen rooli",
    "Komponenttikoodi",
    "Komponentti",
    "Väite-ID",
    "Valittu suositus",
    "Väli (km)",
    "Väli (kk)",
    "Ensin täyttyvä",
    "Ehdot",
    "Alkuperäinen arvo",
    "Alkuperäinen yksikkö",
    "Lähdetaso",
    "Yhteensopivuus",
    "Yhteensopivuuden epävarmuus",
    "Otsikko",
    "Julkaisija",
    "URL",
    "Haettu",
    "Näyttö",
  ];
  const rows = sources.map((source) => [
    spreadsheetText(source.source_id),
    source.source_scope === "vehicle_resolution"
      ? "Ajoneuvoversio"
      : "Huoltoväli",
    optionalSpreadsheetText(source.component_code),
    optionalSpreadsheetText(source.component_label),
    optionalSpreadsheetText(source.claim_id),
    formatBoolean(source.recommended),
    spreadsheetKilometres(source.interval_km),
    source.interval_months,
    formatBoolean(source.whichever_first),
    optionalSpreadsheetText(source.conditions),
    source.original_value,
    optionalSpreadsheetText(source.original_unit),
    source.authority_rank,
    REPORT_COMPATIBILITY_LABELS_FI[source.compatibility],
    spreadsheetText(source.compatibility_notes),
    spreadsheetText(source.title),
    optionalSpreadsheetText(source.publisher),
    spreadsheetText(source.url),
    source.retrieved_at === null ? null : toExcelDate(source.retrieved_at),
    spreadsheetText(source.evidence),
  ]);

  addDataTable(sheet, "SourcesTable", headers, rows);
  setColumnWidths(sheet, [
    28, 23, 21, 24, 16, 18, 16, 14, 17, 35, 20, 22, 14, 18, 48, 38, 26, 52,
    14, 60,
  ]);
  setColumnFormats(sheet, sources.length, {
    7: "#,##0",
    8: "0",
    11: "#,##0.####",
    13: "0",
    19: "yyyy-mm-dd",
  });
  wrapColumns(sheet, sources.length, [10, 15, 16, 17, 18, 20]);
}

function addDataTable(
  sheet: Worksheet,
  name: string,
  headers: string[],
  rows: CellValue[][],
): void {
  sheet.addTable({
    name,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium4",
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: headers.map((header) => ({ name: header })),
    rows,
  });
  sheet.properties.defaultRowHeight = 18;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

function setColumnWidths(sheet: Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function setColumnFormats(
  sheet: Worksheet,
  rowCount: number,
  formats: Record<number, string>,
): void {
  if (rowCount === 0) {
    return;
  }
  Object.entries(formats).forEach(([column, format]) => {
    sheet.getColumn(Number(column)).numFmt = format;
  });
}

function wrapColumns(
  sheet: Worksheet,
  rowCount: number,
  columns: number[],
): void {
  if (rowCount === 0) {
    return;
  }
  columns.forEach((column) => {
    for (let row = 2; row <= rowCount + 1; row += 1) {
      sheet.getCell(row, column).alignment = {
        wrapText: true,
        vertical: "top",
      };
    }
  });
}

function formatActions(event: ReportServiceEvent): string {
  return event.actions
    .map(
      (action) =>
        `${action.component_label} (${ACTION_LABELS[action.action_type]}): ${action.description}`,
    )
    .join(" | ");
}

function formatBoolean(value: boolean | null): string | null {
  return value === null ? null : value ? "Kyllä" : "Ei";
}

function spreadsheetKilometres(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(4));
}

function writeSectionHeading(
  sheet: Worksheet,
  row: number,
  title: string,
): void {
  sheet.mergeCells(`A${row}:D${row}`);
  sheet.getCell(row, 1).value = title;
  sheet.getCell(row, 1).style = {
    fill: solidFill("365C4E"),
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 12 },
    alignment: { vertical: "middle" },
  };
  sheet.getRow(row).height = 24;
}

function styleHeaderRow(
  row: ExcelJS.Row,
  lastColumn: number,
): void {
  for (let column = 1; column <= lastColumn; column += 1) {
    row.getCell(column).style = {
      fill: solidFill("365C4E"),
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      alignment: { vertical: "middle" },
    };
  }
}

function solidFill(color: string): ExcelJS.Fill {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${color}` },
  };
}

function toExcelDate(value: string): Date {
  const date =
    value.length === 10
      ? new Date(`${value}T00:00:00.000Z`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid report date: ${value}.`);
  }
  return date;
}
