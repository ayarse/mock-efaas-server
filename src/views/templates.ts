import { BASE_URL, SESSION_COOKIE } from "../config.ts";
import { settings } from "../store/settings.ts";
import { MOCK_USERS } from "../store/users.ts";

/** Loads home.html. Users, clients and settings are fetched by the page itself. */
export async function loadHomePage(): Promise<string> {
  const template = await Bun.file(`${import.meta.dir}/home.html`).text();
  return template.replace(/__BASE_URL__/g, BASE_URL);
}

const LOGIN_TEMPLATE = await Bun.file(`${import.meta.dir}/login.html`).text();

/** Renders the login page with the current users (they can change at runtime). */
export function renderLoginPage(): string {
  const users = MOCK_USERS.map((u) => ({
    idnumber: u.username || u.idnumber,
    name: [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" "),
    user_type: u.user_type_description,
    gender: u.gender,
  }));
  const password = settings().mockPassword;
  const passwordHint = password
    ? `password <code>${escapeHtml(password)}</code>`
    : "any password works";
  // Escape "<" so user data can't close the inline <script>.
  return LOGIN_TEMPLATE.replace("__PASSWORD_HINT__", passwordHint).replace(
    "__MOCK_USERS__",
    JSON.stringify(users).replace(/</g, "\\u003c"),
  );
}

export function buildFormPostHtml(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const fields = Object.entries(params)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`,
    )
    .join("\n      ");
  return `<!DOCTYPE html>
<html>
<head><title>Redirecting...</title></head>
<body onload="document.forms[0].submit()">
  <noscript><p>JavaScript is required. Please click the button below.</p></noscript>
  <form method="POST" action="${redirectUri}">
      ${fields}
      <noscript><button type="submit">Continue</button></noscript>
  </form>
</body>
</html>`;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ] as string,
  );

function buildMessagePage(title: string, body: string, extra = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>neFaas - ${title}</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;background:#f3f6f5;color:#14213d;}
.card{background:#fff;padding:48px;border-radius:12px;text-align:center;border:1px solid #d8dfe2;border-top:6px solid #12469a;max-width:560px;}
h1{color:#12469A;margin:0 0 8px;font-size:24px;} p{color:#3b4759;line-height:1.5;overflow-wrap:anywhere;}
.notice{color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;text-align:left;}
.home{margin-top:24px;font-size:14px;} a{color:#12469A;text-underline-offset:3px;}
iframe{display:none;}</style></head>
<body><main class="card"><h1>${title}</h1>${body}<p class="home"><a href="/">Open neFaas</a></p></main>${extra}</body>
</html>`;
}

export function buildErrorHtml(message: string): string {
  return buildMessagePage(
    "Error",
    `<p class="notice"><strong>Error:</strong> ${escapeHtml(message)}</p>`,
  );
}

/**
 * Logged-out page. Loads front-channel logout URLs in hidden iframes, then
 * redirects (after they load, or 3s) to the post-logout URI if one is valid.
 * `notice` explains why a requested redirect was refused.
 */
export function buildLoggedOutHtml({
  redirectUrl,
  notice,
  frontChannelUrls = [],
}: {
  redirectUrl?: string;
  notice?: string;
  frontChannelUrls?: string[];
} = {}): string {
  const iframes = frontChannelUrls
    .map(
      (u) =>
        `<iframe src="${escapeHtml(u)}" title="Front-channel logout"></iframe>`,
    )
    .join("");
  const script = redirectUrl
    ? `<script>(function(){var target=${JSON.stringify(redirectUrl).replace(/</g, "\\u003c")};
var frames=document.querySelectorAll("iframe"),left=frames.length;
function go(){location.replace(target);}
if(!left)return go();
frames.forEach(function(f){f.addEventListener("load",function(){if(--left===0)go();});});
setTimeout(go,3000);})();</script>`
    : "";
  const body = redirectUrl
    ? `<p>Redirecting… <a href="${escapeHtml(redirectUrl)}">Continue</a></p>`
    : `<p>You have been successfully logged out of neFaas.</p>${
        notice
          ? `<p class="notice"><strong>Not redirected:</strong> ${escapeHtml(notice)}</p>`
          : ""
      }`;
  return buildMessagePage("Logged Out", body, iframes + script);
}

/**
 * OIDC Session Management check_session iframe. Recomputes session_state from
 * the session cookie and answers the RP's postMessage with changed/unchanged.
 */
export const CHECK_SESSION_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>neFaas check session</title></head><body><script>
function sid(){var m=document.cookie.match(/(?:^|; )${SESSION_COOKIE.replace(".", "\\.")}=([^;]*)/);return m?decodeURIComponent(m[1]):"";}
async function sha256(s){var b=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
return btoa(String.fromCharCode.apply(null,b)).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");}
window.addEventListener("message",async function(e){
  var parts=typeof e.data==="string"?e.data.split(" "):[];
  var state=(parts[1]||"").split(".");
  if(parts.length!==2||state.length!==2){e.source.postMessage("error",e.origin);return;}
  var hash=await sha256(parts[0]+e.origin+sid()+state[1]);
  e.source.postMessage(hash===state[0]?"unchanged":"changed",e.origin);
});
</script></body></html>`;

export const PLACEHOLDER_PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="#e0e7ff" rx="100"/>
  <circle cx="100" cy="75" r="35" fill="#818cf8"/>
  <ellipse cx="100" cy="175" rx="55" ry="45" fill="#818cf8"/>
</svg>`;
