export interface Task {
  id: string;
  description: string;
  completed: boolean;
}

export interface Workstream {
  area: string;
  specification: string;
  tasks: string[];
}

export interface InteractiveWorkstream {
  area: string;
  specification: string;
  tasks: Task[];
}

export interface GeneratedContext {
  project_name: string;
  implementation_goal: string;
  workstreams: Workstream[];
}

export interface InteractiveContext {
  projectName: string;
  implementationGoal: string;
  workstreams: InteractiveWorkstream[];
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
