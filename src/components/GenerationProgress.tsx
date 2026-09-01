import React from "react";
import { Loader2 } from "lucide-react";
import type { JobStatus } from "../types";

/** Phases shown while a context-generation job is in flight. */
export type GenerationPhase = "CREATING" | JobStatus;

const STEPS: { key: GenerationPhase; label: string }[] = [
  { key: "CREATING", label: "Autenticando" },
  { key: "PENDING", label: "En cola" },
  { key: "RUNNING", label: "Generando" },
];

const PHASE_COPY: Record<string, { title: string; subtitle: string }> = {
  CREATING: {
    title: "Preparando la generación",
    subtitle: "Autenticando y registrando el job…",
  },
  PENDING: {
    title: "Job en cola",
    subtitle: "Esperando a que un worker lo tome…",
  },
  RUNNING: {
    title: "Generando contexto",
    subtitle: "La IA está analizando el HLD, esto puede tardar un momento…",
  },
  COMPLETED: {
    title: "Contexto listo",
    subtitle: "Preparando la vista…",
  },
  FAILED: {
    title: "La generación falló",
    subtitle: "",
  },
};

interface GenerationProgressProps {
  phase: GenerationPhase;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ phase }) => {
  const foundIndex = STEPS.findIndex((s) => s.key === phase);
  const activeIndex = foundIndex === -1 ? STEPS.length - 1 : foundIndex;
  const copy = PHASE_COPY[phase] ?? PHASE_COPY.RUNNING;
  const pct = Math.round(((activeIndex + 1) / STEPS.length) * 100);

  return (
    <div
      className="glass-card project-summary-card gen-progress fade-in"
      data-testid="job-progress"
      role="status"
      aria-live="polite"
    >
      <div className="gen-progress-head">
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        <div>
          <h2>{copy.title}</h2>
          {copy.subtitle && <p>{copy.subtitle}</p>}
        </div>
      </div>

      <div className="progress-container">
        <div className="progress-header">
          <span>{`Paso ${activeIndex + 1} de ${STEPS.length}`}</span>
          <span>{STEPS[activeIndex].label}</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};
