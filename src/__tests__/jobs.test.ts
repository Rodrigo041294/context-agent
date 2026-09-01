import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createJob,
  getJob,
  pollJobUntilDone,
  FIXED_REPOSITORY,
  PENDING_POLL_INTERVAL_MS,
  RUNNING_POLL_INTERVAL_MS,
} from "../services/jobs";
import { clearTokenCache } from "../services/auth";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const okJson = (body: any) => ({ ok: true, status: 200, json: async () => body });

describe("jobs service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
    vi.stubEnv("VITE_JOBS_URL", "https://api.test/default/jobs");
    vi.stubEnv("VITE_AUTH_URL", "https://cognito.test/oauth2/token");
    vi.stubEnv("VITE_AUTH_USER", "client-id");
    vi.stubEnv("VITE_AUTH_PASSWORD", "client-secret");

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) {
        return okJson({ access_token: "tok-abc", expires_in: 3600 });
      }
      return okJson({});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("createJob posts the fixed repository plus branch and hld_path with a Bearer token", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      return okJson({ jobId: "j-1", status: "PENDING" });
    });

    const res = await createJob({ branch: "main", hldPath: "projects/IA_Framework/hld.md" });
    expect(res).toEqual({ jobId: "j-1", status: "PENDING" });

    const call = mockFetch.mock.calls.find((c) => /\/jobs$/.test(c[0]));
    expect(call).toBeDefined();
    const [, options] = call!;
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toBe("Bearer tok-abc");
    expect(JSON.parse(options.body)).toEqual({
      repository: FIXED_REPOSITORY,
      branch: "main",
      hld_path: "projects/IA_Framework/hld.md",
    });
  });

  it("createJob throws a descriptive error on failure", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      return { ok: false, status: 502, json: async () => ({ message: "bad gateway" }) };
    });

    await expect(createJob({ branch: "main", hldPath: "x" })).rejects.toThrow("bad gateway");
  });

  it("getJob fetches /jobs/{id} and returns the job resource", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      return okJson({ jobId: "j-9", status: "RUNNING" });
    });

    const job = await getJob("j-9");
    expect(job.status).toBe("RUNNING");
    const call = mockFetch.mock.calls.find((c) => c[0].includes("/jobs/j-9"));
    expect(call).toBeDefined();
  });

  it("reuses the access token across job calls while it is still valid", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      if (/\/jobs$/.test(url)) return okJson({ jobId: "j-1", status: "PENDING" });
      return okJson({ jobId: "j-1", status: "COMPLETED", generatedContext: "{}" });
    });

    await createJob({ branch: "main", hldPath: "x" });
    await getJob("j-1");
    await getJob("j-1");

    const tokenCalls = mockFetch.mock.calls.filter((c) => c[0].includes("oauth2/token"));
    expect(tokenCalls.length).toBe(1);
  });

  it("polls every 3s while PENDING and every 10s while RUNNING until COMPLETED", async () => {
    vi.useFakeTimers();

    const responses = [
      { jobId: "j-1", status: "PENDING" },
      { jobId: "j-1", status: "PENDING" },
      { jobId: "j-1", status: "RUNNING" },
      { jobId: "j-1", status: "COMPLETED", generatedContext: '{"project_name":"P"}' },
    ];
    let idx = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      return okJson(responses[Math.min(idx++, responses.length - 1)]);
    });

    const onUpdate = vi.fn();
    const promise = pollJobUntilDone("j-1", { onUpdate });

    // 1st GET is immediate (PENDING)
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ status: "PENDING" }));

    await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS); // 2nd GET -> PENDING
    await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS); // 3rd GET -> RUNNING
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ status: "RUNNING" }));

    // Still not resolved before the RUNNING interval elapses
    await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(RUNNING_POLL_INTERVAL_MS - PENDING_POLL_INTERVAL_MS); // 4th GET -> COMPLETED

    const job = await promise;
    expect(job.status).toBe("COMPLETED");
    expect(job.generatedContext).toBe('{"project_name":"P"}');
  });

  it("returns the FAILED job without throwing so the caller can read errorMessage", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      return okJson({ jobId: "j-1", status: "FAILED", errorMessage: "boom" });
    });

    const job = await pollJobUntilDone("j-1");
    expect(job.status).toBe("FAILED");
    expect(job.errorMessage).toBe("boom");
  });

  it("aborts polling when the signal is triggered", async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth2/token")) return okJson({ access_token: "tok-abc", expires_in: 3600 });
      return okJson({ jobId: "j-1", status: "PENDING" });
    });

    const controller = new AbortController();
    const promise = pollJobUntilDone("j-1", { signal: controller.signal });
    const assertion = expect(promise).rejects.toThrow(/abort/i);

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS);

    await assertion;
  });
});
