# @microsoft/task-scheduler

Run a sequence of steps across all the packages of a monorepo.

# Why

- This tool does not assume any workspace/package manager so it can be used on any JavaScript repository.
- The steps run on the main thread, sparing the cost of spawning one process per step. If parallelization is needed, the implementation of the steps can spawn processes.
- This tool optimizes CI builds performance by avoiding unnecessary waiting (see example below).
- This tool has no dependencies and is very small.
- Its interface makes it easy to compose with other tools to get fancy pipelines (eg. parallelization, profiling, throttling...)
- Running the tasks on the main node process allows for cross-step in-memory memoization

# Usage

```js
const { createPipeline } = require("@microsoft/task-scheduler");

// this graph describes a topological graph
// e.g. {foo: {location: 'packages/foo', dependencies: ['bar']}, bar: { ... }}
const graph = getDependencyGraph();

const pipeline = await createPipeline(graph)
  // defining a task with NO task dependencies
  .addTask({
    name: "prepare",
    run: prepare
  })
  // defining a task with task dependencies as well as the topological deps
  .addTask({
    name: "build",
    run: build,
    deps: ["prepare"],
    topoDeps: ["build"]
  })
  .addTask({
    name: "test",
    run: test,
    deps: ["build"]
  })
  .addTask({
    name: "bundle",
    run: bundle,
    deps: ["build"]
  })
  // you can call go() with no parameters to target everything, or specify which packages or tasks to target
  .go({
    packages: ["foo", "bar"],
    tasks: ["test", "bundle"]
  });

async function prepare(cwd, stdout, stderr) {
...
}

async function build(cwd, stdout, stderr) {
...
}

async function test(cwd, stdout, stderr) {
...
}

async function bundle(cwd, stdout, stderr) {
...
}

```

A `Task` is described by this:

```ts
type Task = {
  /** name of the task */
  name: string;

  /** a function that gets invoked by the task-scheduler */
  run: (cwd: string, stdout: Writable, stderr: Writable) => Promise<boolean>;

  /** dependencies between tasks within the same package (e.g. `build` -> `test`) */
  deps?: string[];

  /** dependencies across packages within the same topological graph (e.g. parent `build` -> child `build`) */
  topoDeps?: string[];

  /** An optional priority for this task. When maxConcurrency is set on a pipeline, unblocked tasks with a higher priority will be scheduled before lower priority tasks. */
  priority?: number;
};
```

Here is how the tasks defined above would run on a repo which has two packages A and B, A depending on B:

```

A:            [-prepare-]         [------build------] [----test----]
                                                      [-----bundle-----]
B: [-prepare-] [------build------] [----test----]
                                   [-----bundle-----]
----------> time
```

Here is how the same workflow would be executed by using lerna:

```

A:            [-prepare-]                   [------build------] [----test----][-----bundle-----]

B: [-prepare-]           [------build------]                    [----test----][-----bundle-----]

----------> time
```

# Contributing

## Development

This repo uses `beachball` for automated releases and semver. Please include a change file by running:

```
$ yarn change
```

## CLA

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
