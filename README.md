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

## Security (honest)

Learner code is untrusted. The Node API does not execute learner Java in-process; `BrooExecutor` launches a child JVM and the service applies source limits, a wall-clock timeout, memory/stack caps, output limits, step limits, a private working directory, a sanitized child environment, and a source-policy layer.

That still is **not a complete hostile-code sandbox**. A denylist can be bypassed and JVM process isolation is not equivalent to a VM/container security boundary. Public production must put the executor behind a separate isolation boundary with network egress disabled, least privilege, syscall restrictions and hard CPU/memory/process limits. See [docs/SECURITY.md](docs/SECURITY.md).

## Scaling model

The current SQLite deployment is a single-instance MVP. Before horizontal scaling, move durable learner state to managed PostgreSQL-compatible storage and move code execution to a separately deployable worker pool behind a durable queue. The worker pool should scale independently from the web/API tier.

Overload must be bounded: reject new execution jobs with 503 rather than allowing an unbounded in-memory queue to consume the host.

## Legal / IP

CodeBroo should use original product artwork, copy and lesson content and keep third-party license/attribution records. Do not copy the distinctive visual identity, artwork or branding of other learning products. Before commercial launch, perform formal trademark clearance for “CodeBroo” and related marks and have Terms, Privacy and Acceptable Use policies reviewed for the jurisdictions served. See [docs/LEGAL_LAUNCH.md](docs/LEGAL_LAUNCH.md).

## Tests

```bash
npm test
npm run test:executor
```
