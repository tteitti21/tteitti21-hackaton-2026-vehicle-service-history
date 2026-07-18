import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tietosuoja",
  description: "AutoHuolto AI:n tietojen käsittelyn periaatteet.",
};

const protections = [
  {
    title: "Ei sovelluksen omaa pysyvää tallennusta",
    text: "Ladattuja kuvia, ajoneuvotietoja, poimittuja huoltotapahtumia, tutkimustuloksia tai raportteja ei tallenneta sovelluksen tietokantaan tai tiedostovarastoon.",
  },
  {
    title: "Peittäminen tapahtuu selaimessa",
    text: "Kun kuvatoiminto toteutetaan, käyttäjä peittää tunnisteet paikallisesti. Lähetystä varten luodaan uusi kuvatiedosto, eikä alkuperäistä kuvaa lähetetä palvelimelle.",
  },
  {
    title: "Vain tarpeellinen lähetetään",
    text: "OpenAI:lle lähetetään vain käyttäjän hyväksymät, peitetyt kuvat sekä analyysin kannalta tarpeelliset ajoneuvo- ja huoltotiedot.",
  },
  {
    title: "Istunto päättyy sivun sulkemiseen",
    text: "Analyysin tila pidetään vain selaimen muistissa. Sivun sulkeminen tai päivittäminen poistaa istunnon, kun myöhemmät analyysivaiheet on toteutettu.",
  },
];

export default function PrivacyPage() {
  return (
    <main id="sisalto" className="privacyPage">
      <div className="pageIntro">
        <p className="sectionLabel">Tietosuoja</p>
        <h1>Tietojen käsittely on rajattu yhteen istuntoon.</h1>
        <p>
          AutoHuolto AI on sovellustasolla tilaton. Tämä ei tarkoita
          palveluntarjoajan varmennettua nollasäilytystä.
        </p>
      </div>

      <section className="disclosure" aria-labelledby="disclosure-heading">
        <p className="sectionLabel">Selkeästi sanottuna</p>
        <h2 id="disclosure-heading">Mitä tapahtuu analyysin aikana?</h2>
        <p>
          Sovellus ei tarkoituksellisesti tallenna ladattuja kuvia, poimittuja
          huoltotapahtumia, ajoneuvotietoja, tutkimustuloksia tai raportteja
          omaan tietokantaan tai tiedostovarastoon.
        </p>
        <p>
          Kun analyysitoiminnot otetaan käyttöön, peitetyt kuvat ja analyysin
          syötteet välitetään OpenAI:lle pyynnön käsittelyä varten. API:n
          syötteitä ja tulosteita ei oletusarvoisesti käytetä OpenAI-mallien
          kouluttamiseen, mutta palveluntarjoajan tietojen säilytys- ja
          väärinkäytön valvontakäytännöt voivat silti olla voimassa.
        </p>
      </section>

      <section aria-labelledby="protections-heading">
        <div className="sectionHeading">
          <div>
            <p className="sectionLabel">Suojaukset</p>
            <h2 id="protections-heading">Sisäänrakennettu tietojen minimointi</h2>
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
          <p className="sectionLabel">Käyttäjän tarkistuslista</p>
          <h2 id="checklist-heading">Ennen myöhempää kuvalähetystä</h2>
        </div>
        <ul>
          <li>Peitä rekisterinumero ja valmistenumero (VIN).</li>
          <li>Peitä nimet, osoitteet ja yhteystiedot.</li>
          <li>Peitä asiakasnumerot ja muut tarpeettomat tunnisteet.</li>
          <li>Tarkista aina peitetty esikatselu ennen lähettämistä.</li>
        </ul>
      </section>

      <aside className="providerNote" aria-labelledby="provider-heading">
        <h2 id="provider-heading">Palveluntarjoajan käytännöt</h2>
        <p>
          Ajantasaiset tiedot API-palveluiden tietosuojasta ja tietojen
          käsittelystä löytyvät OpenAI:n omista ehdoista. Sovellus ei väitä
          nollasäilytystä ilman erikseen varmennettua asetusta.
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
        <span aria-hidden="true">←</span> Takaisin etusivulle
      </Link>
    </main>
  );
}
