import type { InteractiveComponent } from "./types";

export interface ProgressStats {
  done: number;
  total: number;
  percent: number;
}

/** Feature-completion progress for a component. */
export function componentStats(component: InteractiveComponent): ProgressStats {
  const total = component.features.length;
  const done = component.features.filter((f) => f.completed).length;
  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
