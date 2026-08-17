# CodeBroo

**Don't memorize. Get it.**

Interactive Java lab. First lesson: references — *The Two Remote Controls*.

## What this is

A learning workspace with a real JDK behind it. Learner Java is compiled with `javac`, run in a child JVM, and inspected with the Java Debug Interface so the heap picture is actual runtime state — not a fake interpreter.

## Requirements

- Node.js 22+
- JDK 21+ (`java` and `javac` on PATH)

## Dev

```bash
npm install
npm run dev
```

UI: http://127.0.0.1:5173  
API: http://127.0.0.1:8787

Copy `.env.example` to `.env` and set `CODEBROO_SECRET` before any shared deployment.

## Production (single process)

```bash
npm run build
set CODEBROO_SECRET=a-long-random-value
set NODE_ENV=production
npm start
```

Serves the web bundle and API together on port 8787.

Container (Linux; isolate with `--network=none` in front of untrusted runs if you wrap the JVM):

```bash
docker build -t codebroo .
docker run --rm -p 8787:8787 -e CODEBROO_SECRET=... codebroo
```

## Isolation (honest)

Learner code never runs inside the Node process. The supervisor (`BrooExecutor`) launches a debuggee JVM with memory caps, a step cap, a wall-clock timeout, output caps, a private temp directory, and a source denylist. There is no Docker on the default Windows dev machine; this is process isolation plus resource limits, not a gVisor jail. Production should run the executor host with no network and least privilege.

## Tests

```bash
npm test
npm run test:executor
```
