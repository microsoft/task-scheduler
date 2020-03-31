import { createPipeline, Result, Globals } from ".";
import { EOL } from "os";

type TestingGlobals = Globals & {
  stdout: string[];
  stderr: string[];
  exitCode: number;
};

function getGlobalsWithOnlyOneConsoleStream(): TestingGlobals {
  const _stdout: string[] = [];
  let _exitCode: number = 0;

  return {
    logger: {
      log(message: string): void {
        message.split(EOL).forEach((m) => _stdout.push(m));
      },
      error(message: string): void {
        message.split(EOL).forEach((m) => _stdout.push(m));
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
      return _stdout;
    },
    get exitCode() {
      return _exitCode;
    },
  };
}
function getGlobals(): TestingGlobals {
  const _stdout: string[] = [];
  const _stderr: string[] = [];
  let _exitCode: number = 0;

  return {
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
  };
}

test("testInOrder", async () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  const run = jest.fn((_cwd) => {
    return Promise.resolve({ success: true, stdout: "", stderr: "" });
  });

  await createPipeline(graph, getGlobals())
    .addStep({ name: "step1", type: "topological", run })
    .go();

  expect(run).toHaveBeenCalledTimes(2);
  expect(run).toHaveBeenNthCalledWith(1, "/b");
  expect(run).toHaveBeenNthCalledWith(2, "/a");
});

test("tological steps wait for dependencies to be done", async () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  const run = jest.fn();

  const logs: string[] = [];

  run.mockImplementation((cwd) => {
    logs.push(`called run for ${cwd}`);
    return new Promise<Result>((resolve) => {
      setTimeout(() => {
        logs.push(`finished run for ${cwd}`);
        resolve({ success: true, stdout: "", stderr: "" });
      }, 10);
    });
  });

  await createPipeline(graph, getGlobals())
    .addStep({ name: "step1", type: "topological", run })
    .go();

  const expected = [
    "called run for /b",
    "finished run for /b",
    "called run for /a",
    "finished run for /a",
  ];

  expected.forEach((e, i) => expect(e).toBe(logs[i]));
});

test("parallel steps dont wait for dependencies to be done", async () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  const run = jest.fn();

  const logs: string[] = [];

  run.mockImplementation((cwd) => {
    logs.push(`called run for ${cwd}`);
    return new Promise<Result>((resolve) => {
      setTimeout(() => {
        logs.push(`finished run for ${cwd}`);
        resolve({ success: true, stdout: "", stderr: "" });
      }, 10);
    });
  });

  await createPipeline(graph, getGlobals())
    .addStep({ name: "step1", type: "parallel", run })
    .go();

  const expected = [
    "called run for /b",
    "called run for /a",
    "finished run for /b",
    "finished run for /a",
  ];

  expected.forEach((e, i) => expect(e).toBe(logs[i]));
});

test("tological steps wait for the previous step", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();
  const lint = jest.fn();

  const logs: string[] = [];

  run.mockImplementation((cwd) => {
    logs.push(`called run for ${cwd}`);
    return new Promise<Result>((resolve) => {
      setTimeout(() => {
        logs.push(`finished run for ${cwd}`);
        resolve({ success: true, stdout: "", stderr: "" });
      }, 10);
    });
  });

  lint.mockImplementation((cwd) => {
    logs.push(`called lint for ${cwd}`);
    return new Promise<Result>((resolve) => {
      setTimeout(() => {
        logs.push(`finished lint for ${cwd}`);
        resolve({ success: true, stdout: "", stderr: "" });
      }, 10);
    });
  });

  await createPipeline(graph, getGlobals())
    .addStep({ name: "step1", type: "parallel", run })
    .addStep({ name: "step2", type: "topological", run: lint })
    .go();

  const expected = [
    "called run for /a",
    "finished run for /a",
    "called lint for /a",
    "finished lint for /a",
  ];

  expected.forEach((e, i) => expect(e).toBe(logs[i]));
});

test("parallel steps wait for the previous step", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();
  const lint = jest.fn();

  const logs: string[] = [];

  run.mockImplementation((cwd) => {
    logs.push(`called run for ${cwd}`);
    return new Promise<Result>((resolve) => {
      setTimeout(() => {
        logs.push(`finished run for ${cwd}`);
        resolve({ success: true, stdout: "", stderr: "" });
      }, 10);
    });
  });

  lint.mockImplementation((cwd) => {
    logs.push(`called lint for ${cwd}`);
    return new Promise<Result>((resolve) => {
      setTimeout(() => {
        logs.push(`finished lint for ${cwd}`);
        resolve({ success: true, stdout: "", stderr: "" });
      }, 10);
    });
  });

  await createPipeline(graph, getGlobals())
    .addStep({ name: "step1", type: "parallel", run })
    .addStep({ name: "step2", type: "parallel", run: lint })
    .go();

  const expected = [
    "called run for /a",
    "finished run for /a",
    "called lint for /a",
    "finished lint for /a",
  ];

  expected.forEach((e, i) => expect(e).toBe(logs[i]));
});

test("a failing step fails the entire process", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();

  run.mockImplementation((cwd) => {
    throw new Error("failing");
  });

  const globals = getGlobals();
  await createPipeline(graph, globals)
    .addStep({ name: "step1", type: "parallel", run })
    .go();

  expect(globals.exitCode).toBe(1);
});

test("validating step output", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();

  run.mockImplementation((_cwd) => {
    return Promise.resolve({
      success: true,
      stdout: "step stdout",
      stderr: "step stderr",
    });
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

  expect(globals.stderr.length).toBe(expectedStderr.length);
  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
  expectedStderr.forEach((m, i) => expect(m).toBe(globals.stderr[i]));
});

test("validating step output with nothing written to console", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();

  run.mockImplementation((_cwd) => {
    return Promise.resolve({
      success: true,
      stdout: "",
      stderr: "",
    });
  });

  const globals = getGlobals();
  await createPipeline(graph, globals)
    .addStep({ name: "step1", type: "parallel", run })
    .go();

  const expectedStdout: string[] = ["Done step1 in A", ""];
  const expectedStderr: string[] = [];

  expect(globals.stderr.length).toBe(expectedStderr.length);
  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
  expectedStderr.forEach((m, i) => expect(m).toBe(globals.stderr[i]));
});

test("validating failing step output with nothing written to console", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();

  run.mockImplementation((_cwd) => {
    return Promise.resolve({
      success: true,
      stdout: "",
      stderr: "",
    });
  });

  const globals = getGlobals();
  await createPipeline(graph, globals)
    .addStep({ name: "step1", type: "parallel", run })
    .go();

  const expectedStdout: string[] = ["Done step1 in A", ""];
  const expectedStderr: string[] = [];

  expect(globals.stderr.length).toBe(expectedStderr.length);
  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
  expectedStderr.forEach((m, i) => expect(m).toBe(globals.stderr[i]));
});

test("validating throwing step output", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();

  run.mockImplementation((_cwd) => {
    throw new Error("it failed");
  });

  const globals = getGlobals();
  await createPipeline(graph, globals)
    .addStep({ name: "step1", type: "parallel", run })
    .go();

  const expectedStderr: string[] = [
    " / Failed step1 in A",
    " | task-scheduler: the step step1 failed with the following message in a:",
    " | it failed",
    " \\ Failed step1 in A",
    "",
  ];
  const expectedStdout: string[] = [];

  expect(globals.stderr.length).toBe(expectedStderr.length);
  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
  expectedStderr.forEach((m, i) => expect(m).toBe(globals.stderr[i]));
});

test("validating failing step output", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn();

  run.mockImplementation((_cwd) => {
    return Promise.resolve({
      success: false,
      stdout: "",
      stderr: "",
    });
  });

  const globals = getGlobals();
  await createPipeline(graph, globals)
    .addStep({ name: "step1", type: "parallel", run })
    .go();

  const expectedStderr: string[] = ["Failed step1 in A", ""];
  const expectedStdout: string[] = [];

  expect(globals.stderr.length).toBe(expectedStderr.length);
  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
  expectedStderr.forEach((m, i) => expect(m).toBe(globals.stderr[i]));
});

test("the second step is not run if the first one fails", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn((_cwd) => {
    return Promise.resolve({ success: false, stdout: "", stderr: "" });
  });
  const lint = jest.fn((_cwd) => {
    return Promise.resolve({ success: true, stdout: "", stderr: "" });
  });

  await createPipeline(graph, getGlobals())
    .addStep({ name: "step1", type: "topological", run })
    .addStep({ name: "step2", type: "topological", run: lint })
    .go();

  expect(lint).toHaveBeenCalledTimes(0);
});

test("validate output with two steps", async () => {
  const graph = {
    A: { location: "a", dependencies: [] },
  };

  const run = jest.fn((_cwd) => {
    return Promise.resolve({
      success: true,
      stdout: "step1 stdout",
      stderr: "",
    });
  });
  const lint = jest.fn((_cwd) => {
    return Promise.resolve({
      success: true,
      stdout: "step2 stdout",
      stderr: "",
    });
  });

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

  expect(globals.stderr.length).toBe(expectedStderr.length);
  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
  expectedStderr.forEach((m, i) => expect(m).toBe(globals.stderr[i]));
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

  const globals = getGlobalsWithOnlyOneConsoleStream();

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

  expect(globals.stdout.length).toBe(expectedStdout.length);
  expectedStdout.forEach((m, i) => expect(m).toBe(globals.stdout[i]));
});
