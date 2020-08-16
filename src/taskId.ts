import { TaskId } from "./types";

const DELIMITER = "#";

export function getTaskId(pkg: string, taskName: string): string {
  return `${pkg}${DELIMITER}${taskName}`;
}

export function getPackageTaskFromId(taskId: TaskId): string[] {
  return taskId.split(DELIMITER);
}
