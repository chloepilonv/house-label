/**
 * `houselabel connect google`, plus status and disconnect. The terminal half.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { input, password } from "@inquirer/prompts";
import { bold, dim, gold } from "../banner";
import { readConfig, writeConfig } from "../config";
import { connectViaLoopback, isConfigured, oauthApp, revoke, SCOPES } from "./auth";
import { load, remove, status } from "./store";

export { NotConnectedError, SCOPES, isConfigured } from "./auth";
export { status, load as loadConnection } from "./store";
export * as calendar from "./calendar";
export * as drive from "./drive";
export * as gmail from "./gmail";
export * as gmailRead from "./gmail-read";

/** What each granted scope buys the artist, in their words rather than Google's. */
const WHAT_IT_IS_FOR = [
  ["Drive", "your workspace — masters, artwork, photos, the presskit deck"],
  ["Sheets", "the credits sheet you send collaborators for their IPI, address and tax numbers"],
  ["Calendar", "campaign tasks and release dates land on a calendar you pick"],
] as const;

/** Open a URL in the default browser. Silent on failure: the URL is printed anyway. */
export async function openBrowser(url: string): Promise<void> {
  const cmd =
    process.platform === "darwin" ? ["open", url]
    : process.platform === "win32" ? ["cmd", "/c", "start", "", url]
    : ["xdg-open", url];
  await Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }).exited.catch(() => {});
}

export async function connect(opts: { newClient?: boolean } = {}): Promise<void> {
  console.log("");

  // No shipped OAuth client, so the first run walks the artist through making
  // one and saves it in ~/.houselabel/config.json (not .env.local, which is
  // only read inside the repo).
  if (!isConfigured() || opts.newClient) {
    if (opts.newClient && isConfigured())
      console.log(dim("  Replacing the OAuth client saved on this machine.\n"));
    console.log(`  ${bold("First, a Google client of your own — about 8 minutes, once per machine.")}\n`);
    console.log(dim("  There is no shared one: a client secret in an open-source repo is a"));
    console.log(dim("  published secret. Five steps in your browser, then paste two values here.\n"));

    console.log(`  ${gold("1.")} ${bold("Make a project")} ${dim("(skip if you already have one)")}`);
    console.log(dim("     https://console.cloud.google.com/projectcreate\n"));

    console.log(`  ${gold("2.")} ${bold("Turn on four APIs")} ${dim("— open each, click ENABLE")}`);
    console.log(dim("     https://console.cloud.google.com/apis/library/drive.googleapis.com"));
    console.log(dim("     https://console.cloud.google.com/apis/library/sheets.googleapis.com"));
    console.log(dim("     https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"));
    console.log(dim("     https://console.cloud.google.com/apis/library/gmail.googleapis.com"));
    console.log(dim("     All on THIS project — the one the client below lives in. Gmail sends"));
    console.log(dim("     your Monday recap and lets the label learn how you write.\n"));

    console.log(`  ${gold("3.")} ${bold("Fill in the consent screen")}`);
    console.log(dim("     https://console.cloud.google.com/auth/branding"));
    console.log(dim('     An app name and your own email. Audience type: "External".'));
    console.log(dim('     (Older consoles call this page "OAuth consent screen".)\n'));

    console.log(`  ${gold("4.")} ${bold("Add yourself as a test user")} ${gold("← the step everyone skips")}`);
    console.log(dim("     https://console.cloud.google.com/auth/audience"));
    console.log(dim("     Under Test users, + Add users, put in your own Gmail address."));
    console.log(dim("     Without this, Google blocks the sign-in with \"app not verified\""));
    console.log(dim("     and this command just sits there until it times out."));
    console.log(dim("     Testing mode is enough, but Google ends its login every 7 days:"));
    console.log(dim("     run `houselabel connect google` again when the label asks.\n"));

    console.log(`  ${gold("5.")} ${bold("Create the client")}`);
    console.log(dim("     https://console.cloud.google.com/apis/credentials"));
    console.log(`     ${dim("+ Create credentials → OAuth client ID → Application type:")} ${bold("Desktop app")}`);
    console.log(dim("     Not \"Web application\" — a Web client refuses the 127.0.0.1 address"));
    console.log(dim("     this command listens on, with \"doesn't comply with Google's OAuth"));
    console.log(dim("     2.0 policy\". Desktop is the only type that works here."));
    console.log(dim("     Then copy the two values it shows you.\n"));

    console.log(dim("  Both stay on this machine, in ~/.houselabel/config.json (0600)."));
    console.log(dim("  The secret is hidden as you paste it.\n"));

    const clientId = (await input({ message: "Client ID", validate: (v) => !!v.trim() || "required" })).trim();
    const clientSecret = (await password({ message: "Client secret", mask: "*" })).trim();
    if (!clientId || !clientSecret) {
      console.log(dim("\n  Nothing saved.\n"));
      process.exitCode = 1;
      return;
    }
    const cfg = await readConfig();
    if (cfg) await writeConfig({ ...cfg, google: { clientId, clientSecret } });
    process.env.GOOGLE_CLIENT_ID = clientId;
    process.env.GOOGLE_CLIENT_SECRET = clientSecret;
    console.log(dim(`\n  ${cfg ? "Saved to ~/.houselabel/config.json." : "Using it for this run only — `houselabel init` first to keep it."}\n`));
  }
  oauthApp(); // throws with the same message if only one of the two is set

  const already = await status();
  if (already.connected) console.log(dim(`  Replacing the connection to ${already.accountEmail ?? "an account"}.\n`));

  console.log(`  ${bold("What you are about to grant:")}\n`);
  for (const [what, why] of WHAT_IT_IS_FOR) console.log(`    ${gold(what.padEnd(16))} ${dim(why)}`);
  // Must describe the real `drive` scope accurately; keep in step with SCOPES.
  console.log(dim("\n    Google's screen will say \"see all your Google Drive files\", and it means it:"));
  console.log(dim("    the label has to read what YOU put in your workspace — your masters, your"));
  console.log(dim("    artwork, the video you shot. Each department still reaches only the folders"));
  console.log(dim("    its own AGENT.md names, and nothing lists your Drive outside the workspace."));
  console.log(dim("    Revoke any time: `houselabel disconnect google`, or your Google account.\n"));

  try {
    const result = await connectViaLoopback({
      onUrl: (url) => {
        console.log(dim("  Opening your browser. If nothing happens, paste this:\n"));
        console.log(`  ${url}\n`);
        console.log(dim("  Waiting…"));
        void openBrowser(url);
      },
    });

    console.log(`\n  ${gold("✓")} Connected as ${bold(result.accountEmail ?? "your Google account")}`);
    for (const missing of missingScopes(result.scopes))
      console.log(dim(`  ! ${missing} was not granted — the features that need it will say so.`));
    console.log(dim("\n  `houselabel connect --status` to check it, `houselabel disconnect google` to undo it.\n"));
  } catch (err) {
    console.log(`\n  ${bold("Not connected.")} ${err instanceof Error ? err.message : String(err)}\n`);
    // This error never redirects, so we only see a timeout. Name the likely cause.
    if (err instanceof Error && /Timed out/.test(err.message)) {
      console.log(dim("  If the browser said the redirect URI is not registered, or that the app"));
      console.log(dim(`  ${bold("does not comply with Google's OAuth 2.0 policy")}${dim(", your OAuth client is a")}`));
      console.log(dim("  \"Web application\". It has to be a \"Desktop app\" — that type is the one"));
      console.log(dim("  allowed to use a 127.0.0.1 address on any port."));
      console.log(dim("  Make a Desktop client, then run `houselabel connect google --client`.\n"));
    }
    process.exitCode = 1;
  }
}

export async function disconnect(): Promise<void> {
  // Disconnect must not depend on decrypting the row, which may use a lost key.
  const conn = await load().catch(() => null);
  const who = conn?.accountEmail ?? (await status()).accountEmail;

  // Revoke first, so no orphaned grant stays on the Google account.
  if (conn) await revoke(conn.refreshToken);

  if (!(await remove())) {
    console.log(dim("\n  No Google account was connected.\n"));
    return;
  }
  console.log(`\n  ${gold("✓")} Disconnected ${bold(who ?? "your Google account")}.`);
  if (!conn)
    console.log(dim("  Its token could not be read here, so revoke it yourself at"));
  if (!conn) console.log(dim("  https://myaccount.google.com/permissions"));
  console.log(dim("  Nothing already in your Drive or Calendar was removed.\n"));
}

export async function printStatus(): Promise<void> {
  const s = await status();
  console.log("");
  if (!s.connected) {
    console.log(`  ${bold("Google")}  ${dim("not connected")}`);
    console.log(dim(isConfigured() ? "  `houselabel connect google` to link it.\n" : "  `houselabel connect google` will tell you what to set up first.\n"));
    return;
  }
  console.log(`  ${bold("Google")}  ${gold("connected")}  ${dim(s.accountEmail ?? "")}`);
  if (s.connectedAt) console.log(dim(`  since ${s.connectedAt.toISOString().slice(0, 10)}`));
  const calendarId = s.settings.calendar_id;
  if (calendarId) console.log(dim(`  calendar: ${String(calendarId)}`));
  for (const missing of missingScopes(s.scopes)) console.log(dim(`  ! ${missing} was not granted`));
  console.log(dim("\n  `houselabel disconnect google` to undo it.\n"));
}

/** Which of the things we asked for the artist did not tick. */
function missingScopes(granted: string[]): string[] {
  const has = new Set(granted);
  const label: Record<string, string> = {
    "https://www.googleapis.com/auth/calendar": "Calendar",
    "https://www.googleapis.com/auth/drive": "Drive",
    // Report an unticked scope now, before a later build fails on it.
    "https://www.googleapis.com/auth/spreadsheets": "Sheets",
  };
  return SCOPES.filter((s) => !has.has(s) && label[s]).map((s) => label[s]!);
}
