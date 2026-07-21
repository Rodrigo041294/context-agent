import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock Clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test");

// Smart Mock Variables
let mockContextResponse: any = {};
let mockContextOk = true;
let mockContextStatus = 200;
let mockContextThrowOnJson = false;
let mockBranchesResponse: any[] = [
  { name: "main" },
  { name: "develop" },
  { name: "feat/some-branch" }
];
let mockBranchesOk = true;

describe("Context Agent UI Application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_REPOSITORY", "my-user/my-repo");
    vi.stubEnv("VITE_ACCESS_TOKEN", "custom-token-secret");
    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: vi.fn(),
    });

    // Reset default mock states
    mockContextResponse = {};
    mockContextOk = true;
    mockContextStatus = 200;
    mockContextThrowOnJson = false;
    mockBranchesResponse = [
      { name: "main" },
      { name: "develop" },
      { name: "feat/some-branch" }
    ];
    mockBranchesOk = true;

    // Apply smart mock implementation
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/branches")) {
        if (!mockBranchesOk) {
          return {
            ok: false,
            status: 403,
            json: async () => ({ message: "API rate limit exceeded" }),
          };
        }
        return {
          ok: true,
          json: async () => mockBranchesResponse,
        };
      }
      
      // Default to Context Agent URL mock
      return {
        ok: mockContextOk,
        status: mockContextStatus,
        json: async () => {
          if (mockContextThrowOnJson) {
            throw new Error("Not JSON");
          }
          return mockContextResponse;
        },
      };
    });
  });

  it("should render application header and empty form with select dropdown", async () => {
    render(<App />);
    
    // Check header
    expect(screen.getByText("Development Context Agent")).toBeInTheDocument();
    
    // Wait for branches to load
    await waitFor(() => {
      expect(screen.getByLabelText("Branch")).toBeInTheDocument();
    });

    // Check form fields are rendered
    expect(screen.queryByLabelText("Repository")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HLD Path")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Bearer Token")).not.toBeInTheDocument();

    // Verify option elements are in select dropdown
    const select = screen.getByLabelText("Branch") as HTMLSelectElement;
    await waitFor(() => {
      expect(select.options.length).toBe(3);
    });
    expect(select.options[0].value).toBe("main");
    expect(select.options[1].value).toBe("develop");
  });

  it("should handle theme toggling", () => {
    render(<App />);
    
    const themeBtn = screen.getByRole("button", { name: /Activar/i });
    // JSDOM has window.matchMedia matching false for prefers-color-scheme: dark by default
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // Toggle to Dark
    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("context_agent_theme")).toBe("dark");

    // Toggle back to Light
    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("context_agent_theme")).toBe("light");
  });

  it("should retrieve values from local storage and update them on form submit", async () => {
    localStorage.setItem("context_agent_branch", "develop");
    localStorage.setItem("context_agent_hld", "docs/hld.md");

    render(<App />);

    const branchInput = screen.getByLabelText("Branch") as HTMLSelectElement;
    const hldInput = screen.getByLabelText("HLD Path") as HTMLInputElement;

    await waitFor(() => {
      expect(branchInput.value).toBe("develop");
    });
    expect(hldInput.value).toBe("docs/hld.md");
  });

  it("should submit the form and render the generated context workstreams on success", async () => {
    mockContextResponse = {
      body: JSON.stringify({
        generated_context: JSON.stringify({
          project_name: "Premium Test Project",
          implementation_goal: "Build a state-of-the-art context tool",
          workstreams: [
            {
              area: "Frontend Refactoring",
              specification: "Migrate all views from standard HTML to React functional components.",
              tasks: ["Configure Vite", "Write index.css tokens", "Validate responsive views"]
            },
            {
              area: "CI/CD Setup",
              specification: "Establish pipeline and code coverage limits.",
              tasks: ["Configure SonarQube properties", "Add coverage script to package.json"]
            }
          ]
        })
      })
    };

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch") as HTMLSelectElement;
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    // Wait for the options list to load from API before trying to select
    await waitFor(() => {
      expect(screen.queryByText("feat/some-branch")).toBeInTheDocument();
    });

    // Select branch option
    fireEvent.change(branchInput, { target: { value: "feat/some-branch" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });

    // Click submit
    fireEvent.click(submitBtn);

    // Verify skeleton loader is shown
    expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();

    // Wait for the results to load
    await waitFor(() => {
      expect(screen.getByText("Premium Test Project")).toBeInTheDocument();
    });

    expect(screen.getByText("Build a state-of-the-art context tool")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frontend Refactoring" })).toBeInTheDocument();
    
    // Check localStorage saved values
    expect(localStorage.getItem("context_agent_branch")).toBe("feat/some-branch");
    expect(localStorage.getItem("context_agent_hld")).toBe("hld.md");

    // Click workstream header to toggle collapse (and verify tasks list gets hidden)
    const wsHeader = screen.getByRole("heading", { name: "Frontend Refactoring" });
    expect(screen.getByText("Configure Vite")).toBeInTheDocument();
    fireEvent.click(wsHeader); // Collapse it
    expect(screen.queryByText("Configure Vite")).not.toBeInTheDocument();
    fireEvent.click(wsHeader); // Expand it back
    expect(screen.getByText("Configure Vite")).toBeInTheDocument();

    // Toggle a task as completed
    const taskItem = screen.getByTestId("task-item-task-0-0");
    expect(taskItem).not.toHaveClass("is-completed");

    fireEvent.click(taskItem);
    expect(taskItem).toHaveClass("is-completed");

    // Copy single workstream text
    const copySingleBtn = screen.getAllByRole("button", { name: /Copiar texto/i })[0];
    fireEvent.click(copySingleBtn);
    expect(mockWriteText).toHaveBeenCalled();

    // Copy to clipboard actions
    const copyMdBtn = screen.getByRole("button", { name: /Copiar Markdown/i });
    fireEvent.click(copyMdBtn);
    expect(mockWriteText).toHaveBeenCalled();
    expect(screen.getByTestId("toast-notification")).toBeInTheDocument();

    // Export MD download
    const exportMdBtn = screen.getByRole("button", { name: /Exportar MD/i });
    fireEvent.click(exportMdBtn);
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Export JSON download
    const exportJsonBtn = screen.getByRole("button", { name: /Exportar JSON/i });
    fireEvent.click(exportJsonBtn);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(2);
  });

  it("should show an error banner when VITE_REPOSITORY is not set", async () => {
    vi.stubEnv("VITE_REPOSITORY", "");

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/La variable de entorno VITE_REPOSITORY no está configurada/i)
    ).toBeInTheDocument();
  });

  it("should show an error banner when the API returns an error", async () => {
    mockContextOk = false;
    mockContextStatus = 500;
    mockContextResponse = { message: "Internal server error" };

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    // Wait for the options list to load from API
    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
  });

  it("should show an error banner when the API returns raw response without message", async () => {
    mockContextOk = false;
    mockContextStatus = 400;
    mockContextThrowOnJson = true;

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    // Wait for the options list to load from API
    await waitFor(() => {
      expect(screen.queryByText("main")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/Estado: 400/i)).toBeInTheDocument();
  });

  it("should fall back gracefully if branch loading fails", async () => {
    mockBranchesOk = false;

    render(<App />);

    // Branch select should still load, defaulting to master/main fallback in code
    const branchInput = await screen.findByLabelText("Branch");
    expect(branchInput).toBeInTheDocument();
  });

  it("should toggle between grid and tabs view mode and interact with tabs", async () => {
    mockContextResponse = {
      body: JSON.stringify({
        generated_context: JSON.stringify({
          project_name: "Tab and Grid Test",
          implementation_goal: "Verify tab switching works correctly",
          workstreams: [
            {
              area: "Area One",
              specification: "Specs for area one",
              tasks: ["Task 1A"]
            },
            {
              area: "Area Two",
              specification: "Specs for area two",
              tasks: ["Task 2A"]
            }
          ]
        })
      })
    };

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });
    fireEvent.click(submitBtn);

    // Wait for results
    await screen.findByText("Tab and Grid Test");

    // Initially in tabs view mode (default): only Area One heading should be visible
    expect(screen.getByRole("heading", { name: "Area One" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area Two" })).not.toBeInTheDocument();

    // Click "Tarjetas" button to switch to grid mode
    const gridViewBtn = screen.getByRole("button", { name: "Tarjetas" });
    fireEvent.click(gridViewBtn);

    // Both should be visible in grid mode
    expect(screen.getByRole("heading", { name: "Area One" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Area Two" })).toBeInTheDocument();

    // Click "Pestañas" button to switch back to tabs mode
    const tabsViewBtn = screen.getByRole("button", { name: "Pestañas" });
    fireEvent.click(tabsViewBtn);

    // Only Area One visible again
    expect(screen.getByRole("heading", { name: "Area One" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area Two" })).not.toBeInTheDocument();

    // Click on "Area Two" tab button
    const tabButtons = screen.getAllByRole("button");
    const areaTwoTabBtn = tabButtons.find(btn => btn.textContent?.includes("Area Two"));
    expect(areaTwoTabBtn).toBeDefined();
    
    if (areaTwoTabBtn) {
      fireEvent.click(areaTwoTabBtn);
    }

    // Now Area Two should be visible, and Area One should be hidden
    expect(screen.getByRole("heading", { name: "Area Two" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area One" })).not.toBeInTheDocument();
  });

  it("should save queries to history and load them locally to skip API calls", async () => {
    mockContextResponse = {
      body: JSON.stringify({
        generated_context: JSON.stringify({
          project_name: "Cache Test Project",
          implementation_goal: "Verify cache bypasses api",
          workstreams: [
            {
              area: "Cached Area",
              specification: "Cached Spec",
              tasks: ["Cached Task"]
            }
          ]
        })
      })
    };

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    // 1. Submit a query for branch "develop" and hld path "develop-hld.md"
    fireEvent.change(branchInput, { target: { value: "develop" } });
    fireEvent.change(hldInput, { target: { value: "develop-hld.md" } });
    
    // Clear mockFetch mock tracking to check if it's called
    mockFetch.mockClear();

    fireEvent.click(submitBtn);

    // Wait for the results
    await screen.findByText("Cache Test Project");
    
    // The API should have been called once for this submission
    const lambdaCallCountBefore = mockFetch.mock.calls.filter(call => call[0].includes("amazonaws.com")).length;
    expect(lambdaCallCountBefore).toBe(1);

    // 2. We should see the query in the recent history section
    expect(screen.getByTestId("history-section")).toBeInTheDocument();
    expect(screen.getByText("Rama: develop")).toBeInTheDocument();
    expect(screen.getByText("HLD: develop-hld.md")).toBeInTheDocument();

    // 3. Re-submit the exact same combination again, it should load from history instantly and mockFetch should NOT be called again
    mockFetch.mockClear();

    fireEvent.click(submitBtn);

    // Wait for results
    await screen.findByText("Cache Test Project");

    // The API should NOT have been called this time!
    const lambdaCallCountAfter = mockFetch.mock.calls.filter(call => call[0].includes("amazonaws.com")).length;
    expect(lambdaCallCountAfter).toBe(0);

    // 4. Click the history item card to load it directly
    const historyCard = screen.getByText("Rama: develop");
    fireEvent.click(historyCard);
    expect(screen.getByText("Cache Test Project")).toBeInTheDocument();

    // Toggle task to verify history updates task states correctly
    const taskItem = screen.getByTestId("task-item-task-0-0");
    fireEvent.click(taskItem);
    expect(taskItem).toHaveClass("is-completed");

    // 5. Delete the history item card using individual delete button
    const deleteBtn = screen.getByRole("button", { name: /Eliminar consulta/i });
    fireEvent.click(deleteBtn);
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();

    // 6. Test clear all history (we add one item back and clear it)
    mockContextResponse = {
      body: JSON.stringify({
        generated_context: JSON.stringify({
          project_name: "Clear Test Project",
          implementation_goal: "Verify clear history works",
          workstreams: [{ area: "Clear Area", specification: "Clear Spec", tasks: ["Clear Task"] }]
        })
      })
    };
    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "clear-hld.md" } });
    fireEvent.click(submitBtn);
    await screen.findByText("Clear Test Project");

    const clearBtn = screen.getByRole("button", { name: "Limpiar historial" });
    fireEvent.click(clearBtn);
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();
  });
});
