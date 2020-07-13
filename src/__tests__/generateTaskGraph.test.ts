import { generateTaskGraph } from "../generateTaskGraph";
import { Tasks } from "../types";
import { getPackageTaskFromId } from "../taskId";

describe("generateTaskGraph", () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  test("targetOnly mode includes only tasks listed in targets array", async () => {
    const scope = ["A", "B"];
    const targets = ["test", "bundle"];
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

    const taskGraph = generateTaskGraph(scope, targets, tasks, graph, true);
    expect(taskGraph).toHaveLength(4);

    // None of the "from" taskId should contain "build" task
    expect(
      !taskGraph.find((entry) => getPackageTaskFromId(entry[0])[1] === "build")
    ).toBeTruthy();
  });
});
