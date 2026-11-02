/**
 * Google OAuth: getting a token and keeping it valid. The core (authUrl,
 * exchangeCode, accessToken, revoke) is plain fetch, reusable by a web route;
 * `connectViaLoopback` is the CLI-only adapter. No `googleapis` dependency.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { load, NotConnectedError, save, saveAccessToken } from "./store";

export { NotConnectedError } from "./store";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

/**
 * Requested scopes, and nothing more.
 *
 * `drive`, not `drive.file`: the workspace is mostly filled by the artist,
 * and `drive.file` only sees files this app created. Code still limits each
 * department to the folders its AGENT.md `drive:` line names.
 *
 * `spreadsheets`: the credits sheet needs several tabs in one file, which
 * Drive's CSV conversion cannot make (see sheets.ts).
 *
 * No Slides scope: decks are PPTX converted by Drive. No Gmail scope here:
 * `gmail.compose` is restricted, so gmail.ts opens a prefilled compose window.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

/**
 * Not in SCOPES on purpose. Requested only by `houselabel voice learn --gmail`
 * (incremental consent) to read sent mail; no department tool uses it.
 * Restricted scope: self-hosted Desktop clients only.
 */
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/**
 * Requested only by `houselabel recap --send`, which mails the recap to the
 * artist's own address. No department tool uses it. Restricted, like above.
 */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export interface OAuthApp {
  clientId: string;
  clientSecret: string;
}

/** The artist's own OAuth client. No shipped default: a public secret gets revoked. */
/**
 * The client from `~/.houselabel/config.json`, where `connect` saves it. Read
 * each time, not cached: `connect` may write it mid-session.
 */
function clientFromConfig(): { clientId?: string; clientSecret?: string } {
  try {
    const raw = readFileSync(join(homedir(), ".houselabel", "config.json"), "utf8");
    return (JSON.parse(raw) as { google?: { clientId?: string; clientSecret?: string } }).google ?? {};
  } catch {
    return {};
  }
}

/**
 * An env value that is really set. An empty or `...` placeholder copied from
 * `.env.example` must not shadow the client in config.json.
 */
export function envValue(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && !/^\.{2,}$/.test(v) && !/^<.*>$/.test(v) ? v : undefined;
}

export function oauthApp(): OAuthApp {
  // Env wins (hosted service); the config file is the self-hosted fallback.
  const saved = clientFromConfig();
  const clientId = envValue("GOOGLE_CLIENT_ID") || saved.clientId;
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET") || saved.clientSecret;
  if (!clientId || !clientSecret)
    throw new Error(
      "No Google client on this machine yet.\n" +
        "  Run `houselabel connect google`: it walks you through making one (~8 min).",
    );
  return { clientId, clientSecret };
}

/** True when the artist could connect if they wanted to. */
export const isConfigured = (): boolean => {
  const saved = clientFromConfig();
  return !!((envValue("GOOGLE_CLIENT_ID") || saved.clientId) && (envValue("GOOGLE_CLIENT_SECRET") || saved.clientSecret));
};

export function authUrl(
  redirectUri: string,
  state: string,
  app: OAuthApp = oauthApp(),
  scopes: readonly string[] = SCOPES,
): string {
  const params = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    // offline + consent: without both, a reconnect returns no refresh token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      `Google refused the token request: ${json.error ?? res.status}` +
        (json.error_description ? ` — ${json.error_description}` : ""),
    );
  return {
    accessToken: String(json.access_token),
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    expiresAt: new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000),
    scopes: String(json.scope ?? "").split(/\s+/).filter(Boolean),
  };
}

/** Trade an authorization code for tokens. Used by the CLI loopback and a hosted callback. */
export async function exchangeCode(code: string, redirectUri: string, app: OAuthApp = oauthApp()) {
  return tokenRequest({
    code,
    client_id: app.clientId,
    client_secret: app.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

/** Whose account this is, shown at connect time to confirm the right one. */
export async function whoAmI(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return ((await res.json()) as { email?: string }).email ?? null;
}

/**
 * A valid access token, refreshed within five minutes of expiry so a long
 * upload does not outlive it.
 */
export async function accessToken(): Promise<string> {
  const conn = await load();
  if (!conn) throw new NotConnectedError();

  if (conn.expiresAt.getTime() - Date.now() > 5 * 60 * 1000) return conn.accessToken;

  const app = oauthApp();
  const refreshed = await tokenRequest({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    refresh_token: conn.refreshToken,
    grant_type: "refresh_token",
  }).catch((err: Error) => {
    // invalid_grant: access revoked or refresh token rotated. Explain and say how to fix.
    if (/invalid_grant/i.test(err.message))
      throw new NotConnectedError(
        "Google has revoked this connection. Run `houselabel connect google` to link it again.",
      );
    throw err;
  });

  await saveAccessToken(refreshed.accessToken, refreshed.expiresAt);
  return refreshed.accessToken;
}

/** Revoke remotely (best-effort), then always delete the local token row. */
export async function revoke(refreshToken: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  }).catch(() => {});
}

// ── the CLI adapter ────────────────────────────────────────────────────────

export interface LoopbackResult {
  accountEmail: string | null;
  scopes: string[];
}

/**
 * The terminal's consent flow: listen on a loopback port, print the URL, wait.
 * The port is OS-assigned, so the redirect URI is computed here. `state` is a
 * random nonce compared in constant time.
 */
export async function connectViaLoopback(opts: {
  /** Called with the consent URL once the listener is up. */
  onUrl: (url: string) => void;
  timeoutMs?: number;
  /** Default SCOPES. `voice learn` adds GMAIL_READONLY_SCOPE, and nothing else does. */
  scopes?: readonly string[];
}): Promise<LoopbackResult> {
  const app = oauthApp();
  const nonce = randomBytes(24).toString("base64url");

  // Captured at listen time, not read back at callback time: `server.close()`
  // clears the address, so asking for the port after closing returns null.
  let redirectUri = "";

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const done = (status: number, title: string, detail: string) => {
        res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
        res.end(page(title, detail));
      };

      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";

      if (error) {
        done(400, "Not connected", `Google returned: ${escapeHtml(error)}`);
        server.close();
        return reject(new Error(`Google returned: ${error}`));
      }
      if (!code || !safeEqual(state, nonce)) {
        done(400, "Not connected", "That response did not match the request this terminal made.");
        server.close();
        return reject(new Error("state mismatch — the redirect did not come from the request we made"));
      }

      done(200, "Connected", "You can close this tab and go back to your terminal.");
      server.close();
      resolve(code);
    });

    server.on("error", reject);
    // 127.0.0.1, not localhost: if localhost resolves to ::1 the redirect hangs.
    server.listen(0, "127.0.0.1", () => {
      redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}/callback`;
      opts.onUrl(authUrl(redirectUri, nonce, app, opts.scopes ?? SCOPES));
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for Google. Run `houselabel connect google` again."));
    }, opts.timeoutMs ?? 5 * 60 * 1000);
    // Without this the process hangs until the timeout after a successful connect.
    server.on("close", () => clearTimeout(timer));
  });

  const tokens = await exchangeCode(code, redirectUri, app);
  if (!tokens.refreshToken)
    throw new Error(
      "Google returned no refresh token. Remove this app at\n" +
        "  https://myaccount.google.com/permissions and connect again.",
    );

  const accountEmail = await whoAmI(tokens.accessToken);
  await save({
    accountEmail,
    scopes: tokens.scopes,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });
  return { accountEmail, scopes: tokens.scopes };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The one page the artist ever sees from this server. */
const page = (title: string, detail: string) => `<!doctype html>
<meta charset="utf-8"><title>${title} — houselabel</title>
<body style="font:16px/1.6 -apple-system,system-ui,sans-serif;margin:15vh auto;max-width:32rem;padding:0 1.5rem;color:#1a1a1a">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${title}</h1>
<p style="color:#555;margin:0">${detail}</p>
</body>`;
