---
name: rights-register-orgs
description: >
  Use when the artist wants to know which collection societies to join, or is
  working through a registration — prints the per-side checklist from the
  profile, then records member IDs, IPI and status, refusing "registered" until
  the required fields are filled.
metadata:
  agent: rights
  status: developed
  mode: task
  greeting: tell you which collection societies to join, and keep your member numbers
  greeting-fr: te dire à quelles sociétés de gestion t'inscrire, et garder tes numéros de membre
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# rights-register-orgs

**Status:** developed — the question set is code; the checklist is still prose.

The registration desk. One skill, because "which door do I knock on" and "I
knocked, here is my member number" are one errand to the artist, and were two
skills asking the same profile questions twice.

**This is not a form.** The checklist is computed from the profile and printed
BEFORE the first question. The interview then asks only what the profile cannot
know, and offers to keep the numbers. An artist with a complete profile answers
three questions.

## Data

**The catalog is ours, read-only, and ships as one file** —
`data/catalog/catalog.sqlite`, rebuilt every Monday. Read it with the query
script (`uv` runs it, and fetches a Python if the machine has none — works in
Claude Cowork, Desktop and Claude Code alike):

```bash
uv run data/catalog/query.py rights --country CA                      # societies, who they are for, cost, signup
```

`--where col=value`, `--q <text>`, `--columns all`, `--json` cover the rest;
`uv run data/catalog/query.py --datasets` lists what the file holds. It holds
desks, never a person: the person behind a desk comes from the artist's own
Hunter key or from reading the outlet's contact page for them.

```bash
bun run artist:brief rights
```

`Identifiers` carries the IPI and country. `Registrations` shows what is already
done, so nothing is recommended twice, and flags a `registered` org with no tax
form filed — a W-8BEN missing on a US org withholds 30% of the payout.

Collection societies are **catalog** data — the query script above, not
`artist:get`.

Record what the artist reports:

```bash
bun run artist:set registrations '{"org_slug":"socan","status":"registered","member_id":"...","registered_at":"2026-08-27","saved_org_name":"SOCAN"}' --conflict org_slug
```

Never write SQL and never open the database directly.

## Input

The question set is [`scripts/questions.ts`](./scripts/questions.ts), which the
engine drives. `country`, `province` and `roles` are **seeded from the profile
and never asked** — `view()` in the interview core skips a question already in
`answers`. A blank profile brings all three back with no second code path.

| Field | From | Notes |
|---|---|---|
| country · province · roles | profile, seeded | `corrections` is where the artist rejects the assumption |
| owns_masters | asked | the only fact the profile has no column for. **`yes` IS the `label` role** in `catalog.rights_orgs.for_whom` — the artist is never asked to call themselves a label |
| org registry | `catalog.rights_orgs` | who each society is, for which side and role |
| the IPI/CAE | `artist.registrations.org_details.ipi_number` | read from whichever registration has it; never re-asked |

`roles` answers in the question's own verbs — `write`, `perform`, `both` — which
is what the artist can read off the screen. Map them to `catalog.rights_orgs`:
`write` → `for_whom` contains `songwriter`, `perform` → `performer`, `both` →
either. The third role, `label`, is what `owns_masters` answers: an indie artist who paid for their own session is the
label for that recording and would never describe themselves that way. Map
`owns_masters = "yes"` to `for_whom` containing `label` when filtering the
registry.

## Process

1. **Print the checklist first, then ask.** Gate on country — a Canadian gets
   SOCAN, an American ASCAP or BMI, and there is no overlap. If it is missing
   from the profile the interview asks for it; country inference can legitimately
   return null.
2. **Present neighbouring rights as a choice, not a routing.** A Canadian
   performer picks one of ACTRA RACS, Artisti, or Re:Sound direct — none is
   restricted by province, language or residency. A Canadian who owns their
   masters also gets Panorama. **Say, at the moment the choice is offered, that
   picking two blocks the money** — two Canadian performer societies is double
   representation, and the equitable remuneration stops being paid until it is
   unwound with both. It is the most expensive mistake available on this side and
   an artist who joins two to collect more collects less.
   **Never recommend CONNECT**: its equitable-remuneration service is reserved to
   the multinationals, so an independent was never the client. Do not call it
   defunct — it still administers reproduction for music services and television
   music videos. Canadians *always* also get SoundExchange and The MLC.
3. **Surface the exclusive choices before giving steps** — ASCAP *or* BMI in
   the US; in Canada, which mandate holds the reproduction right (a publisher,
   SOCAN RR or CMRRA — both SOCAN's since 2026-09-01). These are decisions the
   artist makes. **Present the
   difference with the choice, in the same breath.** An artist asked which to
   pick and got a refusal followed by "check ASCAP.com and BMI.com" — they came
   here so they would not have to.
   [`rights-fundamentals.md`](../../knowledge/rights-fundamentals.md#1-auteur-compositeur-writer-and-composer)
   carries the comparison; give both, then leave the pick to them.
4. **Group and sort:** by side (COMPOSITION / AUTEUR, MASTERS / ENREGISTREMENT),
   then royalty category, then priority: **1** PRO + distributor · **2**
   reproduction / mechanical · **3** SoundExchange · **4** performer
   neighbouring rights · **5** maker neighbouring rights · **6** HFA. The
   ladder is an editorial default; the sides and societies are in
   [`rights-fundamentals.md`](../../knowledge/rights-fundamentals.md#about-each-right).
5. **Add the dual-role banner** when the artist is both songwriter and performer:
   they must register separately for each role to collect every stream. This is
   the single most common gap.
6. **Gate "registered" on completeness.** The required set is
   `catalog.rights_orgs.user_fields` where `required` is true — read it, don't
   assume it. The MLC requires only `account_email` and no member ID. If one is
   missing, refuse and list exactly which. **`ipi_number` is satisfied across
   registrations, not within one** — it is issued once and identical everywhere,
   so fill the gate from any other registration before asking.
7. **Print the signup URL and the requirements from the row. Never describe the
   website.** `signup_url` and `registration_requirements` are columns; quote
   them. Do not write "go to socan.ca and click Sign Up" — a real run did, and
   every part of it was wrong: SOCAN's writer application is at
   `writerapplicant.socan.com`, not `socan.ca`, there is no "Sign Up" button to
   click, and the walkthrough invented a mailing-address field while omitting
   the government photo ID the row actually names. A site's UI is not in the
   database, changes without notice, and is the one thing here that can send an
   artist to the wrong page with confidence.
8. **Say the eligibility gate before the steps, not after.** Several rows carry
   a bar the artist has to clear first — SOCAN wants **five** copyright-protected
   works that have been **performed publicly or licensed**, ASCAP wants at least
   one. An artist with an empty catalog is not eligible yet, and telling them to
   go and sign up wastes an afternoon and their trust. Read
   `Catalog hygiene` from the brief and say plainly where they stand against
   the bar.
9. **Filing the repertoire is a separate step from having a member ID.** ACTRA
   RACS, Artisti, CMRRA and The MLC all require works to be submitted after the
   account exists. Say which of the two is outstanding rather than calling the
   org registered.

## Output

The checklist: organizations grouped by side, then royalty category, sorted by
priority. Each entry carries its signup URL, cost, requirement checklist, notes,
and any tax form. Exclusive choices appear as a decision to make, not as two
recommendations. Sync licensing appears as an informational card — "no
collection society; sync deals are negotiated individually".

Then, when the artist accepted the ID vault: the saved registration rows and a
progress summary per side. When "registered" was attempted with a required field
empty, the output is the refusal and the exact list of what's missing, and
nothing is saved.

Statuses appear in the artist's language only — NOT STARTED / IN PROGRESS /
REGISTERED, or NON COMMENCÉ / EN COURS / INSCRIT. Never both in one line.

## Guidelines

- **Never file on the artist's behalf.** This records what the artist did on the
  society's own site.
- **Never describe a website's interface.** No button names, no field lists that
  are not `registration_requirements`, no step-by-step walkthrough. Give the URL
  from the row and what the row says is required. The artist can read a page;
  they cannot recover from being sent to the wrong one.
- **Never count the distributor row toward a registered total.** It is a record,
  not a registration.
- **Every checklist ships with the confirm-it-yourself line.** Fees and URLs go
  stale and nothing crawls this registry yet — each entry tells the artist to
  check the org's own page.
- The society registry and the three-rights model live in
  [`../../knowledge/rights-fundamentals.md`](../../knowledge/rights-fundamentals.md).
