# Change Log - @microsoft/task-scheduler

This log was last generated on Thu, 22 Oct 2020 20:03:00 GMT and should not be manually modified.

<!-- Start content -->

## 2.7.0

Thu, 22 Oct 2020 20:03:00 GMT

### Minor changes

- adds ability to continue task-scheduler even when one task has failed (kchau@microsoft.com)

## 2.6.5

Thu, 22 Oct 2020 15:35:51 GMT

### Patches

- build: Remove bundling (olwheele@microsoft.com)

## 2.6.4

Mon, 05 Oct 2020 19:11:43 GMT

### Patches

- bump pgraph (kchau@microsoft.com)

## 2.6.3

Mon, 05 Oct 2020 18:42:30 GMT

### Patches

- Add error message for missing pipeline config (elcraig@microsoft.com)

## 2.6.2

Wed, 26 Aug 2020 20:33:37 GMT

### Patches

- make sure no-deps case is actually covered (kchau@microsoft.com)

## 2.6.1

Sun, 16 Aug 2020 16:27:52 GMT

### Patches

- using a different delimiter to make it not conflict with lots of build scripts out there (kchau@microsoft.com)

## 2.6.0

Fri, 14 Aug 2020 18:35:13 GMT

### Minor changes

- Adds the ability to add an individual package task dependency (kchau@microsoft.com)

## 2.5.0

Thu, 13 Aug 2020 17:04:57 GMT

### Minor changes

- exposes generateTaskGraph as well so it can be used as a separate library util to examine the task graph (kchau@microsoft.com)

## 2.4.0

Wed, 15 Jul 2020 14:37:22 GMT

### Minor changes

- Change priority API to be package specific (1581488+christiango@users.noreply.github.com)

## 2.3.0

Tue, 14 Jul 2020 22:29:27 GMT

### Minor changes

- Upgrade to latest p-graph and add support for task prioritization and maximum concurrency limiting (1581488+christiango@users.noreply.github.com)

## 2.2.0

Mon, 13 Jul 2020 22:28:02 GMT

### Minor changes

- adds a targets only mode (kchau@microsoft.com)

## 2.1.3

Wed, 17 Jun 2020 15:56:12 GMT

### Patches

- adding public access since this is microsoft scoped; fix graph generation (kchau@microsoft.com)

## 2.1.2

Fri, 05 Jun 2020 16:18:43 GMT

### Patches

- restore the webpacked output (kchau@microsoft.com)

## 2.1.1

Fri, 05 Jun 2020 16:06:20 GMT

### Patches

- fixes npmignore to include all the lib files (kchau@microsoft.com)

## 2.1.0

Fri, 05 Jun 2020 15:53:52 GMT

### Minor changes

- adding an override for exit() so consumers can handle the exits (kchau@microsoft.com)

## 2.0.2

Wed, 03 Jun 2020 23:26:58 GMT

### Patches

- allow override of logger in task-scheduler (kchau@microsoft.com)

## 2.0.1

Wed, 03 Jun 2020 20:49:24 GMT

### Patches

- adding beachball for releases and also adding an arg to the task run function to give more info to the consumers (kchau@microsoft.com)
