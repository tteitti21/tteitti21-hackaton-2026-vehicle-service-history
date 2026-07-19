import type { VehicleReportModel } from "@/domain/report/report-model";

export function serializeVehicleReportJson(
  report: VehicleReportModel,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function createJsonReportBlob(report: VehicleReportModel): Blob {
  return new Blob([serializeVehicleReportJson(report)], {
    type: "application/json;charset=utf-8",
  });
}

export function createReportFilename(
  report: VehicleReportModel,
  extension: "json" | "xlsx",
): string {
  const vehicle = slugify(`${report.vehicle.make}-${report.vehicle.model}`);
  return `autohuolto-${vehicle || "ajoneuvo"}-${report.metadata.analysis_date}.${extension}`;
}

export function downloadBlobLocally(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fi-FI")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
