import { afterAll, describe, expect, test } from "bun:test";
import server from "./index.ts";

const BASE = "http://localhost:36445";
const call = async (path: string, init?: RequestInit): Promise<Response> =>
  server.fetch(new Request(`${BASE}${path}`, init));
const form = (
  data: Record<string, string>,
  headers: Record<string, string> = {},
) => ({
  method: "POST",
  body: new URLSearchParams(data),
  headers,
});

const DEFAULT = {
  client_id: "mock-efaas-client",
  redirect_uri: "http://localhost:3000/callback",
};

/** Logs in through the login form and returns the redirect URL and session cookie. */
async function login(params: Record<string, string>, cookie = "") {
  const res = await call(
    "/efaas/Account/Login",
    form(
      { username: "A400011", password: "", response_type: "code", ...params },
      { cookie },
    ),
  );
  const setCookie = res.headers.get("set-cookie");
  return {
    res,
    url: new URL(res.headers.get("location") ?? "http://invalid/"),
    cookie: setCookie ? setCookie.split(";")[0] : cookie,
  };
}

async function tokens(params: Record<string, string>, sessionCookie = "") {
  const { url, cookie } = await login(
    {
      ...DEFAULT,
      scope: "openid efaas.profile efaas.photo offline_access",
      ...params,
    },
    sessionCookie,
  );
  const res = await call(
    "/connect/token",
    form({
      grant_type: "authorization_code",
      code: url.searchParams.get("code") ?? "",
      redirect_uri: params.redirect_uri ?? DEFAULT.redirect_uri,
      client_id: params.client_id ?? DEFAULT.client_id,
      client_secret: "mock-efaas-secret",
    }),
  );
  return { res, body: (await res.json()) as Record<string, string>, cookie };
}

describe("authorization request", () => {
  test("unknown client is accepted in lenient mode", async () => {
    const { url } = await login({
      client_id: "some-unregistered-app",
      redirect_uri: "http://localhost:5173/cb",
    });
    expect(url.searchParams.get("code")).toBeTruthy();
  });

  test("registered client rejects unregistered redirect_uri", async () => {
    const res = await call(
      `/connect/authorize?client_id=mock-efaas-client&redirect_uri=${encodeURIComponent("http://evil.test/cb")}&response_type=code&scope=openid`,
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("not registered");
  });

  test("scope not allowed for client returns invalid_scope", async () => {
    await call("/mock/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "no-offline",
        client_secret: "s",
        redirect_uris: ["http://localhost:4000/cb"],
      }),
    });
    const res = await call(
      "/connect/authorize?client_id=no-offline&redirect_uri=http://localhost:4000/cb&response_type=code&scope=openid%20offline_access&state=xyz",
    );
    const url = new URL(res.headers.get("location") ?? "");
    expect(url.searchParams.get("error")).toBe("invalid_scope");
    expect(url.searchParams.get("state")).toBe("xyz");
  });

  test("non-server-side client must use PKCE", async () => {
    await call("/mock/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "spa",
        client_type: "non_server_side",
        redirect_uris: ["http://localhost:4001/cb"],
      }),
    });
    const res = await call(
      "/connect/authorize?client_id=spa&redirect_uri=http://localhost:4001/cb&response_type=code&scope=openid",
    );
    expect(
      new URL(res.headers.get("location") ?? "").searchParams.get("error"),
    ).toBe("invalid_request");
  });
});

describe("token endpoint", () => {
  test("server-side client must authenticate", async () => {
    const { url } = await login({ ...DEFAULT, scope: "openid" });
    const res = await call(
      "/connect/token",
      form({
        grant_type: "authorization_code",
        code: url.searchParams.get("code") ?? "",
        redirect_uri: DEFAULT.redirect_uri,
        client_id: DEFAULT.client_id,
      }),
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_client",
    );
  });

  test("client_secret_basic works and refresh rotates", async () => {
    const { url } = await login({ ...DEFAULT, scope: "openid offline_access" });
    const basic = `Basic ${btoa("mock-efaas-client:mock-efaas-secret")}`;
    const res = await call(
      "/connect/token",
      form(
        {
          grant_type: "authorization_code",
          code: url.searchParams.get("code") ?? "",
          redirect_uri: DEFAULT.redirect_uri,
        },
        { authorization: basic },
      ),
    );
    const body = (await res.json()) as Record<string, string>;
    expect(res.status).toBe(200);
    const refreshed = await call(
      "/connect/token",
      form(
        {
          grant_type: "refresh_token",
          refresh_token: body.refresh_token ?? "",
        },
        { authorization: basic },
      ),
    );
    expect(refreshed.status).toBe(200);
  });

  test("code cannot be redeemed by another client", async () => {
    const { url } = await login({ ...DEFAULT, scope: "openid" });
    const res = await call(
      "/connect/token",
      form({
        grant_type: "authorization_code",
        code: url.searchParams.get("code") ?? "",
        redirect_uri: DEFAULT.redirect_uri,
        client_id: "someone-else",
      }),
    );
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_grant",
    );
  });
});

describe("userinfo and photo", () => {
  test("accepts access_token, rejects id_token and tampered tokens", async () => {
    const { body } = await tokens({});
    const get = (path: string, token: string) =>
      call(path, { headers: { authorization: `Bearer ${token}` } });

    expect(
      (await get("/connect/userinfo", body.access_token ?? "")).status,
    ).toBe(200);
    expect((await get("/connect/userinfo", body.id_token ?? "")).status).toBe(
      401,
    );
    const [h, p] = (body.access_token ?? "").split(".");
    expect((await get("/connect/userinfo", `${h}.${p}.AAAA`)).status).toBe(401);

    const sub = "21be85ed-951a-4cc9-ac27-16924b4a6136";
    expect((await call(`/api/user/photo/${sub}`)).status).toBe(401);
    expect(
      (await get(`/api/user/photo/${sub}`, body.access_token ?? "")).status,
    ).toBe(200);
  });
});

describe("logout", () => {
  const received: string[] = [];
  const rp = Bun.serve({
    port: 0,
    async fetch(req) {
      received.push(
        ((await req.formData()).get("logout_token") as string) ?? "",
      );
      return new Response("ok");
    },
  });
  afterAll(() => rp.stop());

  test("post_logout_redirect_uri must match exactly", async () => {
    const { body } = await tokens({ scope: "openid" });
    const endsession = (uri: string, hint = body.id_token ?? "") =>
      call(
        `/connect/endsession?id_token_hint=${hint}&post_logout_redirect_uri=${encodeURIComponent(uri)}&state=s1`,
      ).then((r) => r.text());

    expect(await endsession("http://localhost:3000")).toContain(
      "http://localhost:3000/?state=s1",
    );
    expect(await endsession("http://localhost:3000/")).toContain(
      "not registered",
    );
    expect(
      await endsession("http://localhost:3000", body.access_token),
    ).toContain("access_token");
  });

  test("single sign-out notifies every client in the session", async () => {
    await call("/mock/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "bc-app",
        client_secret: "s",
        redirect_uris: ["http://localhost:4002/cb"],
        backchannel_logout_uri: `http://localhost:${rp.port}/logout`,
      }),
    });
    // Log into two apps in the same browser session.
    const first = await login({
      client_id: "bc-app",
      redirect_uri: "http://localhost:4002/cb",
      scope: "openid",
    });
    const second = await tokens({ scope: "openid" }, first.cookie);
    expect(first.url.searchParams.get("session_state")).toBeTruthy();

    // Logging out of the default client signs bc-app out too.
    await call(`/connect/endsession?id_token_hint=${second.body.id_token}`, {
      headers: { cookie: first.cookie ?? "" },
    });
    expect(received).toHaveLength(1);
    const claims = JSON.parse(
      Buffer.from(received[0]?.split(".")[1] ?? "", "base64url").toString(),
    );
    expect(claims.aud).toBe("bc-app");
    expect(Object.keys(claims.events)).toEqual([
      "http://schemas.openid.net/event/backchannel-logout",
    ]);
  });

  test("check_session iframe is served", async () => {
    const res = await call("/connect/checksession");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("postMessage");
  });
});

describe("client management API", () => {
  test("validates, lists and deletes clients", async () => {
    const bad = await call("/mock/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "x",
        client_secret: "s",
        redirect_uris: ["not a url"],
      }),
    });
    expect(bad.status).toBe(400);

    await call("/mock/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "tmp",
        client_secret: "s",
        redirect_uris: ["http://localhost:1/cb"],
      }),
    });
    const list = (await (await call("/mock/clients")).json()) as {
      client_id: string;
      allowed_scopes: string[];
    }[];
    expect(list.find((c) => c.client_id === "tmp")?.allowed_scopes).toEqual([
      "openid",
      "efaas.profile",
    ]);
    expect((await call("/mock/clients/tmp", { method: "DELETE" })).status).toBe(
      204,
    );
    expect((await call("/mock/clients/tmp", { method: "DELETE" })).status).toBe(
      404,
    );
  });
});

describe("users and settings API", () => {
  const json = (method: string, body: unknown) => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  test("creates, validates, logs in and deletes a user", async () => {
    const res = await call(
      "/mock/users",
      json("POST", {
        idnumber: "A999999",
        username: "tester",
        first_name: "Test",
      }),
    );
    const { user } = (await res.json()) as { user: { sub: string } };
    expect(res.status).toBe(201);

    const dup = await call(
      "/mock/users",
      json("POST", { idnumber: "X1", username: "tester", first_name: "Dup" }),
    );
    expect(dup.status).toBe(400);

    // The login form finds users by login name.
    const { url } = await login({
      ...DEFAULT,
      username: "tester",
      scope: "openid efaas.profile",
    });
    const tok = (await (
      await call(
        "/connect/token",
        form({
          grant_type: "authorization_code",
          code: url.searchParams.get("code") ?? "",
          redirect_uri: DEFAULT.redirect_uri,
          client_id: DEFAULT.client_id,
          client_secret: "mock-efaas-secret",
        }),
      )
    ).json()) as { access_token: string };
    const info = (await (
      await call("/connect/userinfo", {
        headers: { authorization: `Bearer ${tok.access_token}` },
      })
    ).json()) as { sub: string };
    expect(info.sub).toBe(user.sub);

    expect(
      (await call(`/mock/users/${user.sub}`, { method: "DELETE" })).status,
    ).toBe(204);
  });

  test("strict mode toggle rejects unknown clients", async () => {
    const authorize = () =>
      call(
        "/connect/authorize?client_id=nobody&redirect_uri=http://x.test/cb&response_type=code&scope=openid",
      );
    expect((await authorize()).status).toBe(302);
    await call("/mock/settings", json("PUT", { strictClients: true }));
    expect((await authorize()).status).toBe(400);
    await call("/mock/settings", json("PUT", { strictClients: false }));
    expect(
      (await call("/mock/settings", json("PUT", { strictClients: "yes" })))
        .status,
    ).toBe(400);
  });
});

test("state survives a restart (users, settings, signing key)", async () => {
  const dir = `${import.meta.dir}/../.nefaas-test-${crypto.randomUUID()}`;
  const port = 36000 + Math.floor(Math.random() * 900);
  const base = `http://localhost:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    STATE_DIR: dir,
    NODE_ENV: "development",
    MOCK_PASSWORD: "",
    STRICT_CLIENTS: "",
  };
  const start = async () => {
    const proc = Bun.spawn(["bun", `${import.meta.dir}/index.ts`], {
      env,
      stdout: "ignore",
      stderr: "ignore",
    });
    for (let i = 0; i < 50; i++) {
      if (
        await fetch(`${base}/mock/health`).then(
          (r) => r.ok,
          () => false,
        )
      )
        return proc;
      await Bun.sleep(100);
    }
    throw new Error("server did not start");
  };
  try {
    let proc = await start();
    await fetch(`${base}/mock/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idnumber: "P1", first_name: "Persisted" }),
    });
    await fetch(`${base}/mock/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ strictClients: true }),
    });
    const jwks = await (
      await fetch(`${base}/.well-known/openid-configuration/jwks`)
    ).text();
    proc.kill();
    await proc.exited;

    proc = await start();
    const users = (await (await fetch(`${base}/mock/users`)).json()) as {
      idnumber: string;
    }[];
    const settings = (await (await fetch(`${base}/mock/settings`)).json()) as {
      settings: { strictClients: boolean };
    };
    expect(users.some((u) => u.idnumber === "P1")).toBe(true);
    expect(settings.settings.strictClients).toBe(true);
    expect(
      await (
        await fetch(`${base}/.well-known/openid-configuration/jwks`)
      ).text(),
    ).toBe(jwks);
    proc.kill();
    await proc.exited;
  } finally {
    await Bun.$`rm -rf ${dir}`;
  }
}, 15000);
