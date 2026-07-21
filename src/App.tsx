import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { InputForm } from "./components/InputForm";
import { WorkstreamCard } from "./components/WorkstreamCard";
import { ExportPanel } from "./components/ExportPanel";
import { SkeletonLoader } from "./components/SkeletonLoader";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { InteractiveContext, GeneratedContext, Task } from "./types";

const API_URL = "https://z04iljfdsb.execute-api.us-east-1.amazonaws.com/default/context-agent";

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<InteractiveContext | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "tabs">("tabs");
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  
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

      setContext({
        projectName: parsedContext.project_name,
        implementationGoal: parsedContext.implementation_goal,
        workstreams: interactiveWorkstreams,
      });
      setActiveTabIdx(0);
      
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

    setContext({
      ...context,
      workstreams: updatedWorkstreams,
    });
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
        />

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
