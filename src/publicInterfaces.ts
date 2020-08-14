import { Task, Logger, PackageTask } from "./types";

export { Task, TopologicalGraph, Tasks } from "./types";

export type Pipeline = {
  addTask: (task: Task) => Pipeline;
  addDep: (from: PackageTask, to: PackageTask) => Pipeline;
  go: (targets?: { packages?: string[]; tasks?: string[] }) => Promise<void>;
};

export type Globals = {
  logger: Logger;
  cwd(): string;
  exit(int: number): void;
  errorFormatter(err: Error): string;
  targetsOnly: boolean;
  /** The maximum number of tasks that can be running simultaneously running for the given pipeline. By default, concurrency is not limited */
  concurrency?: number;
};

export type Options = Partial<
  Pick<Globals, "logger" | "exit" | "targetsOnly" | "concurrency">
>;
