import React, { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface InputFormProps {
  onSubmit: (data: {
    branch: string;
    hldPath: string;
  }) => void;
  isLoading: boolean;
  branches: string[];
  isLoadingBranches: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  isLoading,
  branches,
  isLoadingBranches,
}) => {
  const [branch, setBranch] = useState("main");
  const [hldPath, setHldPath] = useState("");

  // Load saved values on mount
  useEffect(() => {
    const savedBranch = localStorage.getItem("context_agent_branch");
    const savedHldPath = localStorage.getItem("context_agent_hld");

    if (savedBranch) setBranch(savedBranch);
    if (savedHldPath) setHldPath(savedHldPath);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch.trim() || !hldPath.trim()) return;

    // Save settings
    localStorage.setItem("context_agent_branch", branch.trim());
    localStorage.setItem("context_agent_hld", hldPath.trim());

    onSubmit({ branch: branch.trim(), hldPath: hldPath.trim() });
  };

  const isFormValid = branch.trim() && hldPath.trim() && !isLoadingBranches;

  // We combine the saved/active branch with loaded branches to prevent selection losses
  const uniqueBranches = Array.from(
    new Set([branch, ...branches]).values()
  ).filter(Boolean);

  return (
    <form onSubmit={handleSubmit} className="glass-card fade-in">
      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {/* Branch Select */}
        <div className="form-group">
          <label htmlFor="branch">Branch</label>
          <div className="input-wrapper">
            <select
              id="branch"
              className="input-premium"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={isLoading || isLoadingBranches}
              required
              style={{ appearance: "none" }}
            >
              {isLoadingBranches ? (
                <option value="">Cargando ramas de git...</option>
              ) : (
                uniqueBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))
              )}
            </select>
            {isLoadingBranches && (
              <div style={{ position: "absolute", right: "12px", display: "flex", alignItems: "center" }}>
                <Loader2 className="animate-spin" size={18} style={{ color: "hsl(var(--primary))" }} />
              </div>
            )}
            {!isLoadingBranches && (
              <div
                style={{
                  position: "absolute",
                  right: "16px",
                  pointerEvents: "none",
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid hsl(var(--fg-app) / 0.5)",
                }}
              />
            )}
          </div>
        </div>

        {/* HLD Path */}
        <div className="form-group">
          <label htmlFor="hldPath">HLD Path</label>
          <div className="input-wrapper">
            <input
              id="hldPath"
              type="text"
              className="input-premium"
              placeholder="projects/hld.md"
              value={hldPath}
              onChange={(e) => setHldPath(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
        {/* Action Button */}
        <button
          type="submit"
          className="btn-premium btn-primary"
          disabled={isLoading || !isFormValid}
        >
          <Sparkles size={18} />
          {isLoading ? "Generando..." : "Generar Contexto"}
        </button>
      </div>
    </form>
  );
};
