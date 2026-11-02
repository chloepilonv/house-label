# How it works

## One folder per department

Everything a department knows lives in one folder, `agents/<department>/`:

| File | What it is |
|---|---|
| `AGENT.md` | The job description: the role, what it owns, what it never does, how it talks to you. |
| `skills/<skill>/SKILL.md` | One task each — "find me radio stations", "draft the pitch" — written as steps. |
| `skills/<skill>/scripts/` | The deterministic half: the counting, dating and ranking is code, so it comes out the same every run. |
| `knowledge/` | What the department knows about the industry, with its sources — the page a rule came from, and when it was last checked. |
| `evals/` | The tests: simulated artists hold whole conversations with the department before a real one does. |

A department never guesses what it can look up. A deadline is a script reading
a date; a price is a row with a source; a rule is a line in a knowledge file
with a link next to it.

## Two kinds of data

| | **Yours** | **Ours** |
|---|---|---|
| What | profile, songs, splits, plan dates, numbers, the documents | distributors, media contacts, radio stations, playlists |
| Where | a database on your machine + your Google Drive | a catalog we crawl weekly, read live, read-only |
| Who writes | you, through the agents | the crawler |
| Leaves your machine? | only what you send to your model provider in a conversation | n/a — it is public data |

The two never mix: the catalog cannot see you, and nothing you tell an agent is
written back into the catalog.

## The label manager holds the calendar

You tell the label manager what you are putting out. It asks a fixed set of
questions, works backward from the street date, and produces a dated plan where
every step names the department that owns it. Each department then turns its
steps into concrete work — a pitch, a shortlist, a checklist — and you tick
things off in the **Plan** sheet in your Drive. Every Monday, the recap tells
you what got done, what is due this week and what is late.

Nothing is dispatched automatically. The label manager hands you the brief; you
open the department when you are ready.

## What the agents never do

- **Send, submit, post or upload for you.** Every pitch opens as a draft in
  your Gmail; every form is yours to fill. The agents prepare.
- **Spend your money without saying the number first.**
- **Give tax or legal advice.**
- **Say a table, a column or a command to you.** If one does, that is a bug.

## Two ways to run it

1. **The `houselabel` command** — the full label, with the database behind it.
   This is what the [QuickStart](./quickstart) installs.
2. **Point your own agent at a department folder** 🟡 beta — Claude Desktop,
   Claude Code, Cursor. Same knowledge, no database: it remembers only what
   its connectors hold (your Drive).

Next: [the agents](../agents/).
