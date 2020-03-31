import { createPipeline } from ".";

let spy: jest.SpyInstance | undefined = undefined;

beforeAll(() => {
  spy = jest.spyOn(process, "cwd");
  spy.mockReturnValue("/");
});

afterAll(() => {
  spy && spy.mockClear();
});

test("testInOrder", async () => {
  const graph = {
    A: { location: "a", dependencies: ["B"] },
    B: { location: "b", dependencies: [] },
  };

  const run = jest.fn((_cwd) => {
    return Promise.resolve({ success: true, stdout: "", stderr: "" });
  });

  await createPipeline(graph)
    .addStep({ name: "step1", type: "topological", run })
    .go();

  expect(run).toHaveBeenCalledTimes(2);
  expect(run).toHaveBeenNthCalledWith(1, "/b");
  expect(run).toHaveBeenNthCalledWith(2, "/a");
});
