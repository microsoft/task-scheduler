import * as path from "path";
import { EOL } from "os";
import { Writable } from "stream";
import * as streams from "memory-streams";

import { Step, Graph, Pipeline } from "./publicInterfaces";

type Logger = {
  log(message: string): void;
  error(message: string): void;
};

export type Globals = {
  logger: Logger;
  cwd(): string;
  exit(int: number): void;
  errorFormatter(err: Error): string;
};

const defaultGlobals: Globals = {
  logger: console,
  cwd() {
    return process.cwd();
  },
  exit(int: number) {
    process.exit(int);
  },
  errorFormatter(err: Error): string {
    return err.stack || err.message || err.toString();
  },
};
type InternalStep = {
  id: number;
  step: Step;
  stepType: "topological" | "parallel";
};

export function createPipeline(graph: Graph): Pipeline {
  return createPipelineInternal(graph, defaultGlobals);
}

export function createPipelineInternal(
  graph: Graph,
  globals: Globals,
  steps: InternalStep[] = []
): Pipeline {
  const pipeline: Pipeline = {
    addTopologicalStep: (step: Step): Pipeline => {
      return createPipelineInternal(graph, globals, [
        ...steps,
        { step, stepType: "topological", id: steps.length },
      ]);
    },
    addParallelStep: (step: Step): Pipeline => {
      return createPipelineInternal(graph, globals, [
        ...steps,
        { step, stepType: "parallel", id: steps.length },
      ]);
    },
    go: async () => await go(steps, graph, globals),
  };

  return pipeline;
}

type Promises = { [name: string]: { [stepId: number]: Promise<void> } };

async function dependencySteps(
  graph: Graph,
  promises: Promises,
  step: InternalStep,
  p: string,
  shouldBail: () => boolean
): Promise<void> {
  if (step.id !== 0) {
    await promises[p][step.id - 1];
  }

  if (step.stepType === "topological") {
    const dependencies = graph[p].dependencies.map((d) => promises[d][step.id]);
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
  step: InternalStep,
  p: string,
  shouldBail: () => boolean
): Promise<void> {
  try {
    await dependencySteps(graph, promises, step, p, shouldBail);
  } catch {
    return;
  }

  try {
    await runAndLogStep(step.step, graph, p, globals);
  } catch (error) {
    throw {
      stepName: step.step.name,
      package: p,
      message: error,
    };
  }
}

/*
 * Main function running the pipeline
 */

async function go(
  steps: InternalStep[],
  graph: Graph,
  globals: Globals
): Promise<void> {
  const dependenciesInOrder = getPackagesInDependencyOrder(graph);

  const promises: Promises = {};
  dependenciesInOrder.forEach((d) => (promises[d] = {}));

  let bail = false;
  const failures: { stepName: string; package: string; message: string }[] = [];

  steps.forEach((step) => {
    dependenciesInOrder.forEach((p) => {
      promises[p][step.id] = executeStep(
        globals,
        graph,
        promises,
        step,
        p,
        () => bail
      ).catch(
        (error: { stepName: string; package: string; message: string }) => {
          bail = true;
          failures.push(error);
        }
      );
    });
  });

  await Promise.all(
    dependenciesInOrder.map((p) => promises[p][steps[steps.length - 1].id])
  );

  if (failures.length !== 0) {
    failures.forEach((s) =>
      outputResult(s.message, s.package, s.stepName, "failure", globals.logger)
    );
    globals.exit(1);
  }
}

type StepResult = {
  success: boolean;
  stderr: string;
  stdout: string;
};

async function runAndCollectLogs(
  runner: (stdout: Writable, stderr: Writable) => Promise<boolean>,
  globals: Globals
): Promise<StepResult> {
  const stdout = new streams.WritableStream();
  const stderr = new streams.WritableStream();

  try {
    const success = await runner(stdout, stderr);

    return { success, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (error) {
    const exceptionMessage = globals.errorFormatter(error);
    stderr.write(EOL + exceptionMessage);
    return {
      success: false,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
  }
}

async function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

async function runAndLogStep(
  step: Step,
  graph: Graph,
  p: string,
  globals: Globals
): Promise<void> {
  const result = await runAndCollectLogs(
    (stdout: Writable, stderr: Writable) =>
      step.run(path.join(globals.cwd(), graph[p].location), stdout, stderr),
    globals
  );
  await wait();

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
function formatOutput(result: StepResult): string {
  let message = "";
  if (result.stdout.length !== 0) {
    message += `STDOUT${EOL}`;
    message += prefix(result.stdout, " | ");
    message += `${EOL}`;
  }
  if (result.stderr.length !== 0) {
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
