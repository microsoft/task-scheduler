import { getTaskId, getPackageTaskFromId } from "./taskId";
import { TopologicalGraph, Tasks, TaskId, PackageTaskDeps } from "./types";

export function generateTaskGraph(
  scope: string[],
  targets: string[],
  tasks: Tasks,
  graph: TopologicalGraph
): PackageTaskDeps {
  const taskDeps: PackageTaskDeps = [];

  const traversalQueue: TaskId[] = [];

  for (const pkg of scope) {
    for (const target of targets) {
      traversalQueue.push(getTaskId(pkg, target));
    }
  }

  const visited = new Set<TaskId>();

  while (traversalQueue.length > 0) {
    const taskId = traversalQueue.shift()!;
    const [pkg, taskName] = getPackageTaskFromId(taskId);

    if (!visited.has(taskId) && tasks.has(taskName)) {
      visited.add(taskId);
      const task = tasks.get(taskName)!;
      const toTaskId = getTaskId(pkg, taskName);

      const hasTopoDeps = task.topoDeps && task.topoDeps.length > 0;
      const hasDeps = task.deps && task.deps.length > 0;

      if (hasTopoDeps) {
        for (const from of task.topoDeps!) {
          const depPkgs = graph[pkg].dependencies;

          if (depPkgs !== undefined) {
            // add task dep from all the package deps within repo
            for (const depPkg of depPkgs) {
              const fromTaskId = getTaskId(depPkg, from);
              taskDeps.push([fromTaskId, toTaskId]);
              traversalQueue.push(fromTaskId);
            }
          }
        }
      }

      if (hasDeps) {
        for (const from of task.deps!) {
          const fromTaskId = getTaskId(pkg, from);
          taskDeps.push([fromTaskId, toTaskId]);
          traversalQueue.push(fromTaskId);
        }
      }

      if (!hasDeps && !hasTopoDeps) {
        const fromTaskId = getTaskId(pkg, "");
        taskDeps.push([fromTaskId, toTaskId]);
      }
    }
  }

  return taskDeps;
}
