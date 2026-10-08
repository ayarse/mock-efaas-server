import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { OAuth2Issuer } from "oauth2-mock-server";
import type { AppEnv } from "./config.ts";
import { BASE_URL, HOST, PORT } from "./config.ts";
import {
  handleAuthorize,
  handleCheckSession,
  handleDiscovery,
  handleEndSession,
  handleIntrospect,
  handleJWKS,
  handleLoginPage,
  handleLoginSubmit,
  handleMockClients,
  handleMockDeleteClient,
  handleMockDeleteUser,
  handleMockGetSettings,
  handleMockHealth,
  handleMockListClients,
  handleMockOneTapCodes,
  handleMockReset,
  handleMockSaveUser,
  handleMockUpdateSettings,
  handleMockUsers,
  handleRevoke,
  handleToken,
  handleUserInfo,
  handleUserPhoto,
} from "./handlers/index.ts";
import { clients } from "./store/clients.ts";
import { initState, STATE_FILE } from "./store/state.ts";
import { MOCK_USERS } from "./store/users.ts";
import { loadHomePage } from "./views/index.ts";

// ============ JWT Issuer Setup ============

const issuer = new OAuth2Issuer();
issuer.url = BASE_URL;
await initState(issuer);

// ============ Pre-load Home Page ============

const HOME_PAGE_HTML = await loadHomePage();

// ============ Hono App ============

const app = new Hono<AppEnv>();

app.use("*", cors());

app.use("*", async (c, next) => {
  c.set("issuer", issuer);
  await next();
});

// Static files
app.use("/assets/*", serveStatic({ root: "./" }));

// Home page
app.get("/", (c) => c.html(HOME_PAGE_HTML));

// OIDC Discovery
app.get("/.well-known/openid-configuration", handleDiscovery);
app.get("/.well-known/openid-configuration/jwks", handleJWKS);

// Authorization flow
app.get("/connect/authorize", handleAuthorize);

// Login page
app.get("/efaas/Account/Login", handleLoginPage);
app.post("/efaas/Account/Login", handleLoginSubmit);

// Token endpoint
app.post("/connect/token", handleToken);

// UserInfo
app.get("/connect/userinfo", handleUserInfo);

// End session + check_session iframe (OIDC Session Management)
app.get("/connect/endsession", handleEndSession);
app.get("/connect/checksession", handleCheckSession);

// Token revocation (V2 spec path)
app.post("/connect/revocation", handleRevoke);

// Token introspection
app.post("/connect/introspect", handleIntrospect);

// User photo (V2 spec path with :sub param)
app.get("/api/user/photo/:sub", handleUserPhoto);

// Mock admin routes
app.get("/mock/health", handleMockHealth);
app.get("/mock/users", handleMockUsers);
app.post("/mock/one-tap-codes", handleMockOneTapCodes);
app.get("/mock/clients", handleMockListClients);
app.post("/mock/clients", handleMockClients);
app.delete("/mock/clients/:id", handleMockDeleteClient);
app.post("/mock/users", handleMockSaveUser);
app.delete("/mock/users/:sub", handleMockDeleteUser);
app.get("/mock/settings", handleMockGetSettings);
app.put("/mock/settings", handleMockUpdateSettings);
app.post("/mock/reset", handleMockReset);

// ============ Export Server ============

console.log(`
  neFaas Mock OIDC Server running at ${BASE_URL}

  Endpoints:
    Discovery:    ${BASE_URL}/.well-known/openid-configuration
    JWKS:         ${BASE_URL}/.well-known/openid-configuration/jwks
    Authorize:    ${BASE_URL}/connect/authorize
    Token:        ${BASE_URL}/connect/token
    UserInfo:     ${BASE_URL}/connect/userinfo
    EndSession:   ${BASE_URL}/connect/endsession
    CheckSession: ${BASE_URL}/connect/checksession
    Revocation:   ${BASE_URL}/connect/revocation
    Introspect:   ${BASE_URL}/connect/introspect
    User Photo:   ${BASE_URL}/api/user/photo/:sub
    Login UI:     ${BASE_URL}/efaas/Account/Login

  Manage clients, users and settings: ${BASE_URL}
  ${MOCK_USERS.length} users, ${clients.size} client(s). ${STATE_FILE ? `Saved to ${STATE_FILE}` : "Not saved (STATE_DIR is empty)"}
`);

export default {
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
};
