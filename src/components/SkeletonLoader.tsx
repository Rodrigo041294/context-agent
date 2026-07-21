import React from "react";

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="skeleton-container" data-testid="skeleton-loader">
      {/* Project Summary Skeleton */}
      <div className="skeleton-card project-summary-skeleton">
        <div className="skeleton-shimmer" />
        <div className="skeleton-line title" style={{ width: "40%", height: "28px" }} />
        <div className="skeleton-line text" style={{ width: "85%", height: "16px", marginTop: "12px" }} />
      </div>

      {/* Workstreams Grid Skeleton */}
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-card workstream-skeleton">
            <div className="skeleton-shimmer" />
            <div className="skeleton-line ws-title" style={{ width: "60%", height: "22px" }} />
            <div className="skeleton-line ws-spec" style={{ width: "90%", height: "14px", marginTop: "14px" }} />
            <div className="skeleton-line ws-spec" style={{ width: "80%", height: "14px", marginTop: "8px" }} />
            
            <div className="skeleton-section-title" style={{ width: "30%", height: "16px", marginTop: "24px", marginBottom: "12px" }} />
            <div className="skeleton-tasks">
              <div className="skeleton-task-item">
                <div className="skeleton-checkbox" />
                <div className="skeleton-line task-text" style={{ width: "70%", height: "12px" }} />
              </div>
              <div className="skeleton-task-item">
                <div className="skeleton-checkbox" />
                <div className="skeleton-line task-text" style={{ width: "85%", height: "12px" }} />
              </div>
              <div className="skeleton-task-item">
                <div className="skeleton-checkbox" />
                <div className="skeleton-line task-text" style={{ width: "50%", height: "12px" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
