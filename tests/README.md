# Test foundation

## Test layers

- `src/**/*.test.ts` and `tests/unit/**/*.test.ts`: unit tests
- `src/**/*.integration.test.ts` and `tests/integration/**/*.test.ts`: integration tests
- `tests/e2e/**/*.spec.ts`: Playwright E2E tests

Integration tests must use `createTestDatabase()`. It applies every committed Prisma migration to a unique temporary SQLite database and removes the database during cleanup, so tests do not share state or depend on execution order.

Factories return complete default inputs. Fixtures compose factories into named scenarios and must return fresh values rather than mutable shared objects.

## Commands

- `pnpm test`: unit and integration tests
- `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`: individual layers
- `pnpm test:customer`, `pnpm test:deal`, `pnpm test:activity`, `pnpm test:auth`, `pnpm test:audit`: path-filtered feature tests
- `pnpm experiment:verify`: lint, type checking, formatting, public tests, E2E, and production build

Put feature tests in a path containing the feature name so the narrow command can select them. For example, Customer tests belong below `src/**/customer/` or `tests/**/customer/`.

## Major-flow coverage

| Flow       | Happy path                                         | Important failure path                                      |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Login      | Every role logs in and logs out                    | Invalid credentials, expired/reused session, audit rollback |
| Customer   | Create, read, edit, search, delete graph           | Owned scope, out-of-scope access, audit rollback            |
| Deal       | Create, read, filter, update                       | Out-of-scope Customer/Deal, invalid stage transition        |
| Activity   | Create, list, update, delete                       | Mismatched Deal, out-of-scope read/update/delete            |
| User admin | Create, change role, disable                       | MEMBER/MANAGER 403, duplicate email, last ADMIN protection  |
| CSV        | Filtered Customer/Deal output and browser download | MEMBER 403, escaping and formula injection                  |
| AuditLog   | ADMIN list, filters and detail                     | MEMBER/MANAGER 403, secret removal, transaction rollback    |

Unit tests cover schema and domain boundaries. Integration tests cross Route Handler, Application Service, and Prisma Repository using an isolated database. E2E tests cover the user-visible critical path and retain API assertions only where authorization or cascading state cannot be observed reliably from the page alone.

## G-B / G-C evaluation scope

G-B uses only the E2E file associated with the task, in addition to its hidden evaluator:

- `GB-F1`: `tests/e2e/deal.spec.ts`
- `GB-I1`: `tests/e2e/customer.spec.ts`

G-C uses the task-specific E2E plus the major regression smoke files:

- `GC-F1`: task-specific `tests/e2e/customer-delete.spec.ts`
- `GC-I1`: task-specific `tests/e2e/audit.spec.ts`
- regression smoke: `tests/e2e/home.spec.ts`, `tests/e2e/customer.spec.ts`, `tests/e2e/deal.spec.ts`

Run a target file directly, for example:

```bash
pnpm exec playwright test tests/e2e/deal.spec.ts
```

The full public E2E suite remains the release regression gate. Hidden evaluator files are managed outside the agent workspace and are not listed here.

## Isolation and timing

- Integration tests receive a newly migrated SQLite database from `createTestDatabase()` and clean it in `finally`; no integration test shares state.
- The Playwright web server resets and seeds its local database once for each command. Mutating E2E scenarios use records they create themselves or mutations that do not alter another scenario's asserted scope.
- The automatic E2E fixture aborts requests whose host is not `127.0.0.1` or `localhost`, so tests cannot depend on external services.
- Playwright reports up to ten files exceeding 5 seconds. Vitest marks unit tests over 1 second and integration tests over 2 seconds as slow. The normal list reporter also prints individual E2E durations.
- Timing targets remain: feature tests 10 seconds, all unit/integration tests 60 seconds, E2E 120 seconds, and build 120 seconds.
