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
