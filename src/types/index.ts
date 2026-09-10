// ---------------------------------------------------------------------------
// Raw shape returned by the jobs API inside `generatedContext` (a JSON string).
// The API now organises the work as project -> components -> features, and each
// feature carries its acceptance criteria.
// ---------------------------------------------------------------------------

export interface Feature {
  id: number | string;
  name: string;
  title: string;
  description: string;
  acceptance: string[];
}

export interface Component {
  name: string;
  title: string;
  description: string;
  features: Feature[];
}

export interface GeneratedContext {
  project_name: string;
  implementation_goal: string;
  components: Component[];
}

// ---------------------------------------------------------------------------
// Interactive shape used by the UI: a *feature* is the checkable unit so
// progress can be tracked and persisted per query. Acceptance criteria are
// shown as read-only "puntos a considerar".
// ---------------------------------------------------------------------------

export interface InteractiveFeature {
  id: string;
  name: string;
  title: string;
  description: string;
  /** Acceptance criteria — informational bullet list, not a checklist. */
  acceptance: string[];
  completed: boolean;
}

export interface InteractiveComponent {
  name: string;
  title: string;
  description: string;
  features: InteractiveFeature[];
}

export interface InteractiveContext {
  projectName: string;
  implementationGoal: string;
  components: InteractiveComponent[];
}

export interface ApiPayload {
  repository: string;
  branch: string;
  hld_path: string;
}

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

/** Response of POST /jobs */
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
}

/** Response of GET /jobs/{jobId} */
export interface JobResource {
  jobId: string;
  status: JobStatus;
  branch?: string;
  repository?: string;
  hld_path?: string;
  createdAt?: string;
  model?: string;
  /** JSON string with the GeneratedContext shape, present when status === COMPLETED */
  generatedContext?: string;
  /** Present when status === FAILED */
  errorMessage?: string;
}

export interface HistoryItem {
  id: string;
  branch: string;
  hldPath: string;
  timestamp: number;
  context: InteractiveContext;
}
