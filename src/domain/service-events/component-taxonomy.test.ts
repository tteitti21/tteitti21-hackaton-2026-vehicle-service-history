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
  it("maps English evidence variants into canonical component codes", () => {
    expect(inferComponentCode("Timing drive replaced")).toBe(
      "timing_belt",
    );
    expect(inferComponentCode("ATF service")).toBe("transmission_fluid");
    expect(inferComponentCode("Cabin filter replaced")).toBe("cabin_filter");
    expect(inferComponentCode("Vehicle platform inspected")).toBe("other");
  });

  it("keeps an explicit component selection ahead of a text suggestion", () => {
    const action: ServiceAction = {
      component_code: "brake_fluid",
      component_label: "Reviewed by the user",
      action_type: "serviced",
      description: "ATF",
      confidence: 1,
    };

    expect(resolveActionComponentCode(action, "Transmission fluid")).toBe(
      "brake_fluid",
    );
  });

  it("provides English labels for the complete canonical taxonomy", () => {
    expect(COMPONENT_TAXONOMY.map((component) => component.code)).toEqual(
      componentCodeSchema.options,
    );
    expect(getComponentLabel("engine_oil")).toBe("Engine oil");
    expect(getComponentLabel("other")).toBe("Other component");
  });
});
