import type {
  ComponentCode,
  ServiceHistory,
} from "@/domain/schemas/service-history";
import { getComponentLabel } from "@/domain/service-events/component-taxonomy";

export interface ResearchComponent {
  component_code: ComponentCode;
  component_label: string;
}

const STANDARD_SCHEDULE_COMPONENTS: readonly ComponentCode[] = [
  "engine_oil",
  "oil_filter",
  "air_filter",
  "cabin_filter",
  "fuel_filter",
  "spark_plugs",
  "timing_belt",
  "timing_chain",
  "water_pump",
  "transmission_fluid",
  "transmission_filter",
  "brake_fluid",
  "coolant",
];

export function deriveResearchComponents(
  history: ServiceHistory,
): ResearchComponent[] {
  const labels = new Map<ComponentCode, string>(
    STANDARD_SCHEDULE_COMPONENTS.map((code) => [
      code,
      getComponentLabel(code),
    ]),
  );

  for (const event of history.events) {
    for (const action of event.actions) {
      if (!labels.has(action.component_code)) {
        labels.set(
          action.component_code,
          action.component_label.trim() ||
            getComponentLabel(action.component_code),
        );
      }
    }
  }

  return [...labels].map(([component_code, component_label]) => ({
    component_code,
    component_label,
  }));
}
