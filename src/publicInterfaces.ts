import { Task, Logger } from "./types";

export { Task, TopologicalGraph, Tasks } from "./types";

export type Pipeline = {
  addTask: (task: Task) => Pipeline;
  go: (targets?: { packages?: string[]; tasks?: string[] }) => Promise<void>;
};

export type Globals = {
  logger: Logger;
  cwd(): string;
  exit(int: number): void;
  errorFormatter(err: Error): string;
};
