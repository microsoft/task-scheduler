import * as path from "path";
import { EOL } from "os";

export type Graph = {
  [name: string]: { location: string; dependencies: string[] };
};

export type Result = { success: boolean; stdout: string; stderr: string };

export type Step = {
  name: string;
  run: (cwd: string) => Promise<Result>;
  type: "parallel" | "topological";
};

export type Pipeline = {
  addStep: (step: Step) => Pipeline;
  go: () => void;
};

export function createPipeline(graph: Graph): Pipeline {
  return createPipelineInternal([], graph);
}

function createPipelineInternal(steps: Step[], graph: Graph): Pipeline {
  const pipeline: Pipeline = {
    addStep: (step: Step): Pipeline => {
      return createPipelineInternal([...steps, step], graph);
    },
    go: () => go(steps, graph),
  };

  return pipeline;
}

async function go(steps: Step[], graph: Graph): Promise<void> {
  const dependenciesInOrder = getPackagesInDependencyOrder(graph);

  const promises: { [name: string]: { [script: string]: Promise<void> } } = {};
  dependenciesInOrder.forEach((d) => (promises[d] = {}));

  let bail = false;
  let state: {
    state: undefined | { stepName: string; package: string; message: string };
  } = { state: undefined };

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
            path.join(process.cwd(), graph[p].location)
          );
          const message = formatOutput(result);
          if (result.success) {
            outputResult(message, p, step.name, "success");
          } else {
            bail = true;
            state.state = state.state || {
              stepName: step.name,
              package: p,
              message,
            };
          }
        } catch (e) {
          bail = true;
          state.state = state.state || {
            stepName: step.name,
            package: p,
            message: `task-scheduler: the step ${step.name} failed with the following message in ${graph[p].location}:${EOL}${e.message}`,
          };
        }

        resolve();
      });
    });
  });

  await Promise.all(
    dependenciesInOrder.map((p) => promises[p][steps[steps.length - 1].name])
  );
  if (state.state) {
    outputResult(
      state.state.message,
      state.state.package,
      state.state.stepName,
      "failure"
    );
    process.exit(1);
  }
}

function outputResult(
  message: string,
  p: string,
  stepName: string,
  result: "success" | "failure"
): void {
  const state = result === "success" ? "Done" : "Failed";
  if (message === "") {
    console.log(`${state} ${stepName} in ${p}${EOL}`);
  } else {
    console.log(` / ${state} ${stepName} in ${p}`);
    console.log(prefix(message, " | "));
    console.log(` \\ ${state} ${stepName} in ${p}${EOL}`);
  }
}

function prefix(message: string, prefix: string): string {
  if (message === "") {
    return message;
  }
  return prefix + message.replace(/\r\n|\n/g, `${EOL}${prefix}`);
}

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
