# `engine/google/`

The artist's Google account, linked once by `houselabel connect google`.

| File | Holds |
|---|---|
| `auth.ts` | scopes, consent URL, code exchange, refresh, revoke, and the CLI's loopback listener |
| `store.ts` | the one row in `artist.connections` — the only reader of it |
| `crypto.ts` | AES-256-GCM over the two tokens |
| `api.ts` | one authorized `fetch`, so every Google call fails the same way |
| `drive.ts` · `calendar.ts` · `gmail.ts` | the three capabilities |
| `gmail-read.ts` | the artist's sent mail, read once by `houselabel voice learn --gmail` — a command, never a department |
| `tools.ts` | which of them a department is handed |
| `index.ts` | `connect` · `disconnect` · `printStatus` — the terminal half |

Two rules the code enforces rather than documents:

- **No department can read the token.** `artist.connections` is deliberately
  absent from `ARTIST_TABLES` in [`data/artist/client.ts`](../../data/artist/client.ts),
  so the seam every agent goes through cannot name it. `store.ts` opens its own
  connection. Departments get tools that *use* the token and never see it.
- **A department gets only what its `AGENT.md` declares.** The `google:` line
  is the whole permission. Declare nothing and `buildGoogleTools` returns `{}`
  — an absent tool cannot be called wrongly and costs no prompt.

## Adding a capability

Four coordinated edits. The order matters only in that the test in step 2 will
fail until step 1 is done.

1. **`GOOGLE_CAPABILITIES` in [`engine/frontmatter.ts`](../frontmatter.ts)** —
   the runtime's list. `parseGoogle` silently drops anything not on it, so a
   capability missing here reads as "declared nothing".
2. **`GOOGLE_CAPABILITIES` in [`agents/sync.ts`](../../agents/sync.ts)** — the
   checker's list. Duplicated on purpose: `sync.ts` validates the contract and
   must not import the runtime that consumes it. `google.test.ts` fails when
   the two lists disagree, which is what makes the duplication safe.
3. **`buildGoogleTools` in [`tools.ts`](./tools.ts)** — the `if (can.has(...))`
   block that turns the capability into an actual tool. Until this exists, a
   department can declare the capability and get nothing.
4. **The prose** — the placeholder in
   [`AGENT.template.md`](../../agents/agent-recruitor/skills/recruit-agent/assets/AGENT.template.md),
   the bullet in [`agents/README.md`](../../agents/README.md), and the table in
   the repo `README.md`. A capability nobody documents is one nobody declares.

Then add a case to `google.test.ts` — a department declaring the new capability
gets its tool, and one declaring something else does not.

## Adding a scope

Harder than it looks, and usually the wrong move.

- **`drive` (full), on purpose.** `drive.file` sees only files this app
  created, so a WAV the artist drags in would stay invisible, and most
  [workspace](./WORKSPACE.md) folders are artist-filled. The cost: a broader
  consent screen, and Google app verification before the hosted service
  launches. Departments still reach only the folders their `drive:` line names.
- **No Slides scope.** The deck is uploaded as PPTX and Drive converts it,
  which is a Drive operation. the first House Label asked for `presentations` and
  never called that API. Add it back only alongside a real Slides API call.
- **No Gmail scope in `SCOPES`.** `press` and `promotion` both promise "drafts,
  never sends". Writing a draft needs `gmail.compose` — **restricted**, meaning
  an annual third-party security assessment for anything hosted. Sending needs
  `gmail.send`, only *sensitive*. So the safer behaviour is the expensive one.
  `gmail.ts` builds a compose URL: no scope, no connection needed, and the
  artist presses send. A test fails if a Gmail scope appears in `SCOPES`.
- **One Gmail scope exists outside `SCOPES`: `gmail.readonly`, opt-in.**
  `houselabel voice learn --gmail` reads the artist's *sent* folder once to
  learn how they write. That command asks for the scope itself, on a screen
  that says why (`GMAIL_READONLY_SCOPE` in `auth.ts`, incremental consent so
  Drive and Calendar survive), and no department is ever handed a tool that
  uses it. It is still restricted: a self-hosting artist's own Desktop client
  in testing mode is fine; the hosted service cannot offer `--gmail` without
  Google's assessment, and offers `--from <folder>` instead.

Every scope added is a consent box the artist must tick, an API they must
enable, and one more way the sign-in can be refused.

## The two surfaces

`connectViaLoopback` in `auth.ts` is the only CLI-shaped thing here. A browser
on the artist's own machine can be redirected to `http://127.0.0.1:<port>`; one
on a server cannot. A hosted front end registers an HTTPS callback route and
calls the same `exchangeCode`. Everything else in this folder is
surface-agnostic, which is what a hosted front end needs.
