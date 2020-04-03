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
  errorFormatter(err: Error): string;
};

export const defaultGlobals: Globals = {
  logger: console,
  cwd() {
    return process.cwd();
  },
  exit(int: number) {
    process.exit(int);
  },
  errorFormatter(err: Error): string {
    return err.stack || err.message;
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

type Promises = { [name: string]: { [script: string]: Promise<void> } };

async function dependencySteps(
  graph: Graph,
  promises: Promises,
  steps: Step[],
  step: Step,
  p: string,
  stepNumber: number,
  shouldBail: () => boolean
): Promise<void> {
  if (stepNumber !== 0) {
    await promises[p][steps[stepNumber - 1].name];
  }

  if (step.type === "topological") {
    const dependencies = graph[p].dependencies.map(
      (d) => promises[d][step.name]
    );
    await Promise.all(dependencies);
  }

  if (shouldBail()) {
    throw new Error("Step should bail");
  }
}

async function executeStep(
  globals: Globals,
  graph: Graph,
  promises: Promises,
  steps: Step[],
  step: Step,
  p: string,
  stepNumber: number,
  shouldBail: () => boolean
): Promise<void> {
  try {
    await dependencySteps(
      graph,
      promises,
      steps,
      step,
      p,
      stepNumber,
      shouldBail
    );
  } catch {
    return;
  }

  try {
    await runAndLogStep(step, graph, p, globals);
  } catch (error) {
    throw {
      stepName: step.name,
      package: p,
      message: error,
    };
  }
}

/*
 * Main function running the pipeline
 */

async function go(
  steps: Step[],
  graph: Graph,
  globals: Globals
): Promise<void> {
  const dependenciesInOrder = getPackagesInDependencyOrder(graph);

  const promises: Promises = {};
  dependenciesInOrder.forEach((d) => (promises[d] = {}));

  let bail = false;
  const state: { stepName: string; package: string; message: string }[] = [];

  steps.forEach((step, i) => {
    dependenciesInOrder.forEach((p) => {
      promises[p][step.name] = executeStep(
        globals,
        graph,
        promises,
        steps,
        step,
        p,
        i,
        () => bail
      ).catch(
        (error: { stepName: string; package: string; message: string }) => {
          bail = true;
          state.push(error);
        }
      );
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

async function runStepWithExceptionHandling(
  globals: Globals,
  name: string,
  location: string,
  runner: () => Promise<Result>
): Promise<Result> {
  try {
    return await runner();
  } catch (e) {
    return {
      success: false,
      stdout: "",
      stderr: `task-scheduler: the step ${name} failed with the following message in ${location}:${EOL}${globals.errorFormatter(
        e
      )}`,
    };
  }
}

async function runAndLogStep(
  step: Step,
  graph: Graph,
  p: string,
  globals: Globals
): Promise<void> {
  const result = await runStepWithExceptionHandling(
    globals,
    step.name,
    graph[p].location,
    () => step.run(path.join(globals.cwd(), graph[p].location))
  );

  const message = formatOutput(result);
  if (result.success) {
    outputResult(message, p, step.name, "success", globals.logger);
  } else {
    throw message;
  }
}

/*
 * Ouptut to console the result of a step.
 */
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

/*
 * Take a block of text and add a prefix in front of each line.
 */
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
  let message = "";
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

/*
 * Return an array of packages from the graph,
 * the array if in order which guaranty the following:
 * for a given package, it is positioned in the array after
 * all its dependencies.
 */
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
