import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { OAuth2Issuer } from "oauth2-mock-server";
import type { AppEnv } from "./config.ts";
import { BASE_URL, HOST, PORT } from "./config.ts";
import { MOCK_USERS } from "./data/users.ts";
import {
  handleAuthorize,
  handleDiscovery,
  handleEndSession,
  handleIntrospect,
  handleJWKS,
  handleLoginPage,
  handleLoginSubmit,
  handleMockClients,
  handleMockHealth,
  handleMockOneTapCodes,
  handleMockUsers,
  handleRevoke,
  handleToken,
  handleUserInfo,
  handleUserPhoto,
} from "./handlers/index.ts";
import { loadHomePage, loadLoginPage } from "./views/index.ts";

// ============ JWT Issuer Setup ============

const issuer = new OAuth2Issuer();
await issuer.keys.generate("RS256");
issuer.url = BASE_URL;

// ============ Pre-load Login Page ============

const HOME_PAGE_HTML = await loadHomePage();
const LOGIN_PAGE_HTML = await loadLoginPage();

// ============ Hono App ============

const app = new Hono<AppEnv>();

app.use("*", cors());

app.use("*", async (c, next) => {
  c.set("issuer", issuer);
  c.set("loginPageHtml", LOGIN_PAGE_HTML);
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

// End session
app.get("/connect/endsession", handleEndSession);

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
app.post("/mock/clients", handleMockClients);

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
    Revocation:   ${BASE_URL}/connect/revocation
    Introspect:   ${BASE_URL}/connect/introspect
    User Photo:   ${BASE_URL}/api/user/photo/:sub
    Login UI:     ${BASE_URL}/efaas/Account/Login

  Mock Admin:
    Health:       ${BASE_URL}/mock/health
    Users:        ${BASE_URL}/mock/users
    One-Tap:      ${BASE_URL}/mock/one-tap-codes  (POST)
    Clients:      ${BASE_URL}/mock/clients         (POST)

  Mock Users:
${MOCK_USERS.map((u) => `    ${u.idnumber.padEnd(12)} ${u.first_name} ${u.last_name} (${u.user_type_description})`).join("\n")}
`);

export default {
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
};
