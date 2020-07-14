import { Writable } from "stream";

export type Tasks = Map<string, Task>;

export type TopologicalGraph = {
  [name: string]: {
    location: string;
    dependencies: string[];
  };
};

export type Task = {
  /** name of the task */
  name: string;

  /** a function that gets invoked by the task-scheduler */
  run: (
    cwd: string,
    stdout: Writable,
    stderr: Writable,
    packageName: string
  ) => Promise<boolean>;

  /** dependencies between tasks within the same package (e.g. `build` -> `test`) */
  deps?: string[];

  /** dependencies across packages within the same topological graph (e.g. parent `build` -> child `build`) */
  topoDeps?: string[];

  /** An optional priority for this task. When maxConcurrency is set on a pipeline, unblocked tasks with a higher priority will be scheduled before lower priority tasks. */
  priority?: number;
};

export interface PackageTask extends Task {
  package: string;
}

export type PackageTaskDeps = [string, string][];
export type TaskId = string;

export type Logger = {
  log(message: string): void;
  error(message: string): void;
};
export type TaskResult = {
  success: boolean;
  stderr: string;
  stdout: string;
};
