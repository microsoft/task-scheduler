import { generateTaskGraph } from "./generateTaskGraph";
import { getPackageTaskFromId } from "./taskId";
import { Pipeline, Globals } from "./publicInterfaces";
import { runAndLog } from "./runAndLog";
import { Tasks, TopologicalGraph, PackageTasks, Task } from "./types";
import pGraph from "p-graph";
import { outputResult } from "./output";

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

async function execute(
  globals: Globals,
  graph: TopologicalGraph,
  task: Task,
  pkg: string,
  shouldBail: () => boolean
): Promise<void> {
  if (shouldBail()) {
    return;
  }

  try {
    return await runAndLog(task, graph, pkg, globals);
  } catch (error) {
    throw {
      task: task.name,
      package: pkg,
      message: error,
    };
  }
}

export function createPipelineInternal(
  graph: TopologicalGraph,
  globals: Globals,
  tasks: Tasks = new Map()
): Pipeline {
  const pipeline: Pipeline = {
    addTask(task) {
      tasks.set(task.name, task);
      return pipeline;
    },
    async go(targets = {}) {
      if (typeof targets.packages === "undefined") {
        targets.packages = Object.keys(graph);
      }

      if (typeof targets.tasks === "undefined") {
        targets.tasks = [...tasks.keys()];
      }

      const taskDeps = generateTaskGraph(
        targets.packages,
        targets.tasks,
        tasks,
        graph
      );
      const failures: {
        task: string;
        package: string;
        message: string;
      }[] = [];
      let bail: boolean = false;

      const packageTasks: PackageTasks = new Map();

      for (const [from, to] of taskDeps) {
        for (const taskId of [from, to]) {
          if (!packageTasks.has(taskId)) {
            const [pkg, taskName] = getPackageTaskFromId(taskId);

            if (taskName === "") {
              packageTasks.set(taskId, () => Promise.resolve());
            } else {
              const task = tasks.get(taskName);
              packageTasks.set(taskId, () =>
                execute(globals, graph, task!, pkg, () => bail).catch(
                  (error: {
                    task: string;
                    package: string;
                    message: string;
                  }) => {
                    bail = true;
                    failures.push(error);
                  }
                )
              );
            }
          }
        }
      }

      await pGraph(packageTasks, taskDeps).run();

      if (failures.length > 0) {
        failures.forEach((err) =>
          outputResult(
            err.message,
            err.package,
            err.task,
            "failure",
            globals.logger
          )
        );

        globals.exit(1);
      }
    },
  };

  return pipeline;
}

export function createPipeline(graph: TopologicalGraph): Pipeline {
  return createPipelineInternal(graph, defaultGlobals, new Map());
}
