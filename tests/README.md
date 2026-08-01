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
