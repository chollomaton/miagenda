# M3A — Explicit local-only store

Base: `feature/1.1-multidevice-certification` at `1c0a8cfb5f775d41fb1275014de338af15ca57f6`, clean before branching. Branch: `feature/1.1-local-only-store`.

API: exported `StoreMode = 'local-only' | 'sync-enabled'`. The third constructor argument selects mode; its default remains `sync-enabled` for compatibility with existing callers. App's own `local-workspace` explicitly selects `local-only`; AgendaSession explicitly selects `sync-enabled` for Firebase.

Local commits, undo/redo, QuickNote autosave and bulk deletion persist entities with empty outbox and undefined cursor. Boot and refresh remove legacy transport data from disk; every persistence attempt normalizes it again, including revision-conflict retries. Existing field-clock merge and scope revision checks preserve concurrent entity edits and quarantine. No database version, entity schema, Backup V2 or Preferences object-store implementation changes.

Local purge still requires `PURGAR`, deleted lifecycle and no surviving references. It rereads disk to catch another tab's restore or references, then uses one atomic save for removal. A write between that read and save aborts without deleting anything; retrying requires fresh validation. History clears only after successful purge. Existing sync-enabled ACK/outbox protection remains.

Mixed 1.0/1.1 tabs: 1.0 still writes entities and remote outbox/cursor. The next 1.1 boot, refresh or persistence removes that transport state while preserving changes using the existing clock/revision protocol. This does not modify the running 1.0 tab: its queue can exist on disk until 1.1 acts again. No new listeners or background cleanup. Certification uses independent IndexedDB connections and an existing-mode store as the 1.0 writer; it does not run two historical browser binaries.

Additional scope-related hardening: local purge validates current disk references and restored lifecycle, aborts on a write after validation, and does not populate memory with invalid raw entities. No unrelated bugs or features changed.

Validation: 24 M3A tests (21 store tests and 3 UI tests). Includes 100 queued edits, actual QuickNote UI autosave, reopen, deleteCompleted, trash/purge, undo/redo, references and restore races, atomic abort, independent tabs, mixed-version conflicts, boot/refresh legacy cleanup, session invalidation during cleanup, Firebase scope isolation, sync-enabled ACK, backup entity equality, templates, scheduling, lifecycle and quarantine.

Complete suite: 546 tests across 31 files. Includes core, IndexedDB, stale persistence, atomic rollback, smoke, backups, M1 migration, M2 multidevice, session isolation, Firebase runtime, sync, templates, Time Blocking and PWA. Typecheck, lint, security scan and build also checked. The first unrestricted parallel suite hit one existing UI test's 15-second timeout; repeating with two workers passed. No timeouts or sleeps were changed. Security: 71 files, zero findings. Build reports a chunk-size advisory for the Firebase bundle.

The shell has no npm executable; verification invokes the installed TypeScript, ESLint, Vitest, security script, Vite and build-shell script with the bundled Node runtime. These cover every stage of package.json's check/build scripts without changing scripts or dependencies.

No push, production access, deploy, tag, release, version bump, rules or billing changes. Main remains at `98b13c67c6004b93f8389413565421d4deb7b7c4`. Work stops after M3A.
