import { describe, expect, it } from "vitest";

import {
  componentCodeSchema,
  type ServiceAction,
} from "@/domain/schemas/service-history";
import {
  COMPONENT_TAXONOMY,
  getComponentLabel,
  inferComponentCode,
  resolveActionComponentCode,
} from "./component-taxonomy";

describe("component taxonomy", () => {
  it("maps Finnish and English evidence into canonical component codes", () => {
    expect(inferComponentCode("Jakopää vaihdettu")).toBe(
      "timing_belt",
    );
    expect(inferComponentCode("ATF service")).toBe("transmission_fluid");
    expect(inferComponentCode("Cabin filter replaced")).toBe("cabin_filter");
    expect(inferComponentCode("Vehicle platform inspected")).toBe("other");
  });

  it("keeps an explicit component selection ahead of a text suggestion", () => {
    const action: ServiceAction = {
      component_code: "brake_fluid",
      component_label: "Tarkistettu käyttäjän toimesta",
      action_type: "serviced",
      description: "ATF",
      confidence: 1,
    };

    expect(resolveActionComponentCode(action, "Vaihteistoöljy")).toBe(
      "brake_fluid",
    );
  });

  it("provides Finnish labels for the complete canonical taxonomy", () => {
    expect(COMPONENT_TAXONOMY.map((component) => component.code)).toEqual(
      componentCodeSchema.options,
    );
    expect(getComponentLabel("engine_oil")).toBe("Moottoriöljy");
    expect(getComponentLabel("other")).toBe("Muu komponentti");
  });
});
