import { EOL } from "os";
import { Writable } from "stream";
import { createPipelineInternal } from "./pipeline";
import { Task, Globals } from "./publicInterfaces";

describe("task scheduling", () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  test("tological steps wait for dependencies to be done", async () => {
    const tracingContext = makeTestEnvironment();
    const task = tracingContext.makeTask();

    task.topoDeps = [task.name];

    await createPipelineInternal(graph, getGlobals()).addTask(task).go();

    const expected = [
      task.started("/b"),
      task.finished("/b"),
      task.started("/a"),
      task.finished("/a"),
    ];

    expected.forEach((e, i) => expect(e).toBe(tracingContext.logs[i]));
  });

  test("parallel steps dont wait for dependencies to be done", async () => {
    const tracingContext = makeTestEnvironment();
    const task = tracingContext.makeTask();

    await createPipelineInternal(graph, getGlobals()).addTask(task).go();

    const expected = [
      task.started("/a"),
      task.started("/b"),
      task.finished("/a"),
      task.finished("/b"),
    ];

    expected.forEach((e, i) => expect(e).toBe(tracingContext.logs[i]));
  });

  test("tological steps wait for the previous step", async () => {
    const tracingContext = makeTestEnvironment();
    const task1 = tracingContext.makeTask();
    const task2 = tracingContext.makeTask();

    task2.deps = [task1.name];

    await createPipelineInternal(graph, getGlobals())
      .addTask(task1)
      .addTask(task2)
      .go();

    const expected = [
      task1.started("/b"),
      task1.finished("/b"),
      task2.started("/b"),
      task2.finished("/b"),
    ];

    expected.forEach((e, i) =>
      expect(e).toBe(
        tracingContext.logs.filter((line) => line.includes("/b"))[i]
      )
    );
  });

  test("parallel steps run in parallel for same package", async () => {
    const tracingContext = makeTestEnvironment();
    const task1 = tracingContext.makeTask();
    const task2 = tracingContext.makeTask();

    await createPipelineInternal(graph, getGlobals())
      .addTask(task1)
      .addTask(task2)
      .go();

    const expected = [
      task1.started("/b"),
      task2.started("/b"),
      task1.finished("/b"),
      task2.finished("/b"),
    ];

    expected.forEach((e, i) =>
      expect(e).toBe(
        tracingContext.logs.filter((line) => line.includes("/b"))[i]
      )
    );
  });
});

describe("failing steps", () => {
  test("a failing step fails the entire process", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const step = tracingContext.makeTask({ success: false });
    const globals = getGlobals();

    await createPipelineInternal(graph, globals).addTask(step).go();

    expect(globals.exitCode).toBe(1);
  });

  test("the second step is not run if the first one fails", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const task1 = tracingContext.makeTask({ success: false });
    const task2 = tracingContext.makeTask();

    task2.deps = [task1.name];

    await createPipelineInternal(graph, getGlobals())
      .addTask(task1)
      .addTask(task2)
      .go();

    expect(
      tracingContext.logs.filter((l) => l.includes(task1.started("/a"))).length
    ).toBe(1);
    expect(
      tracingContext.logs.filter((l) => l.includes(task2.started("/a"))).length
    ).toBe(0);
  });
});

describe("output", () => {
  test("validating step output", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const task = tracingContext.makeTask({
      stdout: "task stdout",
      stderr: "task stderr",
    });

    const globals = getGlobals();
    await createPipelineInternal(graph, globals).addTask(task).go();

    const expectedStdout: string[] = [
      ` / Done ${task.name} in A`,
      ` | STDOUT`,
      ` |  | task stdout`,
      ` | STDERR`,
      ` |  | task stderr`,
      ` \\ Done ${task.name} in A`,
      ``,
    ];
    const expectedStderr: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validating step output with nothing written to console", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const task = tracingContext.makeTask();

    const globals = getGlobals();
    await createPipelineInternal(graph, globals).addTask(task).go();

    const expectedStdout: string[] = [`Done ${task.name} in A`, ""];
    const expectedStderr: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validating failing step output with nothing written to console", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const task = tracingContext.makeTask({ success: false });

    const globals = getGlobals();
    await createPipelineInternal(graph, globals).addTask(task).go();

    const expectedStdout: string[] = [];
    const expectedStderr: string[] = [`Failed ${task.name} in A`, ``];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validating throwing step output", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const task = tracingContext.makeTask({
      success: new Error("failing miserably"),
      stderr: "task stderr",
      stdout: "task stdout",
    });

    const globals = getGlobals();
    await createPipelineInternal(graph, globals).addTask(task).go();

    const expectedStderr: string[] = [
      ` / Failed ${task.name} in A`,
      ` | STDOUT`,
      ` |  | task stdout`,
      ` | STDERR`,
      ` |  | task stderr`,
      ` |  | stack trace for following error: failing miserably`,
      ` \\ Failed ${task.name} in A`,
      ``,
    ];
    const expectedStdout: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validate output with two steps", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTestEnvironment();
    const task1 = tracingContext.makeTask({
      stdout: "task1 stdout",
    });
    const task2 = tracingContext.makeTask({
      stdout: "task2 stdout",
    });

    task2.deps = [task1.name];

    const globals = getGlobals();
    await createPipelineInternal(graph, globals)
      .addTask(task1)
      .addTask(task2)
      .go();

    const expectedStdout: string[] = [
      ` / Done ${task1.name} in A`,
      ` | STDOUT`,
      ` |  | task1 stdout`,
      ` \\ Done ${task1.name} in A`,
      ``,
      ` / Done ${task2.name} in A`,
      ` | STDOUT`,
      ` |  | task2 stdout`,
      ` \\ Done ${task2.name} in A`,
      ``,
    ];
    const expectedStderr: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("the message of the failing step is output at the end", async () => {
    const graph = {
      A: { location: "a", dependencies: ["B"] },
      B: { location: "b", dependencies: [] },
    };

    const run = async (
      cwd: string,
      stdout: Writable,
      stderr: Writable
    ): Promise<boolean> => {
      if (cwd.replace(/\\/g, "/") === "/a") {
        stdout.write(`task1 stdout${EOL}`);
        return true;
      } else {
        stderr.write(`task1 failed${EOL}`);
        return false;
      }
    };

    const globals = getGlobals(true);

    await createPipelineInternal(graph, globals)
      .addTask({ name: "task1", run })
      .go();

    const expectedStdout: string[] = [
      ` / Done task1 in A`,
      ` | STDOUT`,
      ` |  | task1 stdout`,
      ` \\ Done task1 in A`,
      ``,
      ` / Failed task1 in B`,
      ` | STDERR`,
      ` |  | task1 failed`,
      ` \\ Failed task1 in B`,
      ``,
    ];

    globals.validateOuput(expectedStdout, expectedStdout);
  });
});

type TestingGlobals = Globals & {
  validateOuput(expectedStdout: string[], expectedStderr: string[]): void;
  stdout: string[];
  stderr: string[];
  exitCode: number;
};

function getGlobals(stdoutAsStderr = false): TestingGlobals {
  const _stdout: string[] = [];
  const _stderr: string[] = stdoutAsStderr ? _stdout : [];
  let _exitCode = 0;

  return {
    validateOuput(expectedStdout: string[], expectedStderr: string[]): void {
      expect(_stderr.length).toBe(expectedStderr.length);
      expect(_stdout.length).toBe(expectedStdout.length);
      expectedStdout.forEach((m, i) => expect(_stdout[i]).toBe(m));
      expectedStderr.forEach((m, i) => expect(_stderr[i]).toBe(m));
    },
    logger: {
      log(message: string): void {
        message.split(EOL).forEach((m) => _stdout.push(m));
      },
      error(message: string): void {
        message.split(EOL).forEach((m) => _stderr.push(m));
      },
    },
    cwd(): string {
      return "/";
    },
    exit(int: number): void {
      _exitCode = int;
    },
    get stdout(): string[] {
      return _stdout;
    },
    get stderr(): string[] {
      return _stderr;
    },
    get exitCode(): number {
      return _exitCode;
    },
    errorFormatter(err: Error): string {
      return `stack trace for following error: ${err.message}`;
    },
  };
}

type TaskResult = {
  success: true | false | Error;
  stdout: string;
  stderr: string;
};

type TaskResultOverride = {
  success?: true | false | Error;
  stdout?: string;
  stderr?: string;
};

type TaskMock = Task & {
  started: (cwd: string) => string;
  finished: (cwd: string) => string;
};

async function wait(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 50));
}

function makeTestEnvironment(): {
  logs: string[];
  makeTask: (desiredResult?: TaskResultOverride) => TaskMock;
} {
  const logs: string[] = [];
  return {
    logs,
    makeTask(desiredResult?: TaskResultOverride): TaskMock {
      const name = Math.random().toString(36);
      const defaultResult: TaskResult = {
        success: true,
        stdout: "",
        stderr: "",
      };

      const result = desiredResult
        ? { ...defaultResult, ...desiredResult }
        : defaultResult;

      const messages = {
        started(cwd: string): string {
          return `called ${name} for ${cwd.replace(/\\/g, "/")}`;
        },
        finished(cwd: string): string {
          return `finished ${name} for ${cwd.replace(/\\/g, "/")}`;
        },
      };

      const run = async (
        cwd: string,
        stdout: Writable,
        stderr: Writable
      ): Promise<boolean> => {
        logs.push(messages.started(cwd));
        stdout.write(result.stdout);
        stderr.write(result.stderr);
        await wait();
        if (typeof result.success === "object") {
          logs.push(messages.finished(cwd));
          throw result.success;
        } else {
          logs.push(messages.finished(cwd));
          return result.success;
        }
      };

      return { run, name, ...messages };
    },
  };
}
