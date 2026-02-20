## Project

neFaas is a mock eFaas (Maldives National SSO) OIDC server for local development and testing. It is a drop-in replacement for the real eFaas developer environment, following the eFaas specification (see `docs/EFAAS_SPEC_V2.md`) as closely as possible — same endpoints, scopes, claims, and authorization flows.

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- This project uses **Hono** as the web framework on top of Bun. Don't use `express`.
- Use `hono/cors` for CORS middleware. Use Hono's `c.json()`, `c.html()`, `c.redirect()`, `c.body()` for responses.
- Shared state (e.g. `issuer`, `loginPageHtml`) is passed via Hono Variables (`c.set()`/`c.get()`) with `AppEnv` type from `src/config.ts`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Server

Use Hono for routing and `export default` the app. Don't use `vite` or `express`.

```ts#index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

app.get("/api/users/:id", (c) => {
  return c.json({ id: c.req.param("id") });
});

export default {
  port: 8080,
  fetch: app.fetch,
};
```
