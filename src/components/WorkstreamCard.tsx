import React, { useState } from "react";
import { ChevronDown, Check, Clipboard } from "lucide-react";
import type { Task } from "../types";

interface WorkstreamCardProps {
  area: string;
  specification: string;
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onShowToast: (message: string) => void;
}

export const WorkstreamCard: React.FC<WorkstreamCardProps> = ({
  area,
  specification,
  tasks,
  onToggleTask,
  onShowToast,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const copyToClipboard = () => {
    const textToCopy = `Área: ${area}\nEspecificación: ${specification}\n\nTareas:\n${tasks
      .map((t) => `${t.completed ? "[x]" : "[ ]"} - ${t.description}`)
      .join("\n")}`;

    navigator.clipboard.writeText(textToCopy);
    onShowToast(`Copiado workstream: ${area}`);
  };

  return (
    <div className="glass-card workstream-card fade-in" data-testid="workstream-card">
      <div className="workstream-card-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <h3>{area}</h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard();
            }}
            title="Copiar texto del workstream"
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

      <p className="workstream-spec">{specification}</p>

      {/* Progress bar */}
      <div className="progress-container">
        <div className="progress-header">
          <span>Progreso de Tareas</span>
          <span>{completedCount}/{totalCount} ({progressPercent}%)</span>
        </div>
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
            data-testid="progress-fill"
          />
        </div>
      </div>

      {!isCollapsed && (
        <div className="fade-in">
          <h4 className="tasks-title">Tareas</h4>
          {totalCount === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "hsl(var(--fg-app) / 0.5)", fontStyle: "italic" }}>
              No hay tareas asignadas.
            </p>
          ) : (
            <ul className="tasks-list">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  onClick={() => onToggleTask(task.id)}
                  className={`task-item ${task.completed ? "is-completed" : ""}`}
                  data-testid={`task-item-${task.id}`}
                >
                  <div className="task-checkbox-wrapper">
                    <div className="task-checkbox" data-testid={`task-checkbox-${task.id}`}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>
                  <span className="task-description">{task.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
