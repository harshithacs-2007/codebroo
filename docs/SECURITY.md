# CodeBroo Production Security

## Security boundary

Learner Java is untrusted input. Source filtering is a defense-in-depth layer, not the security boundary.

The public application must not execute arbitrary learner code in the same trust boundary as:
- application secrets;
- database credentials;
- the public API process;
- internal service credentials;
- deployment control sockets.

The production architecture should be:

`Browser -> API -> durable job queue -> isolated executor worker -> result`

The executor worker should run each job with:
- no outbound network access;
- a non-root identity;
- a read-only base filesystem where practical;
- a private temporary working directory;
- bounded CPU and memory;
- bounded process/thread count;
- hard wall-clock and output limits;
- a restrictive syscall profile;
- no host/container management socket;
- short-lived job cleanup.

Docker documents CPU/memory limits and seccomp as mechanisms for constraining container resources and system calls. They should be applied to the executor boundary rather than assumed from the JVM timeout alone.

## Current branch hardening

This branch adds:
- bounded learner source size using UTF-8 byte length;
- stricter source-policy checks against file I/O, networking, reflection, process APIs, dynamic loading and host probing;
- sanitized child-process environment;
- per-run private working directory;
- bounded execution concurrency and pending queue;
- bounded per-session run tracking;
- signed learner-session expiry;
- strict JSON object validation;
- generic 500 responses instead of exposing backend exceptions;
- SQLite WAL/busy-timeout settings and attempt retention;
- persistent study-buddy selection.

## Known limitation

The existing JDI/child-JVM design is still **not a complete hostile-code sandbox** by itself. The production executor must be isolated at the operating-system/container/VM layer before the service is opened to arbitrary public users.

Do not treat a source denylist as sufficient isolation. OWASP recommends allowlisting and server-side validation, while warning that denylists are bypassable.

## Availability model

No software can guarantee zero crashes for an unlimited number of users.

CodeBroo should fail in bounded ways:
- the executor queue has a hard ceiling;
- overloaded execution returns 503 instead of growing memory without bound;
- API requests have body limits and timeouts;
- execution jobs have CPU/memory/output/step ceilings;
- application and execution workloads can be scaled independently;
- durable state should move from local SQLite to a managed PostgreSQL-compatible database before horizontal scaling.

## Launch gates

Do not call the public executor production-ready until:
1. hostile-code sandbox escape tests pass;
2. dependency/SAST/secret scanning is clean;
3. load tests cover API traffic and concurrent executions;
4. database migrations and backups are tested;
5. rate limiting is distributed or enforced at the edge;
6. the executor is separately deployable and independently scalable;
7. an incident/runbook path exists for executor compromise, data exposure and abuse;
8. privacy, terms, acceptable-use and AI disclosures are published.
