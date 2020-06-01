import { Tasks, TopologicalGraph, PackageTasks } from "./types";
import { Pipeline, Globals } from "./publicInterfaces";
import { generateTaskGraph } from "./generateTaskGraph";
import { getPackageTaskFromId } from "./taskId";
import pGraph from "p-graph";

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

export function createPipelineInternal(
  graph: TopologicalGraph,
  globals: Globals,
  tasks: Tasks,
  scope: string[] = []
): Pipeline {
  const pipeline: Pipeline = {
    addTask(task) {
      tasks.set(task.name, task);
      return pipeline;
    },
    scope(newScope) {
      return createPipelineInternal(graph, globals, tasks, newScope);
    },
    async go(runTasks) {
      const taskDeps = generateTaskGraph(scope, runTasks, tasks, graph);

      const packageTasks: PackageTasks = new Map();

      for (const [from, to] of taskDeps) {
        if (!packageTasks.has(from)) {
          const [pkg, taskName] = getPackageTaskFromId(from);
          const task = tasks.get(taskName);
          const location = graph[pkg].location;
          packageTasks.set(from, () => {
            return task?.run(location, process.stdout, process.stderr)!;
          });
        }

        if (!packageTasks.has(to)) {
          const [pkg, taskName] = getPackageTaskFromId(to);
          const task = tasks.get(taskName);
          const location = graph[pkg].location;
          packageTasks.set(to, () => {
            return task?.run(location, process.stdout, process.stderr)!;
          });
        }
      }

      await pGraph(packageTasks, taskDeps);
    },
  };

  return pipeline;
}

export function createPipeline(graph: TopologicalGraph): Pipeline {
  return createPipelineInternal(graph, defaultGlobals, new Map(), []);
}
