import { Writable } from "stream";

export type Graph = {
  [name: string]: { location: string; dependencies: string[] };
};

export type Step = {
  name: string;
  run: (cwd: string, stdout: Writable, stderr: Writable) => Promise<boolean>;
};

export type Pipeline = {
  addParallelStep: (step: Step) => Pipeline;
  addTopologicalStep: (step: Step) => Pipeline;
  go: () => Promise<void>;
};
