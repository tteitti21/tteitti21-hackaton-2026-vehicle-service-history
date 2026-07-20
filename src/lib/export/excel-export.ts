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
import { spreadsheetText } from "./spreadsheet-safety";

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

const ACTION_LABELS: Record<
  ReportServiceEvent["actions"][number]["action_type"],
  string
> = {
  replaced: "replaced",
  serviced: "serviced",
  repaired: "repaired",
  inspected: "inspected",
  adjusted: "adjusted",
  unknown: "unknown",
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

interface DetailRowOptions {
  numFmt?: string;
  valueStyle?: Partial<ExcelJS.Style>;
}

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
  workbook.title = `${report.vehicle.make} ${report.vehicle.model} – service report`;
  workbook.subject = "Locally generated vehicle service-history report";
  workbook.company = "AutoHuolto AI";
  workbook.calcProperties.fullCalcOnLoad = true;

  const summarySheet = createVerticalWorksheet(workbook, "Summary");
  const serviceSheet = createVerticalWorksheet(workbook, "Service history");
  const componentSheet = createVerticalWorksheet(workbook, "Components");
  const sourceSheet = createVerticalWorksheet(workbook, "Sources");

  writeServiceHistorySheet(serviceSheet, report.service_history);
  const componentLastRow = writeComponentSheet(
    componentSheet,
    report.components,
  );
  writeSourceSheet(sourceSheet, report.sources);
  writeSummarySheet(summarySheet, report, componentLastRow);

  return workbook;
}

function createVerticalWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
): Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [
      {
        state: "frozen",
        ySplit: 2,
        showGridLines: false,
      },
    ],
  });
  sheet.columns = [{ width: 30 }, { width: 68 }];
  sheet.properties.defaultRowHeight = 18;
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
  sheet.pageSetup.printTitlesRow = "1:2";
  return sheet;
}

function writeSummarySheet(
  sheet: Worksheet,
  report: VehicleReportModel,
  componentLastRow: number,
): void {
  writeSheetTitle(sheet, "AutoHuolto AI – service report");
  writeSheetNotice(
    sheet,
    "The report was generated locally in the browser. It does not contain images and was not sent to the server for export.",
  );

  let row = 4;
  row = writeSectionHeading(sheet, row, "Vehicle");
  const vehicleRows: Array<[string, CellValue, DetailRowOptions?]> = [
    ["Make", safeText(report.vehicle.make)],
    ["Model", safeText(report.vehicle.model)],
    ["Generation", textOr(report.vehicle.generation, "Unknown")],
    ["Model year", valueOr(report.vehicle.model_year, "Unknown")],
    [
      "First registration year",
      valueOr(report.vehicle.first_registration_year, "Unknown"),
    ],
    [
      "Engine displacement (l)",
      valueOr(report.vehicle.engine_displacement_litres, "Unknown"),
      { numFmt: "0.0#" },
    ],
    ["Engine code", textOr(report.vehicle.engine_code, "Unknown")],
    ["Power (kW)", valueOr(report.vehicle.power_kw, "Unknown")],
    ["Fuel type", textOr(report.vehicle.fuel_type, "Unknown")],
    [
      "Transmission type",
      textOr(report.vehicle.transmission_type, "Unknown"),
    ],
    [
      "Transmission code",
      textOr(report.vehicle.transmission_code, "Unknown"),
    ],
    ["Drivetrain", textOr(report.vehicle.drivetrain, "Unknown")],
    ["Country", safeText(report.vehicle.country)],
    ["Market", textOr(report.vehicle.market, "Unknown")],
    [
      "Current odometer reading (km)",
      report.vehicle.current_odometer_km,
      { numFmt: "#,##0" },
    ],
    [
      "Confirmed engine",
      textOr(report.vehicle.resolved_variant.engine, "Unknown"),
    ],
    [
      "Confirmed transmission",
      textOr(report.vehicle.resolved_variant.transmission, "Unknown"),
    ],
    [
      "Variant compatibility",
      REPORT_COMPATIBILITY_LABELS_FI[
        report.vehicle.resolution.compatibility
      ],
    ],
    [
      "Variant uncertainty",
      safeText(
        [
          ...new Set([
            report.vehicle.resolution.compatibility_explanation,
            ...report.vehicle.resolution.missing_distinguishing_fields,
            ...report.vehicle.resolution.unresolved_variant_fields,
          ]),
        ].join(" | "),
      ),
    ],
    [
      "Additional details",
      textOr(report.vehicle.additional_details, "No additional details"),
    ],
  ];
  for (const [label, value, options] of vehicleRows) {
    row = writeDetailRow(sheet, row, label, value, options);
  }

  row += 1;
  row = writeSectionHeading(sheet, row, "Component statuses");
  for (const status of STATUS_ORDER) {
    row = writeDetailRow(
      sheet,
      row,
      `${REPORT_STATUS_LABELS_FI[status]} (${status})`,
      {
        formula: `COUNTIF('Components'!$B$1:$B$${componentLastRow},"${status}")`,
        result: report.summary.status_counts[status],
      },
      {
        numFmt: "0",
        valueStyle: {
          fill: solidFill(STATUS_COLORS[status].fill),
          font: {
            bold: true,
            color: { argb: `FF${STATUS_COLORS[status].font}` },
          },
        },
      },
    );
  }

  row += 1;
  row = writeSectionHeading(sheet, row, "Report details");
  const metadataRows: Array<[string, CellValue, DetailRowOptions?]> = [
    [
      "Generated",
      toExcelDate(report.metadata.generated_at),
      { numFmt: "yyyy-mm-dd hh:mm" },
    ],
    [
      "Calculation date",
      toExcelDate(report.metadata.analysis_date),
      { numFmt: "yyyy-mm-dd" },
    ],
    ["Service events", report.summary.service_event_count],
    ["Components", report.summary.component_count],
    ["Source rows", report.summary.source_count],
    [
      "Highest priority",
      report.summary.highest_priority_status === null
        ? "No calculated status"
        : REPORT_STATUS_LABELS_FI[report.summary.highest_priority_status],
    ],
    ["Report schema", report.metadata.schema_version],
  ];
  for (const [label, value, options] of metadataRows) {
    row = writeDetailRow(sheet, row, label, value, options);
  }

  row += 1;
  row = writeSectionHeading(sheet, row, "Warnings and scope");
  const warnings = [
    ...report.warnings.service_history,
    ...report.warnings.vehicle_resolution,
    ...report.warnings.maintenance_research,
  ];
  row = writeDetailRow(
    sheet,
    row,
    "Warnings",
    safeText(warnings.join("\n") || "No separate warnings."),
  );
  writeDetailRow(
    sheet,
    row,
    "Scope",
    safeText(report.metadata.disclaimer_fi),
    {
      valueStyle: {
        font: { italic: true, color: { argb: "FF5F6864" } },
      },
    },
  );
}

function writeServiceHistorySheet(
  sheet: Worksheet,
  events: ReportServiceEvent[],
): void {
  writeSheetTitle(sheet, "Reviewed service history");
  writeSheetNotice(
    sheet,
    "Each event is its own vertical record. Original values and uncertainties are preserved.",
  );

  let row = 4;
  if (events.length === 0) {
    writeDetailRow(
      sheet,
      row,
      "Service history",
      "No service-history entry was found.",
    );
    return;
  }

  for (const [eventIndex, event] of events.entries()) {
    row = writeRecordHeading(
      sheet,
      row,
      `Event ${eventIndex + 1}: ${safeText(event.event_id)}`,
    );
    const serviceDate =
      event.service_date === null
        ? "Date unknown"
        : event.service_date.precision === "day"
          ? toExcelDate(event.service_date.value)
          : safeText(event.service_date.value);
    row = writeDetailRow(sheet, row, "Event ID", safeText(event.event_id));
    row = writeDetailRow(sheet, row, "Service date", serviceDate, {
      numFmt:
        event.service_date?.precision === "day"
          ? "yyyy-mm-dd"
          : undefined,
    });
    row = writeDetailRow(
      sheet,
      row,
      "Date precision",
      textOr(event.service_date?.precision, "Unknown"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Date confidence",
      valueOr(event.service_date?.confidence, "Not assessed"),
      { numFmt: "0%" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Odometer reading (km)",
      valueOr(event.odometer_km, "Odometer reading unknown"),
      { numFmt: "#,##0.####" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Original odometer reading",
      event.original_odometer_value === null ||
        event.original_odometer_unit === null
        ? "Original odometer reading was not reported"
        : safeText(
            `${event.original_odometer_value} ${event.original_odometer_unit}`,
          ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Odometer confidence",
      valueOr(event.odometer_confidence, "Not assessed"),
      { numFmt: "0%" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Workshop",
      textOr(event.workshop, "Workshop unknown"),
    );
    if (event.actions.length === 0) {
      row = writeDetailRow(
        sheet,
        row,
        "Actions",
        "No identified actions",
      );
    } else {
      for (const [actionIndex, action] of event.actions.entries()) {
        row = writeDetailRow(
          sheet,
          row,
          `Action ${actionIndex + 1}`,
          safeText(
            `${action.component_label} [${action.component_code}] – ${ACTION_LABELS[action.action_type]} – ${action.description} – confidence ${Math.round(action.confidence * 100)}%`,
          ),
        );
      }
    }
    row = writeDetailRow(
      sheet,
      row,
      "Raw evidence",
      textOr(event.raw_evidence, "No raw text"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Notes",
      textOr(event.notes, "No notes"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Uncertainties",
      safeText(event.ambiguities.join(" | ") || "No separate uncertainties"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Event confidence",
      event.confidence,
      { numFmt: "0%" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Source image identifiers",
      safeText(
        event.source_image_ids.join(" | ") ||
          "No source image identifier",
      ),
    );
    row += 1;
  }
}

function writeComponentSheet(
  sheet: Worksheet,
  components: ReportComponent[],
): number {
  writeSheetTitle(sheet, "Component maintenance status");
  writeSheetNotice(
    sheet,
    "All standard components for the vehicle powertrain are shown even when the service history or sources contain no entry for them.",
  );

  let row = 4;
  for (const [index, component] of components.entries()) {
    const colors = STATUS_COLORS[component.status];
    row = writeRecordHeading(
      sheet,
      row,
      `${index + 1}. ${safeText(component.component_label)} – ${component.status_label_fi}`,
      colors,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Component code",
      component.component_code,
    );
    row = writeDetailRow(sheet, row, "Status code", component.status, {
      valueStyle: {
        fill: solidFill(colors.fill),
        font: {
          bold: true,
          color: { argb: `FF${colors.font}` },
        },
      },
    });
    row = writeDetailRow(
      sheet,
      row,
      "Status",
      component.status_label_fi,
    );
    row = writeDetailRow(
      sheet,
      row,
      "trustworthiness_level",
      `${component.trustworthiness_label_fi} (${component.trustworthiness_level})`,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Trustworthiness rationale",
      safeText(component.trustworthiness_note_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Maintenance recommendation",
      safeText(component.maintenance_suggestion_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Service-history coverage",
      safeText(component.service_history_note_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Source resolution",
      REPORT_RESOLUTION_LABELS_FI[component.resolution],
    );
    row = writeDetailRow(
      sheet,
      row,
      "Conflict or uncertainty",
      textOr(
        component.conflict_summary,
        component.resolution === "insufficient_evidence"
          ? "No conflict to resolve; sufficient source evidence is missing."
          : "No source conflict.",
      ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Reason codes",
      safeText(component.reason_codes.join(" | ") || "No reason codes"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Preserved maintenance interval claims",
      component.interval_claim_count,
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Selected claim",
      textOr(
        component.recommended_claim_id,
        component.resolution === "conflicting_sources"
          ? "No automatic selection because of a source conflict"
          : "No verified claim",
      ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Maintenance interval (km)",
      valueOr(
        component.recommended_interval_km,
        "No verified distance interval",
      ),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Maintenance interval (months)",
      valueOr(
        component.recommended_interval_months,
        "No verified time interval",
      ),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Whichever comes first",
      component.whichever_first === null
        ? "No applicable combined interval"
        : formatBoolean(component.whichever_first),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Operating conditions",
      textOr(component.conditions, "No separate operating conditions"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Latest service event",
      textOr(
        component.last_service_event_id,
        "No selected service event",
      ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Distance used (km)",
      valueOr(component.distance_used_km, "Cannot be calculated"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Distance remaining (km)",
      valueOr(component.distance_remaining_km, "Cannot be calculated"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Time used (months)",
      valueOr(component.months_used, "Cannot be calculated"),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Time remaining (months)",
      valueOr(component.months_remaining, "Cannot be calculated"),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Due odometer (km)",
      valueOr(component.due_odometer_km, "Cannot be calculated"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Due date",
      component.due_date === null
        ? "Cannot be calculated"
        : toExcelDate(component.due_date),
      { numFmt: "yyyy-mm-dd" },
    );
    row += 1;
  }

  if (components.length === 0) {
    row = writeDetailRow(
      sheet,
      row,
      "Components",
      "Component details are not available.",
    );
  }

  return row;
}

function writeSourceSheet(
  sheet: Worksheet,
  sources: ReportSource[],
): void {
  writeSheetTitle(sheet, "Sources and preserved claims");
  writeSheetNotice(
    sheet,
    "Each source claim is preserved as its own vertical record. Conflicting claims are not merged or averaged.",
  );

  let row = 4;
  if (sources.length === 0) {
    writeDetailRow(
      sheet,
      row,
      "Sources",
      "The report contains no sources. Maintenance recommendations must not be interpreted as verified.",
    );
    return;
  }

  for (const [index, source] of sources.entries()) {
    row = writeRecordHeading(
      sheet,
      row,
      `${index + 1}. ${safeText(source.component_label ?? "Vehicle variant")} – ${safeText(source.title)}`,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Source ID",
      safeText(source.source_id),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Source role",
      source.source_scope === "vehicle_resolution"
        ? "Vehicle variant"
        : "Maintenance interval",
    );
    row = writeDetailRow(
      sheet,
      row,
      "Component",
      textOr(source.component_label, "Vehicle variant"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Component code",
      textOr(source.component_code, "Not component-specific"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Claim ID",
      textOr(source.claim_id, "No maintenance interval claim"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Selected recommendation",
      source.recommended === null
        ? "Not applicable to a vehicle source"
        : formatBoolean(source.recommended),
    );
    row = writeDetailRow(
      sheet,
      row,
      "trustworthiness_level",
      `${source.trustworthiness_label_fi} (${source.trustworthiness_level})`,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Trustworthiness rationale",
      safeText(source.trustworthiness_note_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Maintenance interval (km)",
      valueOr(source.interval_km, "No distance claim"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Maintenance interval (months)",
      valueOr(source.interval_months, "No time claim"),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Whichever comes first",
      source.whichever_first === null
        ? "No applicable combined interval"
        : formatBoolean(source.whichever_first),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Operating conditions",
      textOr(source.conditions, "No separate operating conditions"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Original value",
      source.original_value === null || source.original_unit === null
        ? "No original interval value"
        : safeText(`${source.original_value} ${source.original_unit}`),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Source tier",
      valueOr(source.authority_rank, "No maintenance interval source tier"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Compatibility",
      `${REPORT_COMPATIBILITY_LABELS_FI[source.compatibility]} (${source.compatibility})`,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Compatibility rationale",
      safeText(source.compatibility_notes),
    );
    row = writeDetailRow(sheet, row, "Title", safeText(source.title));
    row = writeDetailRow(
      sheet,
      row,
      "Publisher",
      textOr(source.publisher, "Publisher unknown"),
    );
    row = writeDetailRow(sheet, row, "URL", safeText(source.url));
    row = writeDetailRow(
      sheet,
      row,
      "Retrieved",
      source.retrieved_at === null
        ? "Retrieval date unknown"
        : toExcelDate(source.retrieved_at),
      { numFmt: "yyyy-mm-dd" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Source evidence",
      safeText(source.evidence),
    );
    row += 1;
  }
}

function writeSheetTitle(sheet: Worksheet, title: string): void {
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").style = {
    fill: solidFill("153C30"),
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 18 },
    alignment: { vertical: "middle" },
  };
  sheet.getRow(1).height = 32;
}

function writeSheetNotice(sheet: Worksheet, notice: string): void {
  sheet.mergeCells("A2:B2");
  sheet.getCell("A2").value = notice;
  sheet.getCell("A2").style = {
    fill: solidFill("DDEBE3"),
    font: { color: { argb: "FF234B3B" }, italic: true },
    alignment: { wrapText: true, vertical: "middle" },
  };
  sheet.getRow(2).height = 34;
}

function writeSectionHeading(
  sheet: Worksheet,
  row: number,
  title: string,
): number {
  sheet.mergeCells(`A${row}:B${row}`);
  sheet.getCell(row, 1).value = title;
  sheet.getCell(row, 1).style = {
    fill: solidFill("365C4E"),
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 12 },
    alignment: { vertical: "middle" },
  };
  sheet.getRow(row).height = 24;
  return row + 1;
}

function writeRecordHeading(
  sheet: Worksheet,
  row: number,
  title: string,
  colors: { fill: string; font: string } = {
    fill: "E7EEE9",
    font: "234B3B",
  },
): number {
  sheet.mergeCells(`A${row}:B${row}`);
  sheet.getCell(row, 1).value = title;
  sheet.getCell(row, 1).style = {
    fill: solidFill(colors.fill),
    font: { bold: true, color: { argb: `FF${colors.font}` }, size: 11 },
    alignment: { wrapText: true, vertical: "middle" },
  };
  sheet.getRow(row).height = 23;
  return row + 1;
}

function writeDetailRow(
  sheet: Worksheet,
  row: number,
  label: string,
  value: CellValue,
  options: DetailRowOptions = {},
): number {
  const labelCell = sheet.getCell(row, 1);
  const valueCell = sheet.getCell(row, 2);
  labelCell.value = label;
  valueCell.value = value;
  labelCell.style = {
    fill: solidFill("F3F6F4"),
    font: { bold: true, color: { argb: "FF365C4E" } },
    alignment: { wrapText: true, vertical: "top" },
    border: {
      bottom: { style: "hair", color: { argb: "FFD6DFDA" } },
    },
  };
  valueCell.style = {
    alignment: { wrapText: true, vertical: "top" },
    border: {
      bottom: { style: "hair", color: { argb: "FFD6DFDA" } },
    },
    ...options.valueStyle,
  };
  if (options.numFmt !== undefined && typeof value !== "string") {
    valueCell.numFmt = options.numFmt;
  }
  return row + 1;
}

function safeText(value: string): string {
  return spreadsheetText(value);
}

function textOr(
  value: string | null | undefined,
  fallback: string,
): string {
  return safeText(
    value === null || value === undefined || value === ""
      ? fallback
      : value,
  );
}

function valueOr(
  value: number | null | undefined,
  fallback: string,
): number | string {
  return value === null || value === undefined ? fallback : value;
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
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
