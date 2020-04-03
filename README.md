# @microsoft/task-scheduler

Run a sequence of steps across all the packages of a monorepo.

# Why

- This tool does not assume any workspace/package manager so it can be used on any JavaScript repository.
- The steps run on the main thread, sparing the cost of spawning one process per step. If parallelization is needed, the implementation of the steps can spawn processes.
- This tools optimizes CI builds performance by avoiding unnecessary waiting (see example below).
- This tools has no dependencies and is very small.
- Its interface makes it easy to compose with other tools to get fancy pipelines (eg. parallelization, profiling, throttling...)

# Usage

```js
const { createPipeline } = require("@microsoft/task-scheduler");

const graph = getDependencyGraph();

// Defines a 3-steps pipeline.
await createPipeline(graph)
  .addTopologicalStep({
    name: "prepare",
    run: prepare,
  })
  .addTopologicalStep({
    name: "build",
    run: build,
  })
  .addParallelStep({
    name: "test",
    run: test,
  })
  .go();

async function prepare(cwd) {
...
}

async function build(cwd) {
...
}

async function test(cwd) {
...
}

```


Here is how the tasks defined above would run on a repo which has two packages A and B, A depending on B:
```

A:            [-prepare-]         [------build------] [----test----]

B: [-prepare-] [------build------] [----test----]

----------> time
```

Here is how the same workflow would be executed by using lerna:
```

A:            [-prepare-]                   [------build------] [----test----]

B: [-prepare-]           [------build------]                    [----test----]

----------> time
```

# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
