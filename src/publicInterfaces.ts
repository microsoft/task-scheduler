import { Readable } from "stream";

export type Graph = {
  [name: string]: { location: string; dependencies: string[] };
};

export type Step = {
  name: string;
  run: (cwd: string) => RunResult;
};

export type RunResult = {
  stdout: Readable;
  stderr: Readable;
  promise: Promise<boolean>;
};

export type Pipeline = {
  addParallelStep: (step: Step) => Pipeline;
  addTopologicalStep: (step: Step) => Pipeline;
  go: () => Promise<void>;
};
