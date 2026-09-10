import React, { useState } from "react";
import { ChevronDown, Check, Clipboard } from "lucide-react";
import type { InteractiveComponent, InteractiveFeature } from "../types";
import { componentStats } from "../utils";

interface ComponentCardProps {
  component: InteractiveComponent;
  onToggleFeature: (featureId: string) => void;
  onShowToast: (message: string) => void;
}

const FeatureBlock: React.FC<{
  feature: InteractiveFeature;
  onToggleFeature: (featureId: string) => void;
}> = ({ feature, onToggleFeature }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className={`feature-block ${feature.completed ? "is-completed" : ""}`}
      data-testid="feature-block"
    >
      <div className="feature-block-header">
        <div
          className="feature-toggle"
          role="checkbox"
          tabIndex={0}
          aria-checked={feature.completed}
          aria-label={`Marcar feature "${feature.title}" como completada`}
          data-testid={`feature-toggle-${feature.id}`}
          onClick={() => onToggleFeature(feature.id)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onToggleFeature(feature.id);
            }
          }}
        >
          <span className="task-checkbox">
            <Check size={12} strokeWidth={3} />
          </span>
          <h4 className="feature-title">{feature.title}</h4>
        </div>

        <button
          type="button"
          className="collapse-btn"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Colapsar feature" : "Expandir feature"}
        >
          <ChevronDown
            size={16}
            className={`feature-chevron ${isOpen ? "" : "is-collapsed"}`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="fade-in feature-body">
          {feature.description && <p className="feature-desc">{feature.description}</p>}
          {feature.acceptance.length > 0 && (
            <>
              <p className="acceptance-title">Criterios de aceptación</p>
              <ul className="acceptance-list">
                {feature.acceptance.map((criterion, i) => (
                  <li key={i}>{criterion}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onToggleFeature,
  onShowToast,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { done, total, percent } = componentStats(component);

  const copyToClipboard = () => {
    let text = `Componente: ${component.title}`;
    if (component.name) text += ` (${component.name})`;
    text += `\n${component.description}\n\n`;

    component.features.forEach((feature) => {
      text += `${feature.completed ? "[x]" : "[ ]"} Feature: ${feature.title}\n`;
      if (feature.description) text += `${feature.description}\n`;
      if (feature.acceptance.length > 0) {
        text += `Criterios de aceptación:\n`;
        feature.acceptance.forEach((c) => {
          text += `  - ${c}\n`;
        });
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text.trim());
    onShowToast(`Copiado componente: ${component.title}`);
  };

  return (
    <div className="glass-card component-card fade-in" data-testid="component-card">
      <div className="workstream-card-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="component-card-heading">
          <h3>{component.title}</h3>
          {component.name && <span className="component-card-name">{component.name}</span>}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard();
            }}
            title="Copiar texto del componente"
            aria-label="Copiar texto"
          >
            <Clipboard size={16} />
          </button>
          <button
            type="button"
            className={`collapse-btn ${isCollapsed ? "is-collapsed" : ""}`}
            aria-label={isCollapsed ? "Expandir" : "Colapsar"}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      <p className="workstream-spec">{component.description}</p>

      {/* Progress bar — completed features */}
      <div className="progress-container">
        <div className="progress-header">
          <span>Features completadas</span>
          <span>{done}/{total} ({percent}%)</span>
        </div>
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${percent}%` }}
            data-testid="progress-fill"
          />
        </div>
      </div>

      {!isCollapsed && (
        <div className="fade-in features-list">
          <h4 className="tasks-title">
            Features <span className="features-count">({component.features.length})</span>
          </h4>
          {component.features.length === 0 ? (
            <p className="empty-hint">Este componente no tiene features.</p>
          ) : (
            component.features.map((feature) => (
              <FeatureBlock
                key={feature.id}
                feature={feature}
                onToggleFeature={onToggleFeature}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
