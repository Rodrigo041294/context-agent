/**
 * Service for the async context-generation jobs API.
 *
 * Flow:
 *   1. POST /jobs               -> { jobId, status: "PENDING" }
 *   2. GET  /jobs/{jobId}       -> poll until status is COMPLETED or FAILED
 *        - PENDING  -> poll every 3s
 *        - RUNNING  -> poll every 10s
 */

import { getAccessToken } from "./auth";
import type { CreateJobResponse, JobResource } from "../types";

const JOBS_URL = (
  import.meta.env.VITE_JOBS_URL ||
  "https://z04iljfdsb.execute-api.us-east-1.amazonaws.com/default/jobs"
).trim();

/** The repository is fixed by product decision and not user-selectable. */
export const FIXED_REPOSITORY = "JoseAnastacioEsquivelSalas/architecture-docs";

/** Poll interval (ms) while the job has not started running yet. */
export const PENDING_POLL_INTERVAL_MS = 3000;
/** Poll interval (ms) once the job is running. */
export const RUNNING_POLL_INTERVAL_MS = 10000;
/** Safety cap so a stuck job never polls forever. */
const MAX_POLL_DURATION_MS = 10 * 60 * 1000;

function buildAuthHeaders(token: string, json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) {
    headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  return headers;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data?.message || data?.errorMessage || data?.error || fallback;
  } catch {
    return fallback;
  }
}

/** Step 3: create the job. */
export async function createJob(params: {
  branch: string;
  hldPath: string;
}): Promise<CreateJobResponse> {
  const token = await getAccessToken();

  const response = await fetch(JOBS_URL, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({
      repository: FIXED_REPOSITORY,
      branch: params.branch,
      hld_path: params.hldPath,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Error HTTP ${response.status} al crear el job.`));
  }

  const data: CreateJobResponse = await response.json();
  if (!data?.jobId) {
    throw new Error("La API no devolvió un jobId válido.");
  }
  return data;
}

/** Step 4: fetch the current job state. */
export async function getJob(jobId: string): Promise<JobResource> {
  const token = await getAccessToken();

  const response = await fetch(`${JOBS_URL}/${encodeURIComponent(jobId)}`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(
      await readError(response, `Error HTTP ${response.status} al consultar el job ${jobId}.`)
    );
  }

  return (await response.json()) as JobResource;
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Polls the job until it reaches a terminal state (COMPLETED or FAILED).
 * Uses a 3s cadence while PENDING and 10s while RUNNING.
 */
export async function pollJobUntilDone(
  jobId: string,
  options: {
    onUpdate?: (job: JobResource) => void;
    signal?: AbortSignal;
  } = {}
): Promise<JobResource> {
  const { onUpdate, signal } = options;
  const startedAt = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const job = await getJob(jobId);
    onUpdate?.(job);

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      return job;
    }

    if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
      throw new Error("El job excedió el tiempo máximo de espera.");
    }

    const interval =
      job.status === "RUNNING" ? RUNNING_POLL_INTERVAL_MS : PENDING_POLL_INTERVAL_MS;
    await sleep(interval, signal);
  }
}
