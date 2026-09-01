import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { clearTokenCache } from "../services/auth";

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

// ---- Smart Mock Variables -------------------------------------------------
let mockCognitoResponse: any;
let mockCognitoOk = true;
let mockCognitoStatus = 200;

let mockBranchesResponse: any[] = [];
let mockBranchesOk = true;

let mockCreateJobOk = true;
let mockCreateJobStatus = 200;
let mockCreateJobResponse: any = { jobId: "job-123", status: "PENDING" };

let mockJobGetOk = true;
let mockJobGetStatus = 200;
let mockJobGetThrowOnJson = false;
/** Job resource returned by GET /jobs/{id} once the sequence (if any) is exhausted. */
let mockJob: any = {};
/** Optional ordered list of GET /jobs/{id} responses (each call shifts one). */
let mockJobSequence: any[] | null = null;

const completedJob = (ctx: any) => ({
  jobId: "job-123",
  status: "COMPLETED",
  branch: "main",
  repository: "JoseAnastacioEsquivelSalas/architecture-docs",
  hld_path: "projects/IA_Framework/hld.md",
  generatedContext: JSON.stringify(ctx),
});

const DEFAULT_CONTEXT = {
  project_name: "Default Project",
  implementation_goal: "Default goal",
  workstreams: [{ area: "Default Area", specification: "Default spec", tasks: ["Default task"] }],
};

describe("Context Agent UI Application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearTokenCache();

    vi.stubEnv("VITE_REPOSITORY", "JoseAnastacioEsquivelSalas/architecture-docs");
    vi.stubEnv("VITE_ACCESS_TOKEN", "custom-token-secret");
    vi.stubEnv("VITE_AUTH_USER", "mock-user");
    vi.stubEnv("VITE_AUTH_PASSWORD", "mock-password");
    vi.stubEnv("VITE_AUTH_URL", "https://us-east-1qut4lhkwo.auth.us-east-1.amazoncognito.com/oauth2/token");
    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: vi.fn(),
    });

    mockCognitoResponse = {
      access_token: "mock-cognito-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    };
    mockCognitoOk = true;
    mockCognitoStatus = 200;

    mockBranchesResponse = [{ name: "main" }, { name: "develop" }, { name: "feat/some-branch" }];
    mockBranchesOk = true;

    mockCreateJobOk = true;
    mockCreateJobStatus = 200;
    mockCreateJobResponse = { jobId: "job-123", status: "PENDING" };

    mockJobGetOk = true;
    mockJobGetStatus = 200;
    mockJobGetThrowOnJson = false;
    mockJob = completedJob(DEFAULT_CONTEXT);
    mockJobSequence = null;

    mockFetch.mockImplementation(async (url: string, options?: any) => {
      const method = (options?.method || "GET").toUpperCase();

      if (url.includes("/branches")) {
        if (!mockBranchesOk) {
          return { ok: false, status: 403, json: async () => ({ message: "API rate limit exceeded" }) };
        }
        return { ok: true, json: async () => mockBranchesResponse };
      }

      if (url.includes("amazoncognito.com") || url.includes("/oauth2/token")) {
        return {
          ok: mockCognitoOk,
          status: mockCognitoOk ? 200 : mockCognitoStatus,
          json: async () => mockCognitoResponse,
        };
      }

      // POST .../default/jobs  -> create job
      if (/\/jobs\/?$/.test(url) && method === "POST") {
        return {
          ok: mockCreateJobOk,
          status: mockCreateJobOk ? 200 : mockCreateJobStatus,
          json: async () => (mockCreateJobOk ? mockCreateJobResponse : { message: "create failed" }),
        };
      }

      // GET .../default/jobs/{jobId} -> poll job
      if (url.includes("/jobs/")) {
        const payload =
          mockJobSequence && mockJobSequence.length ? mockJobSequence.shift() : mockJob;
        return {
          ok: mockJobGetOk,
          status: mockJobGetOk ? 200 : mockJobGetStatus,
          json: async () => {
            if (mockJobGetThrowOnJson) throw new Error("Not JSON");
            return payload;
          },
        };
      }

      return { ok: true, json: async () => ({}) };
    });
  });

  const jobsCalls = () =>
    mockFetch.mock.calls.filter(
      (c) => c[0].includes("amazonaws.com") && !c[0].includes("amazoncognito.com")
    );
  const cognitoCalls = () =>
    mockFetch.mock.calls.filter(
      (c) => c[0].includes("amazoncognito.com") || c[0].includes("/oauth2/token")
    );

  it("should render application header and empty form with select dropdown", async () => {
    render(<App />);

    expect(screen.getByText("Development Context Agent")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Branch")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Repository")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HLD Path")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Bearer Token")).not.toBeInTheDocument();

    const select = screen.getByLabelText("Branch") as HTMLSelectElement;
    await waitFor(() => {
      expect(select.options.length).toBe(3);
    });
    expect(select.options[0].value).toBe("main");
    expect(select.options[1].value).toBe("develop");
  });

  it("should default the HLD Path input to projects/IA_Framework/hld.md", async () => {
    render(<App />);
    const hldInput = (await screen.findByLabelText("HLD Path")) as HTMLInputElement;
    expect(hldInput.value).toBe("projects/IA_Framework/hld.md");
  });

  it("should handle theme toggling", () => {
    render(<App />);

    const themeBtn = screen.getByRole("button", { name: /Activar/i });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("context_agent_theme")).toBe("dark");

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

  it("should create a job, poll it and render the generated context workstreams on success", async () => {
    mockJob = completedJob({
      project_name: "Premium Test Project",
      implementation_goal: "Build a state-of-the-art context tool",
      workstreams: [
        {
          area: "Frontend Refactoring",
          specification: "Migrate all views from standard HTML to React functional components.",
          tasks: ["Configure Vite", "Write index.css tokens", "Validate responsive views"],
        },
        {
          area: "CI/CD Setup",
          specification: "Establish pipeline and code coverage limits.",
          tasks: ["Configure SonarQube properties", "Add coverage script to package.json"],
        },
      ],
    });

    render(<App />);

    const branchInput = (await screen.findByLabelText("Branch")) as HTMLSelectElement;
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("feat/some-branch")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "feat/some-branch" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });

    fireEvent.click(submitBtn);

    expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Premium Test Project")).toBeInTheDocument();
    });

    expect(screen.getByText("Build a state-of-the-art context tool")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frontend Refactoring" })).toBeInTheDocument();

    expect(localStorage.getItem("context_agent_branch")).toBe("feat/some-branch");
    expect(localStorage.getItem("context_agent_hld")).toBe("hld.md");

    // POST /jobs payload uses the FIXED repository and the form values
    const createCall = jobsCalls().find((c) => (c[1]?.method || "GET").toUpperCase() === "POST");
    expect(createCall).toBeDefined();
    const createBody = JSON.parse(createCall![1].body);
    expect(createBody).toEqual({
      repository: "JoseAnastacioEsquivelSalas/architecture-docs",
      branch: "feat/some-branch",
      hld_path: "hld.md",
    });

    const wsHeader = screen.getByRole("heading", { name: "Frontend Refactoring" });
    expect(screen.getByText("Configure Vite")).toBeInTheDocument();
    fireEvent.click(wsHeader);
    expect(screen.queryByText("Configure Vite")).not.toBeInTheDocument();
    fireEvent.click(wsHeader);
    expect(screen.getByText("Configure Vite")).toBeInTheDocument();

    const taskItem = screen.getByTestId("task-item-task-0-0");
    expect(taskItem).not.toHaveClass("is-completed");
    fireEvent.click(taskItem);
    expect(taskItem).toHaveClass("is-completed");

    const copySingleBtn = screen.getAllByRole("button", { name: /Copiar texto/i })[0];
    fireEvent.click(copySingleBtn);
    expect(mockWriteText).toHaveBeenCalled();

    const copyMdBtn = screen.getByRole("button", { name: /Copiar Markdown/i });
    fireEvent.click(copyMdBtn);
    expect(mockWriteText).toHaveBeenCalled();
    expect(screen.getByTestId("toast-notification")).toBeInTheDocument();

    const exportMdBtn = screen.getByRole("button", { name: /Exportar MD/i });
    fireEvent.click(exportMdBtn);
    expect(mockCreateObjectURL).toHaveBeenCalled();

    const exportJsonBtn = screen.getByRole("button", { name: /Exportar JSON/i });
    fireEvent.click(exportJsonBtn);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(2);
  });

  it("should show an error banner when job creation returns an error", async () => {
    mockCreateJobOk = false;
    mockCreateJobStatus = 500;

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

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/create failed/i)).toBeInTheDocument();
  });

  it("should show an error banner with errorMessage when the job FAILED", async () => {
    mockJob = {
      jobId: "job-123",
      status: "FAILED",
      errorMessage: "GitHub API error 404. File=docs/hld.md. Ref=main.",
    };

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "docs/hld.md" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/GitHub API error 404/i)).toBeInTheDocument();
  });

  it("should show an error banner when the job GET returns a non-JSON error", async () => {
    mockJobGetOk = false;
    mockJobGetStatus = 400;
    mockJobGetThrowOnJson = true;

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("main")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "hld.md" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/Error HTTP 400/i)).toBeInTheDocument();
  });

  it("should fall back gracefully if branch loading fails", async () => {
    mockBranchesOk = false;

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    expect(branchInput).toBeInTheDocument();
  });

  it("should toggle between grid and tabs view mode and interact with tabs", async () => {
    mockJob = completedJob({
      project_name: "Tab and Grid Test",
      implementation_goal: "Verify tab switching works correctly",
      workstreams: [
        { area: "Area One", specification: "Specs for area one", tasks: ["Task 1A"] },
        { area: "Area Two", specification: "Specs for area two", tasks: ["Task 2A"] },
      ],
    });

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

    await screen.findByText("Tab and Grid Test");

    expect(screen.getByRole("heading", { name: "Area One" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area Two" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tarjetas" }));

    expect(screen.getByRole("heading", { name: "Area One" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Area Two" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pestañas" }));

    expect(screen.getByRole("heading", { name: "Area One" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area Two" })).not.toBeInTheDocument();

    const areaTwoTabBtn = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("Area Two"));
    expect(areaTwoTabBtn).toBeDefined();
    fireEvent.click(areaTwoTabBtn!);

    expect(screen.getByRole("heading", { name: "Area Two" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area One" })).not.toBeInTheDocument();
  });

  it("should save queries to history and load them locally to skip API calls", async () => {
    mockJob = completedJob({
      project_name: "Cache Test Project",
      implementation_goal: "Verify cache bypasses api",
      workstreams: [{ area: "Cached Area", specification: "Cached Spec", tasks: ["Cached Task"] }],
    });

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "develop" } });
    fireEvent.change(hldInput, { target: { value: "develop-hld.md" } });

    mockFetch.mockClear();
    fireEvent.click(submitBtn);

    await screen.findByText("Cache Test Project");

    // First submission: create + at least one poll GET
    expect(jobsCalls().length).toBeGreaterThanOrEqual(2);
    // Token requested exactly once (first time)
    expect(cognitoCalls().length).toBe(1);

    // History panel stays hidden until the toggle button is clicked
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver historial/i }));

    expect(screen.getByTestId("history-section")).toBeInTheDocument();
    expect(screen.getByText("develop-hld.md")).toBeInTheDocument();

    // Re-submit: hits the jobs API again, but reuses the cached token
    mockFetch.mockClear();
    fireEvent.click(submitBtn);
    await screen.findByText("Cache Test Project");

    expect(jobsCalls().length).toBeGreaterThanOrEqual(2);
    expect(cognitoCalls().length).toBe(0);

    // Load from history card: no network at all
    mockFetch.mockClear();
    const historyCard = screen.getAllByText("develop-hld.md")[0];
    fireEvent.click(historyCard);
    expect(screen.getByText("Cache Test Project")).toBeInTheDocument();
    expect(jobsCalls().length).toBe(0);

    const taskItem = screen.getByTestId("task-item-task-0-0");
    fireEvent.click(taskItem);
    expect(taskItem).toHaveClass("is-completed");

    const deleteBtns = screen.getAllByRole("button", { name: /Eliminar consulta/i });
    expect(deleteBtns.length).toBe(2);
    fireEvent.click(deleteBtns[0]);

    expect(screen.getByTestId("history-section")).toBeInTheDocument();

    const finalDeleteBtn = screen.getByRole("button", { name: /Eliminar consulta/i });
    fireEvent.click(finalDeleteBtn);
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();

    mockJob = completedJob({
      project_name: "Clear Test Project",
      implementation_goal: "Verify clear history works",
      workstreams: [{ area: "Clear Area", specification: "Clear Spec", tasks: ["Clear Task"] }],
    });
    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "clear-hld.md" } });
    fireEvent.click(submitBtn);
    await screen.findByText("Clear Test Project");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar historial" }));
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();
  });

  it("should not show the history toggle until there is history, then toggle the panel", async () => {
    mockJob = completedJob({
      project_name: "Toggle Test",
      implementation_goal: "goal",
      workstreams: [{ area: "A", specification: "s", tasks: ["t"] }],
    });

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    // No history yet -> no toggle button, no panel
    expect(screen.queryByRole("button", { name: /historial/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "toggle.md" } });
    fireEvent.click(submitBtn);
    await screen.findByText("Toggle Test");

    // Toggle button appears but the panel is still hidden
    const toggleBtn = screen.getByRole("button", { name: /Ver historial/i });
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("history-section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ocultar historial/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ocultar historial/i }));
    expect(screen.queryByTestId("history-section")).not.toBeInTheDocument();
  });

  it("should request a Cognito token and send it as Bearer on the jobs requests", async () => {
    mockCognitoResponse = {
      access_token: "test-cognito-bearer-token-999",
      token_type: "Bearer",
      expires_in: 3600,
    };
    mockJob = completedJob({
      project_name: "Cognito Auth Test",
      implementation_goal: "Verify token flow",
      workstreams: [{ area: "Auth Area", specification: "Specs", tasks: ["Task 1"] }],
    });

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "auth-hld.md" } });

    mockFetch.mockClear();
    fireEvent.click(submitBtn);

    await screen.findByText("Cognito Auth Test");

    const cognito = cognitoCalls();
    expect(cognito.length).toBe(1);
    const [cognitoUrl, cognitoOptions] = cognito[0];
    expect(cognitoUrl).toBe("https://us-east-1qut4lhkwo.auth.us-east-1.amazoncognito.com/oauth2/token");
    expect(cognitoOptions.method).toBe("POST");
    expect(cognitoOptions.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(cognitoOptions.headers["Authorization"]).toBe(`Basic ${btoa("mock-user:mock-password")}`);
    expect(cognitoOptions.body).toBe("grant_type=client_credentials");

    for (const [, options] of jobsCalls()) {
      expect(options.headers["Authorization"]).toBe("Bearer test-cognito-bearer-token-999");
    }
  });

  it("should show an error banner when Cognito authentication fails", async () => {
    mockCognitoOk = false;
    mockCognitoStatus = 401;
    mockCognitoResponse = {
      error: "invalid_client",
      error_description: "Client credentials are invalid",
    };

    render(<App />);

    const branchInput = await screen.findByLabelText("Branch");
    const hldInput = screen.getByLabelText("HLD Path");
    const submitBtn = screen.getByRole("button", { name: /Generar Contexto/i });

    await waitFor(() => {
      expect(screen.queryByText("develop")).toBeInTheDocument();
    });

    fireEvent.change(branchInput, { target: { value: "main" } });
    fireEvent.change(hldInput, { target: { value: "auth-fail.md" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Fallo en autenticación Cognito: Client credentials are invalid/i)
    ).toBeInTheDocument();
  });
});
