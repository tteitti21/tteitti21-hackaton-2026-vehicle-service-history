import Link from "next/link";

import { ExtractionReview } from "@/components/extraction/extraction-review";
import { ImageRedactionWorkspace } from "@/components/upload/image-redaction-workspace";
import { VehicleForm } from "@/components/vehicle/vehicle-form";
import { readUploadLimits } from "@/lib/validation/request-limits";

const steps = [
  {
    number: "01",
    title: "Kuvaile ajoneuvo",
    description:
      "Ajoneuvon tarkka versio varmistetaan ennen huoltovälien tutkimista.",
  },
  {
    number: "02",
    title: "Peitä arkaluonteiset tiedot",
    description:
      "Kuvat muokataan selaimessa ja vain uusi, peitetty kuvatiedosto lähetetään.",
  },
  {
    number: "03",
    title: "Tarkista huoltohistoria",
    description:
      "Kuvista poimitut tapahtumat voi tarkistaa ja korjata ennen analyysiä.",
  },
  {
    number: "04",
    title: "Tutki tulokset ja lähteet",
    description:
      "Huoltojen tila lasketaan sovelluskoodissa ja suositukset sidotaan lähteisiin.",
  },
];

export default function Home() {
  const uploadLimits = readUploadLimits();

  return (
    <main id="sisalto">
      <section className="hero">
        <div className="eyebrow">
          <span aria-hidden="true" />
          Yksityisyys ensin
        </div>
        <h1>Huoltohistoria selkeäksi – ilman pysyvää tallennusta.</h1>
        <p className="heroLead">
          AutoHuolto AI kokoaa käyttäjän tarkistaman huoltohistorian, etsii
          ajoneuvoversioon sopivat lähteet ja auttaa näkemään, mitä kannattaa
          tarkistaa seuraavaksi.
        </p>
        <div className="phaseNotice" role="status">
          <span className="statusDot" aria-hidden="true" />
          <div>
            <strong>Vaihe 3 käytössä</strong>
            <p>
              Voit vahvistaa ajoneuvon tiedot sekä muokata ja peittää kuvat
              paikallisesti. Hyväksytyistä lähetysversioista voi poimia
              muokattavan huoltohistorian OpenAI:n avulla.
            </p>
          </div>
        </div>
      </section>

      <VehicleForm />

      <ImageRedactionWorkspace
        maxFiles={uploadLimits.maxFiles}
        maxBytesPerFile={uploadLimits.maxBytesPerFile}
        maxRequestBytes={uploadLimits.maxRequestBytes}
      />

      <ExtractionReview />

      <section className="privacyBand" aria-labelledby="privacy-heading">
        <div>
          <p className="sectionLabel">Tietosuojalupaus</p>
          <h2 id="privacy-heading">Sinä päätät, mitä lähetetään.</h2>
        </div>
        <div className="privacyCopy">
          <p>
            Sovellus ei tallenna kuvia, ajoneuvotietoja, poimittuja
            huoltotapahtumia tai raportteja omaan tietokantaan tai
            tiedostovarastoon.
          </p>
          <p>
            Kun käynnistät poiminnan, vain selaimessa peitetyt uudet PNG-kuvat
            lähetetään OpenAI:lle. Palveluntarjoajan säilytys- ja
            väärinkäytön valvontakäytännöt voivat silti koskea käsittelyä.
          </p>
          <Link className="textLink" href="/tietosuoja">
            Miten tietoja käsitellään <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="processSection" aria-labelledby="process-heading">
        <div className="sectionHeading">
          <div>
            <p className="sectionLabel">Suunniteltu työnkulku</p>
            <h2 id="process-heading">Neljä hallittua vaihetta</h2>
          </div>
          <p>
            Mitään ei lähetetä automaattisesti. Käyttäjä tarkistaa sisällön
            ennen jokaista analyysipyyntöä.
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
        <p className="sectionLabel">Luotettavuus ennen varmuutta</p>
        <h2 id="truth-heading">
          Jos näyttö ei riitä, sovellus kertoo sen suoraan.
        </h2>
        <blockquote>
          “Tarkkaa vaihtoväliä ei voitu varmistaa riittävän luotettavista, tähän
          ajoneuvovarianttiin sopivista lähteistä.”
        </blockquote>
        <p>
          Tekoälyä käytetään näytön poimintaan ja lähteiden tutkimiseen.
          Huoltojen ajankohtaisuus lasketaan erikseen, deterministisesti
          sovelluskoodissa.
        </p>
      </section>
    </main>
  );
}
