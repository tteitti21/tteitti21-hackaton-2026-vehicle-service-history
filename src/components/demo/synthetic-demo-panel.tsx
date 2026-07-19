"use client";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import { syntheticDemoSession } from "@/demo/synthetic-demo";

export function SyntheticDemoPanel() {
  const { state, loadDemoSession, resetSession } = useAnalysisSession();
  const hasSession =
    state.status !== "empty" &&
    state.status !== "reset";
  const canLoad = !hasSession;

  return (
    <section
      className={`demoSection ${state.demoMode ? "demoSectionLoaded" : ""}`}
      id="demo"
      aria-labelledby="demo-heading"
    >
      <div className="demoCopy">
        <p className="sectionLabel">Vaihe 9 / Synteettinen demo</p>
        <h2 id="demo-heading">Tutustu valmiiseen analyysiin ilman API-kutsuja.</h2>
        <p>
          Demo lataa vain selaimen muistiin kuvitteellisen Nordica Aurora
          -ajoneuvon, kolmen synteettisen asiakirjan poimintatuloksen,
          vaihtoehtoiset ajoneuvoversiot ja lähteisiin sidotun tutkimuksen.
          Demon lataaminen ei tee verkkopyyntöä. Vaiheiden
          uudelleen-hakupainikkeet kuuluvat normaaliin työnkulkuun ja
          käynnistävät painikkeen yhteydessä kuvatun pyynnön.
        </p>
        <ul>
          <li>100 000 mailin tapahtuma muunnettuna tarkasti kilometreiksi</li>
          <li>epäselvä huoltomerkintä ja puuttuva vaihtomerkintä</li>
          <li>ristiriitaiset lähteet ja riittämätön näyttö ilman arvausta</li>
          <li>paikallinen JSON- ja Excel-vienti</li>
        </ul>
      </div>
      <div className="demoActions">
        <div className="syntheticBadge">100 % SYNTEETTINEN</div>
        {state.demoMode ? (
          <>
            <p role="status">
              Demo on ladattu. Voit tarkistaa kaikki vaiheet ja raportin.
            </p>
            <a className="primaryButton" href="#report-heading">
              Siirry raporttiin
            </a>
            <button
              className="secondaryButton"
              type="button"
              onClick={resetSession}
            >
              Tyhjennä demo
            </button>
          </>
        ) : (
          <>
            <p>
              Valmis demo korvaa koko istunnon, joten se voidaan ladata vain
              tyhjään istuntoon.
            </p>
            <button
              className="primaryButton"
              type="button"
              disabled={!canLoad}
              onClick={() => loadDemoSession(syntheticDemoSession)}
            >
              Lataa synteettinen demo
            </button>
            {!canLoad ? (
              <p className="demoBlockedHint" role="status">
                Tyhjennä nykyinen istunto ennen demon lataamista.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
