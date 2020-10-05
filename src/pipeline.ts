import pGraph, { PGraphNodeMap } from "p-graph";
import { generateTaskGraph } from "./generateTaskGraph";
import { outputResult } from "./output";
import { Globals, Pipeline, Options } from "./publicInterfaces";
import { runAndLog } from "./runAndLog";
import { getPackageTaskFromId, getTaskId } from "./taskId";
import {
  Task,
  Tasks,
  TopologicalGraph,
  PackageTaskDeps,
  PackageTask,
} from "./types";

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
  targetsOnly: false,
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
  tasks: Tasks = new Map(),
  packageTaskDeps: PackageTaskDeps = []
): Pipeline {
  const pipeline: Pipeline = {
    addTask(task) {
      tasks.set(task.name, task);
      return pipeline;
    },
    addDep(from: PackageTask, to: PackageTask) {
      packageTaskDeps.push([
        getTaskId(from.package, from.task),
        getTaskId(to.package, to.task),
      ]);
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
        graph,
        packageTaskDeps,
        globals.targetsOnly
      );
      const failures: {
        task: string;
        package: string;
        message: string;
      }[] = [];

      let bail = false;

      const packageTasks: PGraphNodeMap = new Map();

      for (const [from, to] of taskDeps) {
        for (const taskId of [from, to]) {
          if (!packageTasks.has(taskId)) {
            const [pkg, taskName] = getPackageTaskFromId(taskId);

            if (taskName === "") {
              packageTasks.set(taskId, { run: () => Promise.resolve() });
            } else {
              const task = tasks.get(taskName);
              if (!task) {
                throw new Error(`Missing pipeline config for "${taskName}"`);
              }
              packageTasks.set(taskId, {
                priority: task.priorities && task.priorities[pkg],
                run: () =>
                  execute(globals, graph, task, pkg, () => bail).catch(
                    (error: {
                      task: string;
                      package: string;
                      message: string;
                    }) => {
                      bail = true;
                      failures.push(error);
                    }
                  ),
              });
            }
          }
        }
      }

      await pGraph(packageTasks, taskDeps).run({
        concurrency: globals.concurrency,
      });

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

export function createPipeline(
  graph: TopologicalGraph,
  options: Options = {}
): Pipeline {
  const fullOptions: Globals = { ...defaultGlobals, ...options };
  return createPipelineInternal(graph, fullOptions, new Map(), []);
}
