import { describe, expect, it } from "vitest";

import { deriveResearchComponents } from "./research-components";

describe("deriveResearchComponents", () => {
  it("combines standard schedule categories with reviewed history actions", () => {
    const components = deriveResearchComponents({
      images: [],
      events: [
        {
          event_id: "event-1",
          source_image_ids: ["image-1"],
          raw_evidence: "Akku vaihdettu",
          service_date: null,
          odometer: null,
          actions: [
            {
              component_code: "battery",
              component_label: "Käynnistysakku",
              action_type: "replaced",
              description: "Akku vaihdettu",
              confidence: 1,
            },
          ],
          workshop: null,
          notes: null,
          confidence: 1,
          ambiguities: [],
        },
      ],
      warnings: [],
    });

    expect(components).toContainEqual({
      component_code: "engine_oil",
      component_label: expect.any(String),
    });
    expect(components).toContainEqual({
      component_code: "battery",
      component_label: "Käynnistysakku",
    });
    expect(
      components.filter(({ component_code }) => component_code === "battery"),
    ).toHaveLength(1);
  });
});
