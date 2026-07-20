import Link from "next/link";

import { SyntheticDemoPanel } from "@/components/demo/synthetic-demo-panel";
import { ExtractionReview } from "@/components/extraction/extraction-review";
import { MaintenanceResearchPanel } from "@/components/research/maintenance-research";
import { VehicleReportPanel } from "@/components/report/vehicle-report";
import { ComponentStatusSummaryPanel } from "@/components/status/component-status-summary";
import { ImageRedactionWorkspace } from "@/components/upload/image-redaction-workspace";
import { VehicleForm } from "@/components/vehicle/vehicle-form";
import { VehicleResolutionPanel } from "@/components/vehicle/vehicle-resolution";
import { readUploadLimits } from "@/lib/validation/request-limits";

const steps = [
  {
    number: "01",
    title: "Describe the vehicle",
    description:
      "The exact vehicle variant is confirmed before maintenance intervals are researched.",
  },
  {
    number: "02",
    title: "Redact sensitive information",
    description:
      "Images are edited in the browser, and only a new sanitized image file is submitted.",
  },
  {
    number: "03",
    title: "Review the service history",
    description:
      "Events extracted from images can be reviewed and corrected before analysis.",
  },
  {
    number: "04",
    title: "Inspect results and sources",
    description:
      "Maintenance status is calculated in application code, and recommendations are linked to sources.",
  },
];

export default function Home() {
  const uploadLimits = readUploadLimits();

  return (
    <main id="sisalto">
      <section className="hero">
        <div className="eyebrow">
          <span aria-hidden="true" />
          Privacy first
        </div>
        <h1>A clear service history – without permanent storage.</h1>
        <p className="heroLead">
          AutoHuolto AI compiles the service history reviewed by the user,
          finds sources compatible with the vehicle variant, and helps identify
          what should be checked next.
        </p>
        <div className="phaseNotice" role="status">
          <span className="statusDot" aria-hidden="true" />
          <div>
            <strong>Phase 9 / MVP available</strong>
            <p>
              The complete stateless workflow is available, from local image
              redaction to source verification, deterministic status
              calculation, and local export. It also includes a synthetic demo,
              safe error states, privacy checks, and a responsive mobile
              interface.
            </p>
          </div>
        </div>
      </section>

      <SyntheticDemoPanel />

      <VehicleForm />

      <ImageRedactionWorkspace
        maxFiles={uploadLimits.maxFiles}
        maxBytesPerFile={uploadLimits.maxBytesPerFile}
        maxRequestBytes={uploadLimits.maxRequestBytes}
      />

      <ExtractionReview />

      <VehicleResolutionPanel />

      <MaintenanceResearchPanel />

      <ComponentStatusSummaryPanel />

      <VehicleReportPanel />

      <section className="privacyBand" aria-labelledby="privacy-heading">
        <div>
          <p className="sectionLabel">Privacy promise</p>
          <h2 id="privacy-heading">You decide what is submitted.</h2>
        </div>
        <div className="privacyCopy">
          <p>
            The application does not store images, vehicle details, extracted
            service events, or reports in its own database or file storage.
          </p>
          <p>
            When you start extraction, only the new PNG images sanitized in the
            browser are submitted to OpenAI. Provider retention and abuse
            monitoring policies may still apply to the processing.
          </p>
          <p>
            Vehicle-variant web search sends only confirmed variant details to
            OpenAI; images and the odometer reading are not used. Sources and
            candidates remain only in this tab&apos;s memory.
          </p>
          <p>
            Maintenance interval research sends the confirmed variant, country,
            market, and component categories to the research model. Images,
            service history, and odometer reading are not sent to the research
            model. The research result remains only in this tab&apos;s memory.
          </p>
          <Link className="textLink" href="/tietosuoja">
            How data is handled <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="processSection" aria-labelledby="process-heading">
        <div className="sectionHeading">
          <div>
            <p className="sectionLabel">Designed workflow</p>
            <h2 id="process-heading">Four controlled steps</h2>
          </div>
          <p>
            Nothing is submitted automatically. The user reviews the content
            before every analysis request.
          </p>
        </div>
        <ol className="stepGrid">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="stepNumber">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="truthSection" aria-labelledby="truth-heading">
        <p className="sectionLabel">Reliability before certainty</p>
        <h2 id="truth-heading">
          If the evidence is insufficient, the application says so directly.
        </h2>
        <blockquote>
          “The exact replacement interval could not be verified from
          sufficiently reliable sources compatible with this vehicle variant.”
        </blockquote>
        <p>
          AI is used to extract evidence and research sources. Maintenance
          timing is calculated separately and deterministically in application
          code.
        </p>
      </section>
    </main>
  );
}
