import { Logger, TaskResult } from "./types";
import { EOL } from "os";

/*
 * Ouptut to console the result of a task.
 */
export function outputResult(
  message: string,
  p: string,
  name: string,
  result: "success" | "failure",
  logger: Logger
): void {
  const state = result === "success" ? "Done" : "Failed";
  const log = result === "success" ? logger.log : logger.error;
  if (message === "") {
    log(`${state} ${name} in ${p}${EOL}`);
  } else {
    log(` / ${state} ${name} in ${p}`);
    log(prefix(message, " | "));
    log(` \\ ${state} ${name} in ${p}${EOL}`);
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
export function formatOutput(result: TaskResult): string {
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
