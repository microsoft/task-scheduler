import { generateTaskGraph } from "../generateTaskGraph";
import { Tasks } from "../types";
import { getPackageTaskFromId } from "../taskId";

function getCanRunTaskInPkg(packageScriptMap: Map<string, string[]>) {
  return function (taskName: string, packageName: string) {
    const scripts = packageScriptMap.get(packageName);
    if (scripts === undefined) {
      return false;
    }

    return scripts.includes(taskName);
  };
}

function CreateTasks() {
  const tasks: Tasks = new Map([
    [
      "build",
      {
        name: "build",
        run: () => Promise.resolve(true),
        deps: [],
        topoDeps: ["build"],
      },
    ],
    [
      "test",
      {
        name: "test",
        run: () => Promise.resolve(true),
        deps: [],
        topoDeps: [],
      },
    ],
    [
      "bundle",
      {
        name: "bundle",
        run: () => Promise.resolve(true),
        deps: ["build"],
        topoDeps: [],
      },
    ],
  ]);

  return tasks;
}

describe("generateTaskGraph", () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  test("targetOnly mode includes only tasks listed in targets array", async () => {
    const scope = ["A", "B"];
    const targets = ["test", "bundle"];

    const tasks = CreateTasks();

    const taskGraph = generateTaskGraph(
      scope,
      targets,
      tasks,
      graph,
      [],
      true,
      (_, __) => true
    );
    expect(taskGraph).toHaveLength(4);

    // None of the "from" taskId should contain "build" task
    expect(
      !taskGraph.find((entry) => getPackageTaskFromId(entry[0])[1] === "build")
    ).toBeTruthy();
  });

  test("Target script not present inside scoped package", async () => {
    const packageScriptMap = new Map<string, string[]>();
    packageScriptMap.set("A", ["test", "bundle"]);
    packageScriptMap.set("B", ["build", "test", "bundle"]);
    const scope = ["A"];
    const targets = ["build"];

    const tasks = CreateTasks();

    const taskGraph = generateTaskGraph(
      scope,
      targets,
      tasks,
      graph,
      [],
      false,
      getCanRunTaskInPkg(packageScriptMap)
    );
    expect(taskGraph).toHaveLength(0);
  });

  test("Target script not present inside scoped package topological dependent package", async () => {
    const packageScriptMap = new Map<string, string[]>();
    packageScriptMap.set("A", ["build", "test", "bundle"]);
    packageScriptMap.set("B", ["test", "bundle"]);
    const scope = ["A"];
    const targets = ["build"];

    const tasks = CreateTasks();

    const taskGraph = generateTaskGraph(
      scope,
      targets,
      tasks,
      graph,
      [],
      false,
      getCanRunTaskInPkg(packageScriptMap)
    );
    expect(taskGraph).toHaveLength(1);
  });

  test("Dependent target script not present inside scoped package", async () => {
    const packageScriptMap = new Map<string, string[]>();
    packageScriptMap.set("A", ["test", "bundle"]);
    packageScriptMap.set("B", ["build", "test", "bundle"]);
    const scope = ["A"];
    const targets = ["bundle"];

    const tasks = CreateTasks();

    const taskGraph = generateTaskGraph(
      scope,
      targets,
      tasks,
      graph,
      [],
      false,
      getCanRunTaskInPkg(packageScriptMap)
    );
    expect(taskGraph).toHaveLength(1);
    expect(getPackageTaskFromId(taskGraph[0][0])[1] === "build").toBeFalsy();
  });

  test("Explicit specified package task dependency does not have target script in package", async () => {
    const packageScriptMap = new Map<string, string[]>();
    packageScriptMap.set("A", ["build", "test", "bundle"]);
    packageScriptMap.set("B", ["test", "bundle"]);
    const scope = ["A"];
    const targets = ["test"];

    const tasks = CreateTasks();

    const taskGraph = generateTaskGraph(
      scope,
      targets,
      tasks,
      graph,
      [["B#build", "A#test"]],
      false,
      getCanRunTaskInPkg(packageScriptMap)
    );
    expect(taskGraph).toHaveLength(1);
  });
});
