import * as path from "path";
import { EOL } from "os";

export type Graph = {
  [name: string]: { location: string; dependencies: string[] };
};

export type Result = { success: boolean; stdout: string; stderr: string };

export type Logger = {
  log(message: string): void;
  error(message: string): void;
};

export type Globals = {
  logger: Logger;
  cwd(): string;
  exit(int: number): void;
};

export const defaultGlobals: Globals = {
  logger: console,
  cwd() {
    return process.cwd();
  },
  exit(int: number) {
    process.exit(int);
  },
};

export type Step = {
  name: string;
  run: (cwd: string) => Promise<Result>;
  type: "parallel" | "topological";
};

export type Pipeline = {
  addStep: (step: Step) => Pipeline;
  go: () => Promise<void>;
};

export function createPipeline(
  graph: Graph,
  globals: Globals = defaultGlobals
): Pipeline {
  return createPipelineInternal([], graph, globals);
}

function createPipelineInternal(
  steps: Step[],
  graph: Graph,
  globals: Globals
): Pipeline {
  const pipeline: Pipeline = {
    addStep: (step: Step): Pipeline => {
      return createPipelineInternal([...steps, step], graph, globals);
    },
    go: async () => await go(steps, graph, globals),
  };

  return pipeline;
}

/*
 * promises = { "a": { "step1": promise, "step2": promise }, "b": { "step1": promise, "step2": promise }} 
 * promises = { "b": {}, "a": {}} 
 * promises = { "b": { "step1" : promise }, "a": { "step1": promise}} 

 *
 *
 */

async function go(
  steps: Step[],
  graph: Graph,
  globals: Globals
): Promise<void> {
  const dependenciesInOrder = getPackagesInDependencyOrder(graph);

  const promises: { [name: string]: { [script: string]: Promise<void> } } = {};
  dependenciesInOrder.forEach((d) => (promises[d] = {}));

  let bail = false;
  let state: { stepName: string; package: string; message: string }[] = [];

  steps.forEach((step, i) => {
    dependenciesInOrder.forEach((p) => {
      promises[p][step.name] = new Promise(async (resolve) => {
        if (i !== 0) {
          await promises[p][steps[i - 1].name];
        }

        if (step.type === "topological") {
          const dependencies = graph[p].dependencies.map(
            (d) => promises[d][step.name]
          );
          await Promise.all(dependencies);
        }

        if (bail) {
          resolve();
          return;
        }
        try {
          const result = await step.run(
            path.join(globals.cwd(), graph[p].location)
          );
          const message = formatOutput(result);
          if (result.success) {
            outputResult(message, p, step.name, "success", globals.logger);
          } else {
            bail = true;
            state.push({
              stepName: step.name,
              package: p,
              message,
            });
          }
        } catch (e) {
          bail = true;
          state.push({
            stepName: step.name,
            package: p,
            message: `task-scheduler: the step ${step.name} failed with the following message in ${graph[p].location}:${EOL}${e.message}`,
          });
        }

        resolve();
      });
    });
  });

  await Promise.all(
    dependenciesInOrder.map((p) => promises[p][steps[steps.length - 1].name])
  );

  if (state.length !== 0) {
    state.forEach((s) =>
      outputResult(s.message, s.package, s.stepName, "failure", globals.logger)
    );
    globals.exit(1);
  }
}

function outputResult(
  message: string,
  p: string,
  stepName: string,
  result: "success" | "failure",
  logger: Logger
): void {
  const state = result === "success" ? "Done" : "Failed";
  const log = result === "success" ? logger.log : logger.error;
  if (message === "") {
    log(`${state} ${stepName} in ${p}${EOL}`);
  } else {
    log(` / ${state} ${stepName} in ${p}`);
    log(prefix(message, " | "));
    log(` \\ ${state} ${stepName} in ${p}${EOL}`);
  }
}

function prefix(message: string, prefix: string): string {
  return (
    prefix +
    message
      .split(EOL)
      .filter((m) => m !== "")
      .join(`${EOL}${prefix}`)
  );
}

/*
 * format stdout and stderr in the following format:
 *
 * ```
 * STDOUT:
 *  | some output
 * STDERR:
 *  | some stderr output
 * ```
 */
function formatOutput(result: Result): string {
  let message: string = "";
  if (result.stdout !== ``) {
    message += `STDOUT${EOL}`;
    message += prefix(result.stdout, " | ");
    message += `${EOL}`;
  }
  if (result.stderr !== ``) {
    message += `STDERR${EOL}`;
    message += prefix(result.stderr, " | ");
    message += `${EOL}`;
  }
  return message;
}

function getPackagesInDependencyOrder(graph: Graph): string[] {
  let unprocessed = Object.keys(graph);

  const dependenciesInOrder: string[] = [];

  while (unprocessed.length > 0) {
    const candidate = unprocessed.find(
      (p) =>
        graph[p].dependencies.filter((d) => unprocessed.includes(d)).length ===
        0
    );
    if (!candidate) {
      throw new Error("Circular dependencies are not supported");
    }
    dependenciesInOrder.push(candidate);
    unprocessed = unprocessed.filter((p) => p !== candidate);
  }

  return dependenciesInOrder;
}
