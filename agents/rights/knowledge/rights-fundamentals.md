---
name: rights-fundamentals
description: >
  Use as the department's base map of rights — the three kinds of rights a
  release generates, who splits each one, which society collects it in Quebec,
  the rest of Canada and the US (with join link, cost and verification date),
  how the money travels, and what every identification number (IPI, IPN, ISNI,
  ISWC, ISRC, UPC) is for.
metadata:
  agent: rights
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Rights knowledge

> **Disclaimer:** trust a professional over this agent.

## The three kinds of rights

1. **Auteur-compositeur** — the songwriter and composer side (the composition
   itself).
   1. a) It also carries **mechanical rights** (reproduction).
2. **Droit voisin: interprète** — neighbouring rights, performer side.
3. **Droit voisin: masters/recordings** — neighbouring rights, master owner side.

One stream pays all three, through different doors, on different schedules.
Missing one is invisible from the other two. Who *acquires* each right by
contributing to a song, and what a hired player is owed, is in
[`collaboration-rights-and-rates.md`](./collaboration-rights-and-rates.md).

## About each right

### 1. Auteur-compositeur (writer and composer)

**Split.** 50% to the *auteur* (lyricist), 50% to the *compositeur* (composer).
An arranger takes their share out of the composer's half (for example 5%).
Convention, not law: no society publishes a default split — shares are a private
contract, and the writer shares of one song total 100%.

- **Note.** If there is a publisher (*éditeur*), the publisher can take a
  certain percentage. The rest is then divided in half. Example: the publisher
  takes 50%, so 25% goes to the *auteur* and 25% to the *compositeur*.
- **Note (US).** Sometimes referred to as "200%": BMI quotes the writer side
  and the publisher side as 100% each; ASCAP quotes both on one 100% scale
  (read 2026-08-14). A percentage from one is not comparable to the other
  without converting.

**Which society.**

| Market | Org | Side / role | Join | Cost | Read |
|---|---|---|---|---|---|
| Canada (QC and rest) | [SOCAN](https://www.socan.com/sign-up-for-performing-rights/) | performance — writers, publishers | direct; a writer needs one work published, recorded or performed publicly; a publisher needs five | free | 2026-09-08 |
| Canada | [SOCAN Reproduction Rights](https://www.socan.com/what-are-socan-reproduction-rights/) | mechanical — streaming, downloads, CDs/vinyl, social media | opt in separately from SOCAN performing | commission 7% online · 10% physical/sync | 2026-08-14 |
| Canada | [CMRRA](https://www.cmrra.ca/about/) | mechanical — publishers and self-published writers | direct | not published on cmrra.ca | 2026-08-14 |
| US | [ASCAP](https://www.ascap.com/) | performance — writers, publishers | direct at `ome.ascap.com` | writer free · publisher-only $50 (ascap.com returns 403 to this repo's fetcher; read by hand 2026-08-14) | 2026-08-14 |
| US | [BMI](https://www.bmi.com/join) | performance — writers, publishers | direct | writer free · publisher $175 individual / $250 company / $500 partnership, one-time | 2026-08-14 |
| US | [SESAC](https://www.sesac.com/) | performance | **invitation only** | — | 2026-08-14 |
| US | [GMR](https://globalmusicrights.com/) | performance | no public application path | — | 2026-08-14 |
| US | [The MLC](https://www.themlc.com/membership) | mechanical, digital audio, US only — self-administered writers, publishers | direct; eligibility is *entitlement to US royalties*, not residence — Canadians join directly | free; pays monthly | 2026-09-08 |
| US | [HFA](https://www.harryfox.com/publishers/) | mechanical, physical and other licences | publishers; self-published terms not published | not published | 2026-08-14 |

- **Canada (QC and rest): SOCAN**, one society for the whole country.
- **Mechanical in Canada — SOCAN RR or CMRRA, both now SOCAN's.** SOCAN
  announced the purchase 2026-07-29 and **completed it 2026-09-01**; "CMRRA
  [will] continue operating with current reproduction rights services"
  ([SOCAN, 2026-09-01](https://www.socan.com/socan-announces-completion-of-cmrra-acquisition-2/),
  read 2026-09-08). Neither site forbids affiliating with both, but one mandate
  administers a work's reproduction right — a publisher's, SOCAN RR's or
  CMRRA's — so ask which one holds it before registering.
- **US: pick one PRO** — ASCAP, BMI, SESAC or GMR. BMI: "As long as you are
  not a member of any other performing rights organization in the world, you
  are free to affiliate with BMI" (read 2026-08-14). ASCAP or BMI is the
  artist's choice; both are free for a writer, both split writer/publisher
  50/50; ASCAP is a member-governed not-for-profit, BMI a for-profit since
  February 2024. The department explains the difference and never picks.
- **US mechanicals:** The MLC for digital audio (streams, downloads, US only);
  HFA for physical and other licences. The MLC "does not replace"
  SoundExchange or the PROs (themlc.com, 2026-08-14).
- **Foreign mechanicals are the gap.** A PRO collects foreign *performance*
  money through reciprocals (BMI: 90+ sister societies, 3.6% admin fee,
  12–18 months — [bmi.com](https://www.bmi.com/creators/royalty/foreign_royalties),
  2026-09-08). Nobody in either table collects foreign *mechanicals* for a
  self-published writer; that is what a publishing administrator (Songtrust and
  peers, `catalog.tools`) sells, for a cut.

**How it works.**

- **DSPs** (Spotify, Apple Music, etc.) send the writer-composer royalties to
  the writer-composer PRO. For all writer-composers, the DSP — and in fact any
  streaming service — sets a fixed amount for "all streams". It therefore sends
  a fixed pool to the PRO, which then distributes it among the artists. So if
  you were played 10,000 times, you get
  `[YOUR_PLAYS] / [ALL_PLAYS] * [FIXED_AMOUNT]`.
- **International.** The writer-composer PROs of other countries collect and
  send to your own writer-composer PRO. Example: if you are played in France,
  SACEM collects your royalties and sends them to SOCAN, which sends them to you
  ("SOCAN will collect your international royalties through their reciprocal
  agreements" — [socan.com FAQ](https://www.socan.com/frequently-asked-questions/),
  2026-09-08).
- **Cadence.** SOCAN pays quarterly from Feb 15, minimum $0.25; SOCAN RR four
  times a year (Mar/Jun/Sep/Dec 15); The MLC monthly (2026-08-14).
- **Sync** — licensing a song to film, TV, advertising, games — has no
  collection society. Composition sync and master sync clear separately, one
  deal at a time.

### 2. Droit voisin: interprète (performer)

**Split.** The society identifies the **"featured"** (*vedette*) and
**"non-featured"** (*accompagnateur*) performers. In Canada, Re:Sound divides
every dollar 50% performers / 50% makers, then the performer half **80% to
featured and 20% to session and backup performers** on popular music
([Re:Sound Distribution Rules §4](https://www.resound.ca/wp-content/uploads/2020/08/Distribution-Rules.pdf),
2026-09-08). Each pool is then divided equally among its members (5
non-featured performers divide the 20% five ways = 4% each). In the US the
split is fixed by statute: 45% featured, 5% non-featured fund, 50% master owner
([SoundExchange](https://www.soundexchange.com/digital-performance-royalties/),
2026-09-08).

**Which society.**

| Market | Org | Role | Join | Cost | Read |
|---|---|---|---|---|---|
| Canada | [Artisti](https://www.artisti.ca/en/membership-documents/) | performers — "any performer, Canadian or foreign … who takes part in an eligible sound recording" | direct | no membership fee; management fee off royalties, rate not published | 2026-09-08 |
| Canada | [ACTRA RACS](https://racs.actra.ca/faq/) | performers "from all over the world"; union membership not required | direct | free; "a small administrative fee" off payments, unquantified | 2026-09-08 |
| Canada | [Re:Sound direct](https://www.resound.ca/artists/) | performers not registered with a member collective | direct | not published | 2026-09-08 |
| Canada | MROC | — | **ceased operations**; unclaimed mandates moved to Artisti 2024-12-31 ([musiciansrights.ca](https://musiciansrights.ca/)) | — | 2026-09-08 |
| US | [SoundExchange](https://www.soundexchange.com/) | featured artists, plus the 50% master share | direct; non-US registrants included | free; W-8BEN required or 30% withheld | 2026-09-08 |
| US | [AFM & SAG-AFTRA Fund](https://www.afmsagaftrafund.org/) | non-featured performers (the 5%) | claim by session credit | free | 2026-08-14 |

- **The choice is not geographic.** Artisti was born of the Union des artistes
  and ACTRA RACS of ACTRA, but Re:Sound tells a performer to "register with one
  of our member organisations that represent artists (ACTRA RACS or Artisti),
  or directly with Re:Sound" — no province, language or union condition
  (resound.ca/artists, 2026-09-08). Quebec decides the language of the answer,
  not the society.
- **Pick one.** Two performer societies means two mandates over the same
  recording, and the equitable remuneration is **blocked** until it is unwound
  (Menon, *L'autoproduction — guide pratique et juridique*, APCM, 2025, §2.2).
  Same on the maker side between Panorama and Re:Sound direct.
- **Re:Sound is both the tariff body and a door.** It is the Copyright Act
  Part VII.1 collective: it argues the neighbouring-rights tariffs before the
  Copyright Board, collects, keeps its costs, and pays through its member
  collectives (Artisti, ACTRA RACS, Panorama) — *and* takes direct
  registration from anyone not in one (resound.ca/faq, 2026-09-08).
- **The SoundExchange carve-out.** Some Canadian and Quebec artists withdraw
  the US from their Artisti or ACTRA RACS mandate and register with
  SoundExchange directly — faster payment, no second management fee, statements
  per recording. They complete a **W-8BEN** claiming the Canada–US treaty:
  copyright royalties for a musical work are "taxable only in" the country of
  residence, so the US withholding is 0% instead of 30%
  ([Canada–US Tax Convention, Art. XII(3)](https://www.irs.gov/pub/irs-trty/canada.pdf),
  2026-09-08; SoundExchange FAQ: "30% withholding is applied to all non-U.S.
  payees unless they submit a completed W-8BEN", 2026-09-08). Tax is then paid
  in Canada, once.
- **Two extra Canadian lines.** Private copying levy — 29¢ per blank CD-R/RW,
  2025–2027 tariff, split 58.2% authors/publishers · 23.8% performers · 18%
  makers ([CPCC](https://www.cpcc.ca/en/), 2026-09-08) — and Quebec schools:
  Panorama and Artisti collect on reproduction in preschool, primary and
  secondary education under an agreement with the Ministère de l'Éducation
  (Menon §2.2).

**How it works.** Radio, background music, webcasters and satellite pay a
tariff to Re:Sound (CA) or the statutory licence to SoundExchange (US); the
society matches the recording to its performers by IPN and ISRC. Neither pays
for on-demand streaming — Spotify and Apple money reaches performers only
through the master owner's distributor, or through a contract with the master
owner. US over-the-air radio pays performers and masters nothing: "there is no
performance right for over-the-air broadcasts" (SoundExchange FAQ, 2026-09-08).

### 3. Droit voisin: masters/recordings

**Split.** Belongs to the master owner — in law the **maker**, "the person by
whom the arrangements necessary for the first fixation of the sounds are
undertaken" ([Copyright Act, s 2](https://laws-lois.justice.gc.ca/eng/acts/C-42/section-2.html),
2026-09-08). Whoever booked and paid for the session is the maker, label or
not. When there is a label, the label can take 50% (or more) of that pie.

- Note: sometimes in the US, the label takes 100% and only then pays the artist
  their share (practitioner note, 2026-09-04).

**Which society.**

| Market | Org | Role | Join | Cost | Read |
|---|---|---|---|---|---|
| Canada | [Panorama](https://panorama.mu/en/about) (ex-SOPROQ; "Octave" is its portal) | independent labels and master owners; 40+ countries by reciprocity | direct | free; admin fee 7% Canada · 4% US · 7% rest of world | 2026-09-08 |
| Canada | [Re:Sound direct](https://www.resound.ca/faq/) | "if you're a record company, or own your masters" and are not with Panorama | direct | not published | 2026-09-08 |
| Canada | [CONNECT Music Licensing](https://cb-cda.gc.ca/en/copyright-information/collective-societies) | the majors; reproduction licences for recordings and music videos | not a Re:Sound route since 2024-12-31 | — | 2026-09-08 |
| US | [SoundExchange](https://www.soundexchange.com/) | sound recording owner — the 50% | direct | free; W-8BEN for Canadians | 2026-09-08 |

- **Never send an independent to CONNECT.** Its equitable-remuneration service
  is reserved to the multinationals (Menon §2.2); it is not defunct — it still
  licenses reproduction of recordings and music videos for music services and
  television — but Panorama or Re:Sound direct are the maker routes for an
  artist who owns their masters.
- **Panorama is the brand, SOPROQ the legal entity** since 2025-09-15
  (panorama.mu, 2026-08-14).

**How it works.** DSPs (Spotify, Apple Music, etc.) send the master royalties to
the distributor, which then pays the artist. Radio and webcasting pay the
society. Sync of the master is negotiated per deal.

### 4. Legal deposit (BAnQ and BAC)

Not a right — an obligation. Every sound recording published in Quebec is
deposited free with BAnQ within seven days of release, two copies per format,
digital included since 2022; MétaMusique forwards digital deposits
([BAnQ](https://www.banq.qc.ca/notre-institution/bibliotheque-nationale/foire-aux-questions-services-aux-editeurs/),
2026-09-08). Library and Archives Canada runs the federal counterpart.

## Identification numbers

> "I" stands for *international*.

| Number | Identifies | Issued by | Format · cost | Read |
|---|---|---|---|---|
| **IPI** | a writer or publisher (composition side) | the IPI system run by SUISA for CISAC, "allocated automatically … to each interested party" when your PRO registers you; SOCAN, ASCAP or BMI hand it back ([CISAC](https://www.cisac.org/services/information-services/ipi)) | length not published by CISAC · free | 2026-09-08 |
| **IPN** | a performer (master side) | SCAPR's International Performer Database, created by the performer's own society — Artisti or ACTRA RACS for a Canadian ([SCAPR](https://www.scapr.org/services/)) | free with membership | 2026-09-08 |
| **ISNI** | a person or band, across industries | ISNI International Agency; BAnQ/MétaMusique ask for it when documenting a work ([isni.org](https://isni.org/)) | 16 digits · not published | 2026-09-03 |
| **ISWC** | a work (the composition) | your PRO, on work registration — needs the original title and the IPI of every creator ([iswc.org](https://www.iswc.org/creators-publishers)) | T-prefixed, pattern in ISO 15707 · free with registration | 2026-09-08 |
| **ISRC** | a recording, never the song | a national agency gives the 5-character prefix, you assign the rest: `CC-XXX-YY-NNNNN`, 12 characters ([IFPI](https://isrc.ifpi.org/en/)). Canada: [Panorama](https://panorama.mu/en/isrc), fee not on the page. US: RIAA at [usisrc.org](https://usisrc.org/), $95 one-time | 12 alphanumeric | 2026-09-08 |
| **UPC** | a release (*parution*) — the barcode | GS1 Canada / GS1 US (pricing not shown on gs1ca.org, 2026-09-08); most distributors issue one with the release | 12 digits | 2026-09-08 |

- A songwriter who also performs needs **both** an IPI and an IPN, for the same
  reason they register on both sides. A performer with no IPN is one a foreign
  society cannot match a play to.
- **Most distributors issue ISRCs and UPCs** at upload; that is where an
  independent artist's codes usually come from before any agency is involved.
- **Every society issues a member number** — it belongs on the artist profile,
  beside the IPI.

## Glossary

- **Société de gestion / OGC** — collective management organization; *PRO* (Performing Rights Organization) is the US word for the performance-side one.
- **Éditeur (publisher)** — administers and registers the composition, takes a share, may also pitch sync.
- **Sync licensing** — selling a song's use to film, TV, advertising, games; no society, one deal at a time.
- **Parution** — release. **Licence / autorisation** — a usage agreement, e.g. a label licensed to commercialize the recording.
- **Featured / non-featured** — *vedette* / *accompagnateur*: the two performer pools a neighbouring-rights society pays.
