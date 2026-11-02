---
title: Welcome to House Label
---

<div class="hl-hero">
  <img src="/wordmark-white.png" alt="House Label" />
  <span class="hl-pill">Agentic music label · free for artists</span>
  <p class="hl-title">Build your <em>own</em><br>music label</p>
  <p class="hl-sub">Humans make the art. The agents handle the administrative work — press, promotion, distribution, rights — and your data stays with you.</p>
</div>

<p class="hl-badges">
  <img src="https://img.shields.io/badge/status-beta-e0b44a" alt="beta" />
  <img src="https://img.shields.io/badge/region-Quebec%20validated-2ea44f" alt="Quebec validated" />
  <img src="https://img.shields.io/badge/runtime-Bun%20%E2%89%A5%201.1-black" alt="Bun" />
  <img src="https://img.shields.io/badge/database-Docker%20Postgres-2496ed" alt="Docker" />
  <img src="https://img.shields.io/badge/model-your%20Claude%20subscription%20or%20key-7d2a3d" alt="provider" />
</p>

<p class="hl-links"><a href="/start/quickstart">QuickStart</a> • <a href="/start/how-it-works">How it works</a> • <a href="/agents/">Agents</a> • <a href="/ai-101/">AI 101</a> • <a href="https://github.com/chloepilonv/house-label">GitHub</a></p>

::: warning Beta
The `houselabel` command and the setup are still changing. The agents and skills are the solid part: open the repo folder in Claude Code and talk to them directly.
:::

## About

House Label is a record label made of agents. You are the artist; each
department — press, promotion, distribution, rights, marketing — is an
agent that knows that job, reads what you already told the label, and hands you
the next concrete step.

It is **open source** (AGPL-3.0) and **self-hosted**: the code runs on your machine, your
data stays in a database on your machine and in your own Google Drive, and the
model behind the agents is the one you choose — your Claude subscription, your
own API key, or a free local model.

## Who it is for

- An independent artist putting out a single, an EP or an album, with or
  without a team.
- A small label or manager running a few artists.
- Validated in **Quebec** first (SOCAN, Musicaction, CRTC radio quotas, the
  French-language press); Canada and the US are next.

## What it is not

- Not a distributor, a PR agency or a radio plugger. The agents prepare,
  compare, draft and track; **you** press send, upload the record, sign the
  form.
- Not an accountant or a lawyer. No tax advice, no contract advice — it says so
  and points you to a person.
- Not a streaming farm or a growth hack. Every route it names is one a real
  label uses, with its real price and a source.

## Installation

```bash
git clone https://github.com/chloepilonv/house-label && cd house-label
./setup-label.sh      # provider → database → your profile → Google (Enter skips)
houselabel            # talk to your label manager
```

The whole path, with the no-install option: [QuickStart](/start/quickstart).

## The agents

| Department | In a real label | Here |
|---|---|---|
| [Label manager](/agents/label-manager) | the release coordinator | scopes the release, dates every step, the Plan sheet, the Monday recap |
| [Distribution](/agents/distribution) | gets the record into stores | compares 39 distributors on your revenue, the delivery checklist |
| [Digital marketing](/agents/digital-marketing) | brand, social, ads, the site | a dated campaign plan, captions, your website |
| [Press](/agents/press) | getting **written about** | media contacts (QC · CA · US), the pitch, the pipeline |
| [Promotion](/agents/promotion) | getting **played** | stations and playlists ranked, with the route and its price |
| [Presskit](/agents/presskit) | bio, photos, the EPK | an interview that asks only the gaps, then the printed presskit (PDF, your language or both) |
| [Rights](/agents/rights) | societies, splits, identifiers | the registration checklist, the song catalog |
| [Platforms](/agents/platforms) | data and analytics | your numbers, logged and explained |

Full roster, with what each one never does: [Agents](/agents/).

## License

[GNU AGPL-3.0](https://github.com/chloepilonv/house-label/blob/main/LICENSE): free to use, change and share. Anyone running a modified version for others, including as a website, publishes their changes under the same license.

## Acknowledgements

The knowledge in these agents was not invented here. People from the Quebec
music community gave their time so the departments say true things:

- **Bertrand Menon** — *L'autoproduction : guide pratique et juridique* (APCM,
  2025), the backbone of the rights department: who owns what, the agreements a
  self-producing artist needs, and the societies to join.
- **Sébastien Charest**, **Julie Desjardins** (COOP Faux-Monnayeurs) and
  **the Métamusique team**, for their advice.
- **Laurent** and the artists who let a department run their release and told
  us where it was wrong.

If you helped and your name is missing, [open an issue](https://github.com/chloepilonv/house-label/issues) — we add it.

::: warning Beta
The label was built around one real release in 2026, but the project is young.
Read what an agent writes before you act on it, and tell us what was wrong.
:::
