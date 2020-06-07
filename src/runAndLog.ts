import * as path from "path";
import { EOL } from "os";
import { Writable } from "stream";
import * as streams from "memory-streams";

import { Task, TopologicalGraph } from "./types";
import { formatOutput, outputResult } from "./output";

import { Globals } from "./publicInterfaces";

type TaskResult = {
  success: boolean;
  stderr: string;
  stdout: string;
};

async function runAndCollectLogs(
  runner: (stdout: Writable, stderr: Writable) => Promise<boolean>,
  globals: Globals
): Promise<TaskResult> {
  const stdout = new streams.WritableStream();
  const stderr = new streams.WritableStream();

  try {
    const success = await runner(stdout, stderr);

    return { success, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (error) {
    if (error) {
      const exceptionMessage = globals.errorFormatter(error);
      stderr.write(EOL + exceptionMessage);
    }

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

export async function runAndLog(
  task: Task,
  graph: TopologicalGraph,
  p: string,
  globals: Globals
): Promise<void> {
  const result = await runAndCollectLogs(
    (stdout: Writable, stderr: Writable) =>
      task.run(path.join(globals.cwd(), graph[p].location), stdout, stderr, p),
    globals
  );
  await wait();

  const message = formatOutput(result);
  if (result.success) {
    outputResult(message, p, task.name, "success", globals.logger);
  } else {
    throw message;
  }
}
