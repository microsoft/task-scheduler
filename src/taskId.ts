import { TaskId } from "./types";

const DELIMITER = "###";

export function getTaskId(pkg: string, taskName: string) {
  return `${pkg}${DELIMITER}${taskName}`;
}

export function getPackageTaskFromId(taskId: TaskId) {
  return taskId.split(DELIMITER);
}
