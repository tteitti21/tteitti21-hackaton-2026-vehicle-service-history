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
        <p className="sectionLabel">Phase 9 / Synthetic demo</p>
        <h2 id="demo-heading">Explore a completed analysis without API calls.</h2>
        <p>
          The demo loads only into browser memory: a fictional Nordica Aurora
          vehicle, extraction results from three synthetic documents,
          alternative vehicle variants, and source-backed research. Loading
          the demo does not make a network request. The repeat-search buttons
          in each phase belong to the normal workflow and start the request
          described beside the button.
        </p>
        <ul>
          <li>a 100,000-mile event converted exactly to kilometres</li>
          <li>an ambiguous service record and a missing replacement record</li>
          <li>conflicting sources and insufficient evidence without guessing</li>
          <li>local JSON and Excel export</li>
        </ul>
      </div>
      <div className="demoActions">
        <div className="syntheticBadge">100% SYNTHETIC</div>
        {state.demoMode ? (
          <>
            <p role="status">
              The demo is loaded. You can review every phase and the report.
            </p>
            <a className="primaryButton" href="#report-heading">
              Go to report
            </a>
            <button
              className="secondaryButton"
              type="button"
              onClick={resetSession}
            >
              Clear demo
            </button>
          </>
        ) : (
          <>
            <p>
              The completed demo replaces the entire session, so it can only
              be loaded into an empty session.
            </p>
            <button
              className="primaryButton"
              type="button"
              disabled={!canLoad}
              onClick={() => loadDemoSession(syntheticDemoSession)}
            >
              Load synthetic demo
            </button>
            {!canLoad ? (
              <p className="demoBlockedHint" role="status">
                Clear the current session before loading the demo.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
