import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "AutoHuolto AI data-handling principles.",
};

const protections = [
  {
    title: "No permanent application storage",
    text: "Uploaded images, vehicle details, extracted service events, research results, and reports are not stored in an application database or file storage.",
  },
  {
    title: "Redaction happens in the browser",
    text: "The user redacts identifiers locally. The browser draws a new PNG image for submission, and the original image file is not used in the submission package.",
  },
  {
    title: "Only necessary data is submitted",
    text: "Only user-approved sanitized images and the vehicle and maintenance details needed for analysis are submitted to OpenAI.",
  },
  {
    title: "The session ends when the page closes",
    text: "Vehicle details and analysis state are kept only in browser memory. Closing or refreshing the page removes the current session.",
  },
];

export default function PrivacyPage() {
  return (
    <main id="sisalto" className="privacyPage">
      <div className="pageIntro">
        <p className="sectionLabel">Privacy</p>
        <h1>Data handling is limited to one session.</h1>
        <p>
          AutoHuolto AI is stateless at the application level. This does not
          mean verified zero retention by the provider.
        </p>
      </div>

      <section className="disclosure" aria-labelledby="disclosure-heading">
        <p className="sectionLabel">In plain language</p>
        <h2 id="disclosure-heading">What happens during analysis?</h2>
        <p>
          The application intentionally does not store uploaded images,
          extracted service events, vehicle details, research results, or
          reports in its own database or file storage.
        </p>
        <p>
          When the user starts extraction, the approved sanitized PNG images
          are sent to OpenAI to process the request. API inputs and outputs are
          not used to train OpenAI models by default, but provider data
          retention and abuse monitoring policies may still apply.
        </p>
        <p>
          When the user starts vehicle-variant resolution, the confirmed
          vehicle details needed to distinguish the variant are sent to OpenAI
          and its web search tool. Images and the current odometer reading are
          not sent to this search. Candidates and search sources remain only in
          the current tab&apos;s memory.
        </p>
        <p>
          When the user starts maintenance interval research, the confirmed
          vehicle variant, country, market, and component categories being
          researched are sent to the research model. Images, service-history
          contents, and the current odometer reading are not included in the
          research model requests. The research memo, sources, and normalized
          result are processed per request and are not stored in the
          application&apos;s own database or file storage.
        </p>
        <p>
          Component maintenance statuses, remaining thresholds, and due
          estimates are then calculated in the browser by application code.
          Status calculation does not send another request to the provider or
          store the result permanently.
        </p>
        <p>
          JSON and Excel reports are generated locally in the browser after an
          explicit download request by the user. Original and sanitized images
          are not attached to the report, and export does not send a new
          network request. The downloaded file remains under the control of the
          user&apos;s device and selected storage location.
        </p>
      </section>

      <section aria-labelledby="protections-heading">
        <div className="sectionHeading">
          <div>
            <p className="sectionLabel">Protections</p>
            <h2 id="protections-heading">Built-in data minimization</h2>
          </div>
        </div>
        <div className="protectionGrid">
          {protections.map((protection) => (
            <article key={protection.title}>
              <h3>{protection.title}</h3>
              <p>{protection.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="userChecklist" aria-labelledby="checklist-heading">
        <div>
          <p className="sectionLabel">User checklist</p>
          <h2 id="checklist-heading">Before submitting images</h2>
        </div>
        <ul>
          <li>Redact the registration number and vehicle identification number (VIN).</li>
          <li>Redact names, addresses, and contact details.</li>
          <li>Redact customer numbers and other unnecessary identifiers.</li>
          <li>Always review the sanitized preview before submission.</li>
        </ul>
      </section>

      <aside className="providerNote" aria-labelledby="provider-heading">
        <h2 id="provider-heading">Provider policies</h2>
        <p>
          Current information about API service privacy and data handling is
          available in OpenAI&apos;s own terms. The application does not claim zero
          retention without a separately verified setting.
        </p>
        <a
          className="textLink"
          href="https://openai.com/enterprise-privacy/"
          target="_blank"
          rel="noreferrer"
        >
          OpenAI Enterprise Privacy <span aria-hidden="true">↗</span>
        </a>
      </aside>

      <Link className="backLink" href="/">
        <span aria-hidden="true">←</span> Back to home
      </Link>
    </main>
  );
}
