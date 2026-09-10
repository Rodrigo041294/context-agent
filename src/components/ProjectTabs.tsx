import React from "react";
import { X, FolderGit2 } from "lucide-react";
import type { HistoryItem } from "../types";
import { componentStats } from "../utils";

interface ProjectTabsProps {
  projects: HistoryItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

const projectProgress = (item: HistoryItem) => {
  let done = 0;
  let total = 0;
  item.context.components.forEach((c) => {
    const s = componentStats(c);
    done += s.done;
    total += s.total;
  });
  return { done, total };
};

export const ProjectTabs: React.FC<ProjectTabsProps> = ({
  projects,
  activeId,
  onSelect,
  onClose,
}) => {
  if (projects.length === 0) return null;

  return (
    <div className="project-tabs" data-testid="project-tabs" role="tablist">
      {projects.map((item) => {
        const isActive = item.id === activeId;
        const { done, total } = projectProgress(item);
        return (
          <div
            key={item.id}
            className={`project-tab ${isActive ? "active" : ""}`}
            role="tab"
            aria-selected={isActive}
            title={`${item.context.projectName} · ${item.branch}`}
            onClick={() => onSelect(item.id)}
          >
            <FolderGit2 size={15} className="project-tab-icon" />
            <span className="project-tab-name">{item.context.projectName || item.branch}</span>
            {total > 0 && (
              <span className="project-tab-badge">
                {done}/{total}
              </span>
            )}
            <button
              type="button"
              className="project-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(item.id);
              }}
              aria-label={`Cerrar pestaña ${item.context.projectName || item.branch}`}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
