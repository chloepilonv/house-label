/**
 * artist.connections, read and written through its own connection, never
 * data/artist/client.ts: that seam feeds rows to a model, and tokens must
 * never reach one (see connections.sql).
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { decrypt, encrypt } from "./crypto";

/** Google is OAuth; Buffer is an API key. This file is the only reader of credentials. */
export type Provider = "google" | "buffer" | "hunter";

/**
 * The "not connected" error department tools check for. Lives here, not in
 * auth.ts, to avoid an import cycle.
 */
export class NotConnectedError extends Error {
  constructor(message = "No Google account is connected. Run `houselabel connect google` first.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

/** What comes back decrypted. Never returned by a tool, never printed. */
export interface Connection {
  provider: Provider;
  accountEmail: string | null;
  scopes: string[];
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  settings: Record<string, unknown>;
}

/** The half that is safe to show a person, and safe to log. */
export interface ConnectionStatus {
  connected: boolean;
  accountEmail: string | null;
  scopes: string[];
  connectedAt: Date | null;
  settings: Record<string, unknown>;
}

function open() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "DATABASE_URL is unset — that is the ARTIST's database, where the connection lives.\n" +
        "  Run `houselabel init` first.",
    );
  return postgres(url, { max: 1, onnotice: () => {} });
}

/** Present tense, no secrets. This is what `--status` and the tools ask. */
export async function status(provider: Provider = "google"): Promise<ConnectionStatus> {
  const sql = open();
  try {
    const [row] = await sql`
      select account_email, scopes, settings, created_at
        from artist.connections where provider = ${provider}`;
    if (!row) return { connected: false, accountEmail: null, scopes: [], connectedAt: null, settings: {} };
    return {
      connected: true,
      accountEmail: row.account_email ?? null,
      scopes: String(row.scopes ?? "").split(/\s+/).filter(Boolean),
      connectedAt: row.created_at ?? null,
      settings: (row.settings ?? {}) as Record<string, unknown>,
    };
  } catch (err) {
    // An unmigrated database reads as "not connected", not a Postgres error.
    if (missingTable(err)) return { connected: false, accountEmail: null, scopes: [], connectedAt: null, settings: {} };
    throw err;
  } finally {
    await sql.end();
  }
}

export async function load(provider: Provider = "google"): Promise<Connection | null> {
  const sql = open();
  try {
    const [row] = await sql`select * from artist.connections where provider = ${provider}`;
    if (!row) return null;

    // Wrong key (HOUSELABEL_ENCRYPTION_KEY rotated, or the database copied to
    // a machine with its own secret.key): explain instead of the GCM error.
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = await decrypt(row.access_token);
      refreshToken = await decrypt(row.refresh_token);
    } catch {
      throw new NotConnectedError(
        "This Google connection was encrypted with a different key and cannot be read on this machine.\n" +
          "  Run `houselabel disconnect google`, then `houselabel connect google` to link it again.",
      );
    }

    return {
      provider,
      accountEmail: row.account_email ?? null,
      scopes: String(row.scopes ?? "").split(/\s+/).filter(Boolean),
      accessToken,
      refreshToken,
      expiresAt: row.expires_at,
      settings: (row.settings ?? {}) as Record<string, unknown>,
    };
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  } finally {
    await sql.end();
  }
}

export interface SaveInput {
  provider?: Provider;
  accountEmail: string | null;
  scopes: string[];
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function save(input: SaveInput): Promise<void> {
  const provider = input.provider ?? "google";
  const sql = open();
  try {
    await sql`
      insert into artist.connections
        (provider, account_email, scopes, access_token, refresh_token, expires_at)
      values (
        ${provider},
        ${input.accountEmail},
        ${input.scopes.join(" ")},
        ${await encrypt(input.accessToken)},
        ${await encrypt(input.refreshToken)},
        ${input.expiresAt}
      )
      on conflict (provider) do update set
        account_email = excluded.account_email,
        scopes        = excluded.scopes,
        access_token  = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at    = excluded.expires_at,
        updated_at    = now()`;
  } finally {
    await sql.end();
  }
}

/**
 * Store a refreshed access token, leaving the refresh token alone. A refresh
 * response has no refresh token, so `save` would blank it.
 */
export async function saveAccessToken(accessToken: string, expiresAt: Date, provider: Provider = "google") {
  const sql = open();
  try {
    await sql`
      update artist.connections
         set access_token = ${await encrypt(accessToken)},
             expires_at   = ${expiresAt},
             updated_at   = now()
       where provider = ${provider}`;
  } finally {
    await sql.end();
  }
}

/** Merge one preference into `settings` — the synced calendar, the deck folder. */
export async function setSetting(key: string, value: unknown, provider: Provider = "google") {
  const sql = open();
  try {
    await sql`
      update artist.connections
         set settings   = settings || ${sql.json({ [key]: value } as never)},
             updated_at = now()
       where provider = ${provider}`;
  } finally {
    await sql.end();
  }
}

export async function remove(provider: Provider = "google"): Promise<boolean> {
  const sql = open();
  try {
    const rows = await sql`delete from artist.connections where provider = ${provider} returning provider`;
    return rows.length > 0;
  } catch (err) {
    if (missingTable(err)) return false;
    throw err;
  } finally {
    await sql.end();
  }
}

/**
 * An API-key provider (Buffer). The key is encrypted in `access_token`; no
 * refresh or expiry. `--status` shows `accountLabel`, never the key.
 */
export async function saveKey(provider: Exclude<Provider, "google">, key: string, accountLabel: string | null) {
  const sql = open();
  try {
    await sql`
      insert into artist.connections (provider, account_email, access_token)
      values (${provider}, ${accountLabel}, ${await encrypt(key)})
      on conflict (provider) do update set
        account_email = excluded.account_email,
        access_token  = excluded.access_token,
        updated_at    = now()`;
  } finally {
    await sql.end();
  }
}

/** The decrypted key, or null when nothing is linked. Never returned by a tool. */
export async function loadKey(provider: Exclude<Provider, "google">): Promise<string | null> {
  const sql = open();
  try {
    const [row] = await sql`select access_token from artist.connections where provider = ${provider}`;
    if (!row) return null;
    try {
      return await decrypt(row.access_token);
    } catch {
      throw new NotConnectedError(
        `This ${provider} key was encrypted with a different key and cannot be read on this machine.\n` +
          `  Run \`houselabel connect ${provider}\` to link it again.`,
      );
    }
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  } finally {
    await sql.end();
  }
}

/** Postgres 42P01: the schema has never been migrated here. */
const missingTable = (err: unknown) => (err as { code?: string })?.code === "42P01";
