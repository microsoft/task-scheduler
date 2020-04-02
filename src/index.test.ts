import { createPipeline, Result, Globals } from ".";
import { EOL } from "os";

describe("task scheduling", () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  test("testInOrder", async () => {
    const { fn: run } = makeTracingContext().makeStep();

    await createPipeline(graph, getGlobals())
      .addStep({ name: "step1", type: "topological", run })
      .go();

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, "/b");
    expect(run).toHaveBeenNthCalledWith(2, "/a");
  });

  test("tological steps wait for dependencies to be done", async () => {
    const tracingContext = makeTracingContext();
    const { fn: run, started, finished, name } = tracingContext.makeStep();

    await createPipeline(graph, getGlobals())
      .addStep({ name, type: "topological", run })
      .go();

    const expected = [
      started("/b"),
      finished("/b"),
      started("/a"),
      finished("/a"),
    ];

    expected.forEach((e, i) => expect(e).toBe(tracingContext.logs[i]));
  });

  test("parallel steps dont wait for dependencies to be done", async () => {
    const tracingContext = makeTracingContext();
    const { fn: run, started, finished } = tracingContext.makeStep();

    await createPipeline(graph, getGlobals())
      .addStep({ name: "step1", type: "parallel", run })
      .go();

    const expected = [
      started("/b"),
      started("/a"),
      finished("/b"),
      finished("/a"),
    ];

    expected.forEach((e, i) => expect(e).toBe(tracingContext.logs[i]));
  });

  test("tological steps wait for the previous step", async () => {
    const tracingContext = makeTracingContext();
    const {
      fn: run,
      started: runStarted,
      finished: runFinished,
    } = tracingContext.makeStep();
    const {
      fn: lint,
      started: lintStarted,
      finished: lintFinished,
    } = tracingContext.makeStep();

    await createPipeline(graph, getGlobals())
      .addStep({ name: "step1", type: "parallel", run })
      .addStep({ name: "step2", type: "topological", run: lint })
      .go();

    const expected = [
      runStarted("/b"),
      runFinished("/b"),
      lintStarted("/b"),
      lintFinished("/b"),
    ];

    expected.forEach((e, i) =>
      expect(e).toBe(
        tracingContext.logs.filter((line) => line.includes("/b"))[i]
      )
    );
  });

  test("parallel steps wait for the previous step", async () => {
    const tracingContext = makeTracingContext();
    const {
      fn: run,
      started: runStarted,
      finished: runFinished,
    } = tracingContext.makeStep();
    const {
      fn: lint,
      started: lintStarted,
      finished: lintFinished,
    } = tracingContext.makeStep();

    await createPipeline(graph, getGlobals())
      .addStep({ name: "step1", type: "parallel", run })
      .addStep({ name: "step2", type: "parallel", run: lint })
      .go();

    const expected = [
      runStarted("/a"),
      runFinished("/a"),
      lintStarted("/a"),
      lintFinished("/a"),
    ];

    expected.forEach((e, i) =>
      expect(e).toBe(
        tracingContext.logs.filter((line) => line.includes("/a"))[i]
      )
    );
  });
});

describe("failing steps", () => {
  test("a failing step fails the entire process", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const { fn: run } = makeTracingContext().makeStep({ success: false });

    const globals = getGlobals();
    await createPipeline(graph, globals)
      .addStep({ name: "step1", type: "parallel", run })
      .go();

    expect(globals.exitCode).toBe(1);
  });

  test("the second step is not run if the first one fails", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTracingContext();
    const { fn: run } = tracingContext.makeStep({ success: false });
    const { fn: lint } = tracingContext.makeStep({ success: true });

    await createPipeline(graph, getGlobals())
      .addStep({ name: "run", type: "topological", run })
      .addStep({ name: "lint", type: "topological", run: lint })
      .go();

    expect(lint).toHaveBeenCalledTimes(0);
  });
});

describe("output", () => {
  test("validating step output", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTracingContext();
    const { fn: run } = tracingContext.makeStep({
      stdout: "step stdout",
      stderr: "step stderr",
    });

    const globals = getGlobals();
    await createPipeline(graph, globals)
      .addStep({ name: "step1", type: "parallel", run })
      .go();

    const expectedStdout: string[] = [
      " / Done step1 in A",
      " | STDOUT",
      " |  | step stdout",
      " | STDERR",
      " |  | step stderr",
      " \\ Done step1 in A",
      "",
    ];
    const expectedStderr: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validating step output with nothing written to console", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTracingContext();
    const { fn: run } = tracingContext.makeStep();

    const globals = getGlobals();
    await createPipeline(graph, globals)
      .addStep({ name: "step1", type: "parallel", run })
      .go();

    const expectedStdout: string[] = ["Done step1 in A", ""];
    const expectedStderr: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validating failing step output with nothing written to console", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTracingContext();
    const { fn: run } = tracingContext.makeStep({ success: false });

    const globals = getGlobals();
    await createPipeline(graph, globals)
      .addStep({ name: "step1", type: "parallel", run })
      .go();

    const expectedStdout: string[] = [];
    const expectedStderr: string[] = ["Failed step1 in A", ""];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validating throwing step output", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTracingContext();
    const { fn: run, name } = tracingContext.makeStep({
      throws: true,
    });

    const globals = getGlobals();
    await createPipeline(graph, globals)
      .addStep({ name, type: "parallel", run })
      .go();

    const expectedStderr: string[] = [
      ` / Failed ${name} in A`,
      ` | task-scheduler: the step ${name} failed with the following message in a:`,
      ` | stack trace for following error: error has been thrown in ${name} for /a`,
      ` \\ Failed ${name} in A`,
      ``,
    ];
    const expectedStdout: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("validate output with two steps", async () => {
    const graph = {
      A: { location: "a", dependencies: [] },
    };

    const tracingContext = makeTracingContext();
    const { fn: run } = tracingContext.makeStep({ stdout: "step1 stdout" });
    const { fn: lint } = tracingContext.makeStep({ stdout: "step2 stdout" });

    const globals = getGlobals();

    await createPipeline(graph, globals)
      .addStep({ name: "step1", type: "topological", run })
      .addStep({ name: "step2", type: "topological", run: lint })
      .go();

    const expectedStdout: string[] = [
      " / Done step1 in A",
      " | STDOUT",
      " |  | step1 stdout",
      " \\ Done step1 in A",
      "",
      " / Done step2 in A",
      " | STDOUT",
      " |  | step2 stdout",
      " \\ Done step2 in A",
      "",
    ];
    const expectedStderr: string[] = [];

    globals.validateOuput(expectedStdout, expectedStderr);
  });

  test("the message of the failing step is output at the end", async () => {
    const graph = {
      A: { location: "a", dependencies: ["B"] },
      B: { location: "b", dependencies: [] },
    };

    const run = jest.fn((cwd) => {
      if (cwd === "/a") {
        return Promise.resolve({
          success: true,
          stdout: "step1 stdout",
          stderr: "",
        });
      } else {
        return Promise.resolve({
          success: false,
          stdout: "",
          stderr: "step1 failed",
        });
      }
    });

    const globals = getGlobals(true);

    await createPipeline(graph, globals)
      .addStep({ name: "step1", type: "parallel", run })
      .go();

    const expectedStdout: string[] = [
      " / Done step1 in A",
      " | STDOUT",
      " |  | step1 stdout",
      " \\ Done step1 in A",
      "",
      " / Failed step1 in B",
      " | STDERR",
      " |  | step1 failed",
      " \\ Failed step1 in B",
      "",
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

function getGlobals(stdoutAsStderr: boolean = false): TestingGlobals {
  const _stdout: string[] = [];
  const _stderr: string[] = stdoutAsStderr ? _stdout : [];
  let _exitCode: number = 0;

  return {
    validateOuput(expectedStdout: string[], expectedStderr: string[]): void {
      expect(_stderr.length).toBe(expectedStderr.length);
      expect(_stdout.length).toBe(expectedStdout.length);
      expectedStdout.forEach((m, i) => expect(m).toBe(_stdout[i]));
      expectedStderr.forEach((m, i) => expect(m).toBe(_stderr[i]));
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
    get stdout() {
      return _stdout;
    },
    get stderr() {
      return _stderr;
    },
    get exitCode() {
      return _exitCode;
    },
    errorFormatter(err: Error): string {
      return `stack trace for following error: ${err.message}`;
    },
  };
}

function makeTracingContext() {
  const logs: string[] = [];
  return {
    logs,
    makeStep(options?: {
      throws?: boolean;
      success?: boolean;
      stdout?: string;
      stderr?: string;
    }): {
      fn: () => Promise<Result>;
      name: string;
      started: (cwd: string) => string;
      finished: (cwd: string) => string;
    } {
      const name = Math.random().toString(36);
      const _throws =
        options && typeof options.throws === "boolean" ? options.throws : false;
      const _success =
        options && typeof options.success === "boolean"
          ? options.success
          : true;
      const _stdout =
        options && typeof options.stdout === "string" ? options.stdout : "";
      const _stderr =
        options && typeof options.stderr === "string" ? options.stderr : "";

      const run = jest.fn();
      const messages = {
        started(cwd: string): string {
          return `called ${name} for ${cwd}`;
        },
        finished(cwd: string): string {
          return `finished ${name} for ${cwd}`;
        },
      };
      run.mockImplementation((cwd) => {
        if (_throws) {
          throw new Error(`error has been thrown in ${name} for ${cwd}`);
        }

        logs.push(messages.started(cwd));
        return new Promise<Result>((resolve) => {
          setTimeout(() => {
            logs.push(messages.finished(cwd));
            resolve({ success: _success, stdout: _stdout, stderr: _stderr });
          }, 50);
        });
      });
      return { fn: run, ...messages, name };
    },
  };
}
