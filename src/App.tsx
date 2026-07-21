import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { InputForm } from "./components/InputForm";
import { WorkstreamCard } from "./components/WorkstreamCard";
import { ExportPanel } from "./components/ExportPanel";
import { SkeletonLoader } from "./components/SkeletonLoader";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { InteractiveContext, GeneratedContext, Task, HistoryItem } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "https://z04iljfdsb.execute-api.us-east-1.amazonaws.com/default/context-agent";

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<InteractiveContext | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "tabs">("tabs");
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedHldPath, setSelectedHldPath] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("context_agent_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.warn("Failed to parse history", e);
      }
    }
  }, []);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });

  // Load theme and set default on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("context_agent_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    }
  }, []);

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      const repository = (import.meta.env.VITE_REPOSITORY || "").trim();
      const accessToken = (import.meta.env.VITE_ACCESS_TOKEN || "").trim();
      if (!repository) return;

      setIsLoadingBranches(true);
      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
        };
        if (accessToken) {
          headers["Authorization"] = accessToken.startsWith("Bearer ")
            ? accessToken
            : `Bearer ${accessToken}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repository}/branches`, {
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const branchNames = data.map((b: any) => b.name);
            setBranches(branchNames);
          }
        } else {
          console.warn("Failed to fetch branches from GitHub API, status:", response.status);
        }
      } catch (err) {
        console.error("Error fetching branches:", err);
      } finally {
        setIsLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("context_agent_theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const handleGenerateContext = async (formData: {
    branch: string;
    hldPath: string;
  }) => {
    const branch = formData.branch.trim();
    const hldPath = formData.hldPath.trim();

    setSelectedBranch(branch);
    setSelectedHldPath(hldPath);



    setIsLoading(true);
    setError(null);
    setContext(null);

    try {
      const repository = (import.meta.env.VITE_REPOSITORY || "").trim();
      const accessToken = (import.meta.env.VITE_ACCESS_TOKEN || "").trim();

      if (!repository) {
        throw new Error(
          "La variable de entorno VITE_REPOSITORY no está configurada. Por favor, confígurala en tu archivo .env."
        );
      }

      const payload = {
        repository,
        branch: formData.branch.trim(),
        hld_path: formData.hldPath.trim(),
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers["Authorization"] = accessToken.startsWith("Bearer ")
          ? accessToken
          : `Bearer ${accessToken}`;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error HTTP! Estado: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (_) {
          // Fallback if not JSON
        }
        throw new Error(errorMessage);
      }

      const apiResponse = await response.json();

      let body = apiResponse;
      if (apiResponse && typeof apiResponse.body === "string") {
        try {
          body = JSON.parse(apiResponse.body);
        } catch (e) {
          console.warn("Failed to parse apiResponse.body as JSON", e);
        }
      }

      const contextStr = body.generated_context;
      const parsedContext: GeneratedContext = typeof contextStr === "string"
        ? JSON.parse(contextStr)
        : contextStr;

      if (!parsedContext || !parsedContext.project_name) {
        throw new Error("La API devolvió un formato de respuesta inválido.");
      }

      // Convert to interactive context structure
      const interactiveWorkstreams = (parsedContext.workstreams || []).map((ws, wsIndex) => {
        const tasks: Task[] = (ws.tasks || []).map((taskText, taskIndex) => ({
          id: `task-${wsIndex}-${taskIndex}`,
          description: taskText,
          completed: false,
        }));

        return {
          area: ws.area,
          specification: ws.specification,
          tasks,
        };
      });

      const contextData: InteractiveContext = {
        projectName: parsedContext.project_name,
        implementationGoal: parsedContext.implementation_goal,
        workstreams: interactiveWorkstreams,
      };

      const queryId = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
      setContext(contextData);
      setActiveTabIdx(0);
      setActiveQueryId(queryId);

      // Save to history (allowing duplicate queries to coexist in history list)
      setHistory((prevHistory) => {
        const newItem: HistoryItem = {
          id: queryId,
          branch,
          hldPath,
          timestamp: Date.now(),
          context: contextData,
        };
        const updated = [newItem, ...prevHistory];
        localStorage.setItem("context_agent_history", JSON.stringify(updated));
        return updated;
      });

      showToast("¡Contexto de desarrollo generado exitosamente!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconocido al generar contexto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = (taskId: string) => {
    if (!context) return;

    const updatedWorkstreams = context.workstreams.map((ws) => {
      const updatedTasks = ws.tasks.map((task) => {
        if (task.id === taskId) {
          return { ...task, completed: !task.completed };
        }
        return task;
      });
      return { ...ws, tasks: updatedTasks };
    });

    const updatedContext = {
      ...context,
      workstreams: updatedWorkstreams,
    };

    setContext(updatedContext);

    // Save updated task checklist state to history using the unique ID
    if (activeQueryId) {
      setHistory((prevHistory) => {
        const updated = prevHistory.map((item) => {
          if (item.id === activeQueryId) {
            return {
              ...item,
              context: updatedContext,
            };
          }
          return item;
        });
        localStorage.setItem("context_agent_history", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleLoadHistoryItem = (item: HistoryItem) => {
    setSelectedBranch(item.branch);
    setSelectedHldPath(item.hldPath);
    setContext(item.context);
    setActiveTabIdx(0);
    setActiveQueryId(item.id);
    showToast("Consulta cargada del historial");
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prevHistory) => {
      const updated = prevHistory.filter((item) => item.id !== id);
      localStorage.setItem("context_agent_history", JSON.stringify(updated));
      return updated;
    });
    if (activeQueryId === id) {
      setActiveQueryId(null);
    }
    showToast("Consulta eliminada del historial");
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("context_agent_history");
    setActiveQueryId(null);
    showToast("Historial limpio");
  };

  return (
    <div className="container">
      {/* Header component */}
      <Header theme={theme} toggleTheme={toggleTheme} />

      <main style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Input configuration form */}
        <InputForm
          onSubmit={handleGenerateContext}
          isLoading={isLoading}
          branches={branches}
          isLoadingBranches={isLoadingBranches}
          selectedBranch={selectedBranch}
          selectedHldPath={selectedHldPath}
        />

        {/* Query History Panel */}
        {history.length > 0 && (
          <div className="glass-card history-section fade-in" data-testid="history-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontFamily: "var(--font-title)", fontWeight: 700, fontSize: "1.1rem" }}>Consultas Recientes</h3>
              <button
                type="button"
                className="btn-link-danger"
                onClick={handleClearHistory}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "hsl(var(--danger))",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-title)"
                }}
              >
                Limpiar historial
              </button>
            </div>
            <div className="history-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`history-item-card ${activeQueryId === item.id ? "active" : ""}`}
                  onClick={() => handleLoadHistoryItem(item)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "var(--glass-bg)",
                    border: activeQueryId === item.id ? "1px solid hsl(var(--primary))" : "1px solid var(--glass-border)",
                    cursor: "pointer",
                    transition: "var(--transition-fast)",
                    boxShadow: activeQueryId === item.id ? "0 0 10px hsl(var(--primary) / 0.1)" : "none"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: activeQueryId === item.id ? "hsl(var(--primary))" : "hsl(var(--fg-app) / 0.8)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {item.branch}
                    </span>
                    <span style={{ fontSize: "0.80rem", color: "hsl(var(--fg-app) / 0.5)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {item.hldPath}
                    </span>
                    {item.timestamp && (
                      <span style={{ fontSize: "0.72rem", color: "hsl(var(--fg-app) / 0.4)", marginTop: "2px" }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="history-delete-btn"
                    onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "hsl(var(--fg-app) / 0.4)",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      lineHeight: "1",
                      transition: "var(--transition-fast)"
                    }}
                    title="Eliminar del historial"
                    aria-label={`Eliminar consulta de rama ${item.branch} y ruta ${item.hldPath}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading placeholder skeleton */}
        {isLoading && <SkeletonLoader />}

        {/* Error notification */}
        {error && (
          <div className="status-banner error fade-in" data-testid="error-banner">
            <AlertCircle size={20} className="banner-icon" />
            <div>
              <strong>Error al generar el contexto:</strong>
              <p style={{ marginTop: "4px", fontSize: "0.9rem" }}>{error}</p>
            </div>
          </div>
        )}

        {/* Results Panel */}
        {context && !isLoading && (
          <div className="results-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              {/* Segmented Control Selector */}
              <div className="view-selector" data-testid="view-selector">
                <button
                  type="button"
                  className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  Tarjetas
                </button>
                <button
                  type="button"
                  className={`view-btn ${viewMode === "tabs" ? "active" : ""}`}
                  onClick={() => setViewMode("tabs")}
                >
                  Pestañas
                </button>
              </div>

              {/* Toolbar export panel */}
              <ExportPanel
                projectName={context.projectName}
                implementationGoal={context.implementationGoal}
                workstreams={context.workstreams}
                onShowToast={showToast}
              />
            </div>

            {/* Project Summary Glass Card */}
            <div className="glass-card project-summary-card fade-in">
              <h2>{context.projectName}</h2>
              <p>{context.implementationGoal}</p>
            </div>

            {/* Grid vs Tabs Rendering */}
            {viewMode === "grid" ? (
              <div className="workstreams-grid">
                {context.workstreams.map((ws, index) => (
                  <WorkstreamCard
                    key={index}
                    area={ws.area}
                    specification={ws.specification}
                    tasks={ws.tasks}
                    onToggleTask={handleToggleTask}
                    onShowToast={showToast}
                  />
                ))}
              </div>
            ) : (
              <div className="tabs-view-container">
                {/* Tabs Navigation Row */}
                <div className="tabs-navigation" data-testid="tabs-navigation">
                  {context.workstreams.map((ws, index) => {
                    const completed = ws.tasks.filter((t) => t.completed).length;
                    const total = ws.tasks.length;
                    return (
                      <button
                        key={index}
                        type="button"
                        className={`tab-btn ${activeTabIdx === index ? "active" : ""}`}
                        onClick={() => setActiveTabIdx(index)}
                      >
                        {ws.area}
                        {total > 0 && (
                          <span className="tab-badge">
                            {completed}/{total}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Render Selected Workstream Card */}
                {context.workstreams[activeTabIdx] && (
                  <WorkstreamCard
                    area={context.workstreams[activeTabIdx].area}
                    specification={context.workstreams[activeTabIdx].specification}
                    tasks={context.workstreams[activeTabIdx].tasks}
                    onToggleTask={handleToggleTask}
                    onShowToast={showToast}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating toast notification */}
      {toast.visible && (
        <div className="toast" data-testid="toast-notification">
          <CheckCircle2 size={18} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
