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
  workbook.title = `${report.vehicle.make} ${report.vehicle.model} – huoltoraportti`;
  workbook.subject = "Paikallisesti luotu ajoneuvon huoltohistorian raportti";
  workbook.company = "AutoHuolto AI";
  workbook.calcProperties.fullCalcOnLoad = true;

  const summarySheet = createVerticalWorksheet(workbook, "Yhteenveto");
  const serviceSheet = createVerticalWorksheet(workbook, "Huoltohistoria");
  const componentSheet = createVerticalWorksheet(workbook, "Komponentit");
  const sourceSheet = createVerticalWorksheet(workbook, "Lähteet");

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
  writeSheetTitle(sheet, "AutoHuolto AI – huoltoraportti");
  writeSheetNotice(
    sheet,
    "Raportti luotiin paikallisesti selaimessa. Se ei sisällä kuvia eikä sitä lähetetty vientiä varten palvelimelle.",
  );

  let row = 4;
  row = writeSectionHeading(sheet, row, "Ajoneuvo");
  const vehicleRows: Array<[string, CellValue, DetailRowOptions?]> = [
    ["Merkki", safeText(report.vehicle.make)],
    ["Malli", safeText(report.vehicle.model)],
    ["Sukupolvi", textOr(report.vehicle.generation, "Ei tiedossa")],
    ["Mallivuosi", valueOr(report.vehicle.model_year, "Ei tiedossa")],
    [
      "Ensirekisteröintivuosi",
      valueOr(report.vehicle.first_registration_year, "Ei tiedossa"),
    ],
    [
      "Moottorin tilavuus (l)",
      valueOr(report.vehicle.engine_displacement_litres, "Ei tiedossa"),
      { numFmt: "0.0#" },
    ],
    ["Moottorikoodi", textOr(report.vehicle.engine_code, "Ei tiedossa")],
    ["Teho (kW)", valueOr(report.vehicle.power_kw, "Ei tiedossa")],
    ["Käyttövoima", textOr(report.vehicle.fuel_type, "Ei tiedossa")],
    [
      "Vaihteistotyyppi",
      textOr(report.vehicle.transmission_type, "Ei tiedossa"),
    ],
    [
      "Vaihteistokoodi",
      textOr(report.vehicle.transmission_code, "Ei tiedossa"),
    ],
    ["Vetotapa", textOr(report.vehicle.drivetrain, "Ei tiedossa")],
    ["Maa", safeText(report.vehicle.country)],
    ["Markkina", textOr(report.vehicle.market, "Ei tiedossa")],
    [
      "Nykyinen mittarilukema (km)",
      report.vehicle.current_odometer_km,
      { numFmt: "#,##0" },
    ],
    [
      "Vahvistettu moottori",
      textOr(report.vehicle.resolved_variant.engine, "Ei tiedossa"),
    ],
    [
      "Vahvistettu vaihteisto",
      textOr(report.vehicle.resolved_variant.transmission, "Ei tiedossa"),
    ],
    [
      "Variantin yhteensopivuus",
      REPORT_COMPATIBILITY_LABELS_FI[
        report.vehicle.resolution.compatibility
      ],
    ],
    [
      "Variantin epävarmuus",
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
      "Lisätiedot",
      textOr(report.vehicle.additional_details, "Ei lisätietoja"),
    ],
  ];
  for (const [label, value, options] of vehicleRows) {
    row = writeDetailRow(sheet, row, label, value, options);
  }

  row += 1;
  row = writeSectionHeading(sheet, row, "Komponenttien tilat");
  for (const status of STATUS_ORDER) {
    row = writeDetailRow(
      sheet,
      row,
      `${REPORT_STATUS_LABELS_FI[status]} (${status})`,
      {
        formula: `COUNTIF('Komponentit'!$B$1:$B$${componentLastRow},"${status}")`,
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
  row = writeSectionHeading(sheet, row, "Raportin tiedot");
  const metadataRows: Array<[string, CellValue, DetailRowOptions?]> = [
    [
      "Luotu",
      toExcelDate(report.metadata.generated_at),
      { numFmt: "yyyy-mm-dd hh:mm" },
    ],
    [
      "Laskentapäivä",
      toExcelDate(report.metadata.analysis_date),
      { numFmt: "yyyy-mm-dd" },
    ],
    ["Huoltotapahtumia", report.summary.service_event_count],
    ["Komponentteja", report.summary.component_count],
    ["Lähderivejä", report.summary.source_count],
    [
      "Korkein prioriteetti",
      report.summary.highest_priority_status === null
        ? "Ei laskettua tilaa"
        : REPORT_STATUS_LABELS_FI[report.summary.highest_priority_status],
    ],
    ["Raporttiskeema", report.metadata.schema_version],
  ];
  for (const [label, value, options] of metadataRows) {
    row = writeDetailRow(sheet, row, label, value, options);
  }

  row += 1;
  row = writeSectionHeading(sheet, row, "Varoitukset ja rajaukset");
  const warnings = [
    ...report.warnings.service_history,
    ...report.warnings.vehicle_resolution,
    ...report.warnings.maintenance_research,
  ];
  row = writeDetailRow(
    sheet,
    row,
    "Varoitukset",
    safeText(warnings.join("\n") || "Ei erillisiä varoituksia."),
  );
  writeDetailRow(
    sheet,
    row,
    "Rajaus",
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
  writeSheetTitle(sheet, "Tarkistettu huoltohistoria");
  writeSheetNotice(
    sheet,
    "Jokainen tapahtuma on oma pystysuuntainen tietueensa. Alkuperäiset arvot ja epävarmuudet säilytetään.",
  );

  let row = 4;
  if (events.length === 0) {
    writeDetailRow(
      sheet,
      row,
      "Huoltohistoria",
      "Huoltohistoriasta ei löytynyt merkintää.",
    );
    return;
  }

  for (const [eventIndex, event] of events.entries()) {
    row = writeRecordHeading(
      sheet,
      row,
      `Tapahtuma ${eventIndex + 1}: ${safeText(event.event_id)}`,
    );
    const serviceDate =
      event.service_date === null
        ? "Päivämäärä ei tiedossa"
        : event.service_date.precision === "day"
          ? toExcelDate(event.service_date.value)
          : safeText(event.service_date.value);
    row = writeDetailRow(sheet, row, "Tapahtuma-ID", safeText(event.event_id));
    row = writeDetailRow(sheet, row, "Huoltopäivä", serviceDate, {
      numFmt:
        event.service_date?.precision === "day"
          ? "yyyy-mm-dd"
          : undefined,
    });
    row = writeDetailRow(
      sheet,
      row,
      "Päivän tarkkuus",
      textOr(event.service_date?.precision, "Ei tiedossa"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Päivän luottamus",
      valueOr(event.service_date?.confidence, "Ei arvioitu"),
      { numFmt: "0%" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Mittarilukema (km)",
      valueOr(event.odometer_km, "Mittarilukema ei tiedossa"),
      { numFmt: "#,##0.####" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Alkuperäinen mittarilukema",
      event.original_odometer_value === null ||
        event.original_odometer_unit === null
        ? "Alkuperäistä mittarilukemaa ei ilmoitettu"
        : safeText(
            `${event.original_odometer_value} ${event.original_odometer_unit}`,
          ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Mittarilukeman luottamus",
      valueOr(event.odometer_confidence, "Ei arvioitu"),
      { numFmt: "0%" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Korjaamo",
      textOr(event.workshop, "Korjaamo ei tiedossa"),
    );
    if (event.actions.length === 0) {
      row = writeDetailRow(
        sheet,
        row,
        "Toimenpiteet",
        "Ei tunnistettuja toimenpiteitä",
      );
    } else {
      for (const [actionIndex, action] of event.actions.entries()) {
        row = writeDetailRow(
          sheet,
          row,
          `Toimenpide ${actionIndex + 1}`,
          safeText(
            `${action.component_label} [${action.component_code}] – ${ACTION_LABELS[action.action_type]} – ${action.description} – luottamus ${Math.round(action.confidence * 100)} %`,
          ),
        );
      }
    }
    row = writeDetailRow(
      sheet,
      row,
      "Raaka näyttö",
      textOr(event.raw_evidence, "Ei raakatekstiä"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Muistiinpanot",
      textOr(event.notes, "Ei muistiinpanoja"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Epävarmuudet",
      safeText(event.ambiguities.join(" | ") || "Ei erillisiä epävarmuuksia"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Tapahtuman luottamus",
      event.confidence,
      { numFmt: "0%" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Lähdekuvien tunnisteet",
      safeText(
        event.source_image_ids.join(" | ") ||
          "Ei lähdekuvan tunnistetta",
      ),
    );
    row += 1;
  }
}

function writeComponentSheet(
  sheet: Worksheet,
  components: ReportComponent[],
): number {
  writeSheetTitle(sheet, "Komponenttien huoltotilanne");
  writeSheetNotice(
    sheet,
    "Kaikki ajoneuvon voimalinjaan kuuluvat vakiokomponentit näytetään, vaikka huoltohistoriassa tai lähteissä ei olisi niistä merkintää.",
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
      "Komponenttikoodi",
      component.component_code,
    );
    row = writeDetailRow(sheet, row, "Tilakoodi", component.status, {
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
      "Tila",
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
      "Luotettavuuden perustelu",
      safeText(component.trustworthiness_note_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Huoltosuositus",
      safeText(component.maintenance_suggestion_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Huoltohistorian kattavuus",
      safeText(component.service_history_note_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Lähderatkaisu",
      REPORT_RESOLUTION_LABELS_FI[component.resolution],
    );
    row = writeDetailRow(
      sheet,
      row,
      "Ristiriita tai epävarmuus",
      textOr(
        component.conflict_summary,
        component.resolution === "insufficient_evidence"
          ? "Ei ratkaistavaa ristiriitaa; riittävä lähdenäyttö puuttuu."
          : "Ei lähderistiriitaa.",
      ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Syykoodit",
      safeText(component.reason_codes.join(" | ") || "Ei syykoodeja"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Säilytettyjä huoltoväliväitteitä",
      component.interval_claim_count,
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Valittu väite",
      textOr(
        component.recommended_claim_id,
        component.resolution === "conflicting_sources"
          ? "Ei automaattista valintaa lähderistiriidan vuoksi"
          : "Ei varmennettua väitettä",
      ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Huoltoväli (km)",
      valueOr(
        component.recommended_interval_km,
        "Ei varmennettua kilometriväliä",
      ),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Huoltoväli (kk)",
      valueOr(
        component.recommended_interval_months,
        "Ei varmennettua aikaväliä",
      ),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Ensin täyttyvä",
      component.whichever_first === null
        ? "Ei sovellettavaa yhdistelmäväliä"
        : formatBoolean(component.whichever_first),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Käyttöehdot",
      textOr(component.conditions, "Ei erillisiä käyttöehtoja"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Viimeisin huoltotapahtuma",
      textOr(
        component.last_service_event_id,
        "Ei valittua huoltotapahtumaa",
      ),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Käytetty matka (km)",
      valueOr(component.distance_used_km, "Ei laskettavissa"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Matkaa jäljellä (km)",
      valueOr(component.distance_remaining_km, "Ei laskettavissa"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Käytetty aika (kk)",
      valueOr(component.months_used, "Ei laskettavissa"),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Aikaa jäljellä (kk)",
      valueOr(component.months_remaining, "Ei laskettavissa"),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Erääntymislukema (km)",
      valueOr(component.due_odometer_km, "Ei laskettavissa"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Erääntymispäivä",
      component.due_date === null
        ? "Ei laskettavissa"
        : toExcelDate(component.due_date),
      { numFmt: "yyyy-mm-dd" },
    );
    row += 1;
  }

  if (components.length === 0) {
    row = writeDetailRow(
      sheet,
      row,
      "Komponentit",
      "Komponenttitietoja ei ole saatavilla.",
    );
  }

  return row;
}

function writeSourceSheet(
  sheet: Worksheet,
  sources: ReportSource[],
): void {
  writeSheetTitle(sheet, "Lähteet ja säilytetyt väitteet");
  writeSheetNotice(
    sheet,
    "Jokainen lähdeväite säilytetään omana pystysuuntaisena tietueenaan. Ristiriitaisia väitteitä ei yhdistetä eikä keskiarvoisteta.",
  );

  let row = 4;
  if (sources.length === 0) {
    writeDetailRow(
      sheet,
      row,
      "Lähteet",
      "Raportissa ei ole lähteitä. Huoltosuosituksia ei tule tulkita varmennetuiksi.",
    );
    return;
  }

  for (const [index, source] of sources.entries()) {
    row = writeRecordHeading(
      sheet,
      row,
      `${index + 1}. ${safeText(source.component_label ?? "Ajoneuvoversio")} – ${safeText(source.title)}`,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Lähde-ID",
      safeText(source.source_id),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Lähteen rooli",
      source.source_scope === "vehicle_resolution"
        ? "Ajoneuvoversio"
        : "Huoltoväli",
    );
    row = writeDetailRow(
      sheet,
      row,
      "Komponentti",
      textOr(source.component_label, "Ajoneuvoversio"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Komponenttikoodi",
      textOr(source.component_code, "Ei komponenttikohtainen"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Väite-ID",
      textOr(source.claim_id, "Ei huoltoväliväitettä"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Valittu suositus",
      source.recommended === null
        ? "Ei sovellu ajoneuvolähteeseen"
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
      "Luotettavuuden perustelu",
      safeText(source.trustworthiness_note_fi),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Huoltoväli (km)",
      valueOr(source.interval_km, "Ei kilometriväitettä"),
      { numFmt: "#,##0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Huoltoväli (kk)",
      valueOr(source.interval_months, "Ei aikaväitettä"),
      { numFmt: "0" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Ensin täyttyvä",
      source.whichever_first === null
        ? "Ei sovellettavaa yhdistelmäväliä"
        : formatBoolean(source.whichever_first),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Käyttöehdot",
      textOr(source.conditions, "Ei erillisiä käyttöehtoja"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Alkuperäinen arvo",
      source.original_value === null || source.original_unit === null
        ? "Ei alkuperäistä väliarvoa"
        : safeText(`${source.original_value} ${source.original_unit}`),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Lähdetaso",
      valueOr(source.authority_rank, "Ei huoltovälilähteen tasoa"),
    );
    row = writeDetailRow(
      sheet,
      row,
      "Yhteensopivuus",
      `${REPORT_COMPATIBILITY_LABELS_FI[source.compatibility]} (${source.compatibility})`,
    );
    row = writeDetailRow(
      sheet,
      row,
      "Yhteensopivuuden perustelu",
      safeText(source.compatibility_notes),
    );
    row = writeDetailRow(sheet, row, "Otsikko", safeText(source.title));
    row = writeDetailRow(
      sheet,
      row,
      "Julkaisija",
      textOr(source.publisher, "Julkaisija ei tiedossa"),
    );
    row = writeDetailRow(sheet, row, "URL", safeText(source.url));
    row = writeDetailRow(
      sheet,
      row,
      "Haettu",
      source.retrieved_at === null
        ? "Hakupäivä ei tiedossa"
        : toExcelDate(source.retrieved_at),
      { numFmt: "yyyy-mm-dd" },
    );
    row = writeDetailRow(
      sheet,
      row,
      "Lähdenäyttö",
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
  return value ? "Kyllä" : "Ei";
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
