import { Writable } from "stream";

export type Tasks = Map<string, Task>;

export type TopologicalGraph = {
  [name: string]: { location: string; dependencies: string[] };
};

export type Task = {
  name: string;
  run: (cwd: string, stdout: Writable, stderr: Writable) => Promise<boolean>;
  deps?: string[];
  topoDeps?: string[];
};

export interface PackageTask extends Task {
  package: string;
}

export type PackageTaskDeps = [string, string][];
export type PackageTasks = Map<string, () => Promise<unknown>>;
export type TaskId = string;

export type Logger = {
  log(message: string): void;
  error(message: string): void;
};
