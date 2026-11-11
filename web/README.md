# web — the Next.js app

Season management and the HQ Admin pages (Survey Builder, Survey Workflow, Tasks, Task planning, Phone simulator,
Masters). See the repository's [README](../README.md) for the pages, the orchestration engine, environment variables
and deployment.

```bash
npm install
npx next dev -p 3100
```

Tests for the orchestration engine, jobs and road routes:

```bash
node --test src/lib/orchestration/*.test.ts
```
