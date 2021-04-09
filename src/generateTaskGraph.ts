import { getTaskId, getPackageTaskFromId } from "./taskId";
import { TopologicalGraph, Tasks, TaskId, PackageTaskDeps } from "./types";

export function generateTaskGraph(
  scope: string[],
  targets: string[],
  tasks: Tasks,
  graph: TopologicalGraph,
  packageTaskDeps: PackageTaskDeps = [],
  targetsOnly = false,
  canRunTaskInPkg: (taskName: string, packageName: string) => boolean = (_, __) => true
): PackageTaskDeps {
  const taskDeps: PackageTaskDeps = [];

  // These are the manually added package task dependencies from "addDep()" API
  const packageTaskDepsMap = getPackageTaskDepsMap(packageTaskDeps);

  const traversalQueue: TaskId[] = [];

  for (const pkg of scope) {
    for (const target of targets) {
        if (canRunTaskInPkg(target, pkg)) {
          traversalQueue.push(getTaskId(pkg, target));
        }
    }
  }

  const visited = new Set<TaskId>();

  while (traversalQueue.length > 0) {
    const taskId = traversalQueue.shift()!;
    const [pkg, taskName] = getPackageTaskFromId(taskId);

    if (!visited.has(taskId) && tasks.has(taskName)) {
      visited.add(taskId);
      const task = tasks.get(taskName)!;

      // If we're in targetsOnly mode, make sure none of the non-targets are filtered out of task.deps
      task.deps = targetsOnly
        ? task.deps?.filter((d) => targets.indexOf(d) > -1)
        : task.deps;

      const toTaskId = getTaskId(pkg, taskName);

      const hasTopoDeps =
        task.topoDeps &&
        task.topoDeps.length > 0 &&
        typeof graph[pkg].dependencies !== "undefined" &&
        Object.keys(graph[pkg].dependencies).length > 0;
      const hasDeps = task.deps && task.deps.length > 0;
      const hasPackagetTaskDeps = packageTaskDepsMap.has(taskId);

      let dependencyAdded = false;
      if (hasTopoDeps) {
        for (const from of task.topoDeps!) {
          const depPkgs = graph[pkg].dependencies;

          // add task dep from all the package deps within repo
          for (const depPkg of depPkgs) {
            if (canRunTaskInPkg(from, depPkg)) {
              const fromTaskId = getTaskId(depPkg, from);
              taskDeps.push([fromTaskId, toTaskId]);
              traversalQueue.push(fromTaskId);
              dependencyAdded = true;
            }
          }
        }
      }

      if (hasDeps) {
        for (const from of task.deps!) {
          if (canRunTaskInPkg(from, pkg)) {
            const fromTaskId = getTaskId(pkg, from);
            taskDeps.push([fromTaskId, toTaskId]);
            traversalQueue.push(fromTaskId);
            dependencyAdded = true;
          }
        }
      }

      if (hasPackagetTaskDeps) {
        for (const fromTaskId of packageTaskDepsMap.get(taskId)!) {
          const [fromPkgName, fromTaskName] = getPackageTaskFromId(fromTaskId);
          if (canRunTaskInPkg(fromTaskName, fromPkgName)) {
            taskDeps.push([fromTaskId, toTaskId]);
            traversalQueue.push(fromTaskId);
            dependencyAdded = true;
          }
        }
      }

      if (!dependencyAdded) {
        const fromTaskId = getTaskId(pkg, "");
        taskDeps.push([fromTaskId, toTaskId]);
      }
    }
  }

  return taskDeps;
}

function getPackageTaskDepsMap(packageTaskDeps: PackageTaskDeps) {
  const depMap = new Map<TaskId, TaskId[]>();
  for (const [from, to] of packageTaskDeps) {
    if (!depMap.has(to)) {
      depMap.set(to, []);
    }
    depMap.get(to)!.push(from);
  }
  return depMap;
}
