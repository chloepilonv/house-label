/**
 * The plan as a page the artist can open, print and tick off.
 * Calendar dates only: week offsets (`W-9`) are storage and never appear here.
 * Self-contained (no CDN, fonts or script) because it is opened from disk,
 * often offline, and printed.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import {
  OWNER_LABEL, PROPOSED, SOURCES,
  type Lang, type Plan, type ResolvedMilestone, type Text,
} from "./milestones";
import { TIER_LABEL, money, settle, totals, type BudgetView } from "./costs";

export interface PageMeta {
  title: string;
  projectType: string;
  markets: string[];
  physical: string;
  generatedOn: string;
  lang: Lang;
}

const T = {
  en: {
    streetDate: "Street date",
    out: (n: number) => (n >= 0 ? `${n} days from now` : `${-n} days ago`),
    startHere: "Start here",
    startHereBody: (d: string, n: number) =>
      n >= 0
        ? `The first deadline is ${d}, ${n} days from now.`
        : `The first deadline was ${d}, ${-n} days ago.`,
    phase: "Phase",
    noDate: "no date yet",
    warnings: "Read these",
    sources: "Where every date comes from",
    sourcesNote:
      "≈ marks a date derived from a sourced one rather than published as a lead time. The step is real; the day is arithmetic.",
    latest: "latest",
    window: "aim for the first date; the second is the last honest moment, not a suggestion",
    missing: "Departments the label doesn't have",
    missingNote:
      "These steps have no one on staff. That is a hiring decision, not a permanent gap — ask the Recruiting Agent if you want the department.",
    owner: "Owner",
    generated: "Generated",
    nobody: "nobody on staff — this one is yours",
    print: "Print / save as PDF",
    done: "done",
    budget: "What it costs",
    budgetNone: "No budget given yet — pick a tier or say a number.",
    budgetYours: (b: string) => `Your budget: ${b}`,
    tierNote:
      "Bare is the cheapest published route for each step; decent is a real run of it; full adds the upgrade money would buy. Every price is the vendor's own, linked below. A quantity that is ours says so. Currencies are never converted.",
    envelopes: "What each department gets",
    envelopeNote: "your budget split across the priced steps — each department's floor, plus its share of what you have above the bare run, capped at a decent run",
    noPrice: "no published price",
    priceOf: "cost",
  },
  fr: {
    streetDate: "Date de sortie",
    out: (n: number) => (n >= 0 ? `dans ${n} jours` : `il y a ${-n} jours`),
    startHere: "Commence ici",
    startHereBody: (d: string, n: number) =>
      n >= 0
        ? `La première échéance est le ${d}, dans ${n} jours.`
        : `La première échéance était le ${d}, il y a ${-n} jours.`,
    phase: "Phase",
    noDate: "pas encore de date",
    warnings: "À lire",
    sources: "D'où vient chaque date",
    sourcesNote:
      "≈ marque une date dérivée d'une source plutôt qu'un délai publié. L'étape est réelle ; le jour est un calcul.",
    latest: "au plus tard",
    window: "vise la première date ; la seconde est la dernière limite honnête, pas une suggestion",
    missing: "Départements que le label n'a pas",
    missingNote:
      "Ces étapes n'ont personne dans l'équipe. C'est une décision d'embauche, pas un trou permanent — demande au Recruteur si tu veux le département.",
    owner: "Responsable",
    generated: "Généré le",
    nobody: "personne dans l'équipe — celle-là est à toi",
    print: "Imprimer / enregistrer en PDF",
    done: "fait",
    budget: "Ce que ça coûte",
    budgetNone: "Aucun budget donné — choisis un palier ou dis un chiffre.",
    budgetYours: (b: string) => `Ton budget : ${b}`,
    tierNote:
      "Le minimum est la voie publiée la moins chère pour chaque étape ; le correct, un vrai run ; le complet ajoute ce que l'argent achèterait en plus. Chaque prix est celui du fournisseur, lié plus bas. Une quantité qui est la nôtre le dit. Les devises ne sont jamais converties.",
    envelopes: "Ce que chaque département reçoit",
    envelopeNote: "ton budget réparti sur les étapes chiffrées — le plancher de chaque département, plus sa part de ce que tu as au-dessus du minimum, plafonné à un run correct",
    noPrice: "pas de prix publié",
    priceOf: "coût",
  },
} as const;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const t = (x: Text, lang: Lang) => x[lang];

const LOCALE: Record<Lang, string> = { en: "en-CA", fr: "fr-CA" };

const longDate = (iso: string, lang: Lang) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE[lang], {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });

const monthKey = (iso: string, lang: Lang) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE[lang], {
    month: "long", year: "numeric", timeZone: "UTC",
  });

const ownerName = (owner: string | null, lang: Lang) =>
  t(OWNER_LABEL[owner ?? "you"] ?? OWNER_LABEL.you, lang);

function row(m: ResolvedMilestone, lang: Lang, L: (typeof T)[Lang], currency: BudgetView["currency"]): string {
  const when = m.date
    ? `<time datetime="${m.date}">${esc(longDate(m.date, lang))}</time>${m.sourced ? "" : `<span class="approx" title="${esc(t(m.basis, lang))}">≈</span>`}` +
      (m.latestDate
        ? `<span class="latest" title="${esc(L.window)}">${esc(L.latest)} ${esc(longDate(m.latestDate, lang))}</span>`
        : "")
    : `<span class="undated">${esc(L.noDate)}</span>`;
  const why = m.date
    ? ""
    : `<p class="why">${esc(t(m.noDateReason ?? m.basis, lang))}</p>`;
  const gap = m.owner == null && m.gapReason
    ? `<p class="why">${esc(t(m.gapReason, lang))}</p>`
    : "";
  // The money on the line it belongs to, bare → decent, in the vendor's own
  // currency. A step with no price says so; a step with no line says nothing.
  const isFree = m.cost?.aim.every((x) => x.amount === 0);
  const cost = m.cost
    ? m.cost.floor.length
      ? `<p class="cost" title="${esc(t(m.cost.basis, lang))}">${esc(L.priceOf)} ${isFree ? (lang === "fr" ? "gratuit" : "free") : `${esc(totals(settle(m.cost.floor, currency), lang))} → ${esc(totals(settle(m.cost.aim, currency), lang))}`}${m.cost.sourced ? "" : " ≈"}</p>`
      : `<p class="cost muted">${esc(L.noPrice)} — ${esc(t(m.cost.noPriceReason ?? m.cost.basis, lang))}</p>`
    : "";
  return `      <li class="ms${m.date ? "" : " is-undated"}">
        <label class="tick"><input type="checkbox" aria-label="${esc(L.done)}"><span></span></label>
        <div class="when">${when}</div>
        <div class="what">
          <h3>${esc(t(m.title, lang))}</h3>
          <p class="detail">${esc(t(m.detail, lang))}</p>
          ${why}${gap}${cost}
        </div>
        <div class="who"><span class="chip${m.owner ? "" : m.proposedOwner ? " chip-missing" : " chip-you"}">${esc(m.owner ? ownerName(m.owner, lang) : m.proposedOwner ?? ownerName(null, lang))}</span></div>
      </li>`;
}

export function renderPlan(plan: Plan, meta: PageMeta): string {
  const lang = meta.lang;
  const L = T[lang];
  const pageTitle = `${meta.title} — ${meta.projectType.toUpperCase()} · ${plan.streetDate}`;

  const phases = plan.phases
    .map((p) => {
      // Group inside a phase by month so a six-month plan reads as a calendar.
      const chunks: string[] = [];
      let month = "";
      for (const m of p.milestones) {
        const mk = m.date ? monthKey(m.date, lang) : "";
        if (mk && mk !== month) {
          month = mk;
          chunks.push(`      <li class="month">${esc(month)}</li>`);
        }
        chunks.push(row(m, lang, L, plan.budget.currency));
      }
      const span =
        p.startsDay != null && p.endsDay != null
          ? `${longDate(addISO(plan.streetDate, p.startsDay), lang)} → ${longDate(addISO(plan.streetDate, p.endsDay), lang)}`
          : "";
      const owners = [
        ...new Set(
          p.milestones.map((m) => (m.owner ? ownerName(m.owner, lang) : m.proposedOwner ?? ownerName(null, lang))),
        ),
      ].join(" · ");
      return `  <section class="phase">
    <header>
      <span class="num">${p.order}</span>
      <div>
        <h2>${esc(t(p.title, lang))}</h2>
        <p class="span">${esc(span)}${span ? " · " : ""}${esc(owners)}</p>
      </div>
    </header>
    <ol class="milestones">
${chunks.join("\n")}
    </ol>
  </section>`;
    })
    .join("\n");

  const warnings = plan.warnings.length
    ? `  <section class="warnings">
    <h2>${esc(L.warnings)}</h2>
    <ol>
${plan.warnings.map((w) => `      <li>${esc(t(w.text, lang))}</li>`).join("\n")}
    </ol>
  </section>`
    : "";

  const budget = renderBudget(plan.budget, lang, L);

  const sources = `  <details class="sources">
    <summary>${esc(L.sources)}</summary>
    <p class="note">${esc(L.sourcesNote)}</p>
    <dl>
${plan.milestones
  .map((m) => {
    const links = m.sources
      .map((id) => {
        const src = SOURCES[id];
        if (!src) return "";
        return src.url
          ? `<a href="${esc(src.url)}" target="_blank" rel="noreferrer">${esc(src.title)}</a>`
          : `<code>${esc(src.where ?? id)}</code>`;
      })
      .filter(Boolean)
      .join(" · ");
    return `      <dt>${m.sourced ? "" : "≈ "}${esc(t(m.title, lang))}</dt>\n      <dd>${esc(t(m.basis, lang))}${links ? `<br><span class="links">${links}</span>` : ""}</dd>`;
  })
  .join("\n")}
${plan.budget.lines
  .map((l) => {
    const links = l.sources
      .map((id) => {
        const src = SOURCES[id];
        if (!src) return "";
        return src.url
          ? `<a href="${esc(src.url)}" target="_blank" rel="noreferrer">${esc(src.title)}</a>`
          : `<code>${esc(src.where ?? id)}</code>`;
      })
      .filter(Boolean)
      .join(" · ");
    return `      <dt>${esc(L.priceOf)} — ${esc(t(l.title, lang))}</dt>\n      <dd>${esc(t(l.basis, lang))}${links ? `<br><span class="links">${links}</span>` : ""}</dd>`;
  })
  .join("\n")}
    </dl>
  </details>`;

  const missing = plan.missingDepartments.length
    ? `  <section class="missing">
    <h2>${esc(L.missing)}</h2>
    <p class="note">${esc(L.missingNote)}</p>
    <ul>
${plan.missingDepartments
  .map((d) => `      <li><b>${esc(d)}</b> — ${esc(PROPOSED[d] ? t(PROPOSED[d], lang) : d)}</li>`)
  .join("\n")}
    </ul>
  </section>`
    : "";

  const first = plan.milestones.find((m) => m.date);
  const startBanner = first?.date
    ? `  <aside class="start">
    <h2>${esc(L.startHere)}</h2>
    <p>${esc(L.startHereBody(longDate(first.date, lang), daysFromNow(meta.generatedOn, first.date)))}</p>
    <p class="what-first">${esc(t(first.title, lang))} — ${esc(ownerName(first.owner, lang))}</p>
  </aside>`
    : "";

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<style>
:root {
  --bg: #fbfaf8; --fg: #16150f; --muted: #6b675c; --line: #e2ded4;
  --card: #ffffff; --accent: #7a4f2b; --warn-bg: #fdf3e7; --warn-fg: #6b3d10;
  --chip: #efece4;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14130f; --fg: #f2efe7; --muted: #9d998c; --line: #2c2a23;
    --card: #1b1a15; --accent: #d8a273; --warn-bg: #2a2013; --warn-fg: #e8c79c;
    --chip: #26241d;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 2.5rem 1.25rem 5rem; background: var(--bg); color: var(--fg);
  font: 16px/1.55 ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 46rem; margin: 0 auto; }
h1 { font-size: 1.65rem; line-height: 1.2; margin: 0 0 .35rem; letter-spacing: -.01em; }
.sub { color: var(--muted); margin: 0 0 2rem; font-size: .95rem; }
.sub b { color: var(--fg); font-weight: 600; }
.start {
  background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--accent);
  border-radius: 6px; padding: 1rem 1.15rem; margin: 0 0 2.5rem;
}
.start h2 { font-size: .72rem; text-transform: uppercase; letter-spacing: .09em;
  color: var(--accent); margin: 0 0 .4rem; }
.start p { margin: 0; }
.what-first { color: var(--muted); font-size: .92rem; margin-top: .2rem !important; }
.phase { margin: 0 0 2.75rem; }
.phase > header { display: flex; gap: .8rem; align-items: baseline;
  padding-bottom: .6rem; border-bottom: 1px solid var(--line); margin-bottom: .35rem; }
.num { font-variant-numeric: tabular-nums; font-size: .8rem; font-weight: 700;
  color: var(--accent); border: 1px solid var(--accent); border-radius: 50%;
  width: 1.6rem; height: 1.6rem; display: grid; place-items: center; flex: none; }
.phase h2 { font-size: 1.05rem; margin: 0; }
.span { color: var(--muted); font-size: .82rem; margin: .1rem 0 0; }
ol.milestones { list-style: none; margin: 0; padding: 0; }
li.month { font-size: .7rem; text-transform: uppercase; letter-spacing: .1em;
  color: var(--muted); margin: 1.1rem 0 .35rem; }
li.ms { display: grid; grid-template-columns: 1.5rem 8.5rem 1fr auto;
  gap: .1rem .7rem; align-items: baseline; padding: .55rem 0;
  border-bottom: 1px solid var(--line); }
li.ms:last-child { border-bottom: 0; }
li.is-undated { opacity: .78; }
.tick { align-self: center; }
.tick input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.tick span { display: block; width: 1.05rem; height: 1.05rem; border: 1.5px solid var(--line);
  border-radius: 4px; cursor: pointer; }
.tick input:checked + span { background: var(--accent); border-color: var(--accent); }
.tick input:checked + span::after { content: "✓"; color: var(--bg); font-size: .78rem;
  display: block; text-align: center; line-height: 1rem; }
li.ms:has(input:checked) .what h3 { text-decoration: line-through; color: var(--muted); }
.when { font-variant-numeric: tabular-nums; font-size: .88rem; color: var(--fg); white-space: nowrap; }
.approx { color: var(--muted); margin-left: .25rem; cursor: help; }
.latest { display: block; color: var(--muted); font-size: .76rem; cursor: help; }
.chip-missing { background: transparent; border: 1px dashed var(--accent); color: var(--accent); }
.missing { border: 1px dashed var(--line); border-radius: 6px; padding: 1rem 1.25rem; margin: 0 0 2rem; }
.missing h2 { font-size: .72rem; text-transform: uppercase; letter-spacing: .09em; margin: 0 0 .4rem; color: var(--accent); }
.missing .note { color: var(--muted); font-size: .86rem; margin: 0 0 .6rem; }
.missing ul { margin: 0; padding-left: 1.1rem; font-size: .9rem; }
.missing li { margin: .2rem 0; }
.links a { color: var(--accent); }
.links code { font-size: .82rem; }
.undated { color: var(--muted); font-style: italic; }
.what h3 { font-size: .97rem; font-weight: 600; margin: 0; }
.detail { color: var(--muted); font-size: .88rem; margin: .15rem 0 0; }
.why { color: var(--muted); font-size: .84rem; font-style: italic; margin: .2rem 0 0; }
.chip { background: var(--chip); color: var(--muted); border-radius: 999px;
  padding: .12rem .55rem; font-size: .74rem; white-space: nowrap; }
.chip-you { background: transparent; border: 1px dashed var(--line); }
.warnings { background: var(--warn-bg); color: var(--warn-fg); border-radius: 6px;
  padding: 1rem 1.25rem 1.1rem; margin: 0 0 2rem; }
.warnings h2 { font-size: .72rem; text-transform: uppercase; letter-spacing: .09em; margin: 0 0 .5rem; }
.warnings ol { margin: 0; padding-left: 1.1rem; }
.warnings li { margin: .35rem 0; font-size: .92rem; }
.cost { font-size: .82rem; margin: .2rem 0 0; font-variant-numeric: tabular-nums; color: var(--accent); }
.cost.muted { color: var(--muted); font-style: italic; }
.budget { background: var(--card); border: 1px solid var(--line); border-radius: 6px;
  padding: 1rem 1.25rem 1.1rem; margin: 0 0 2.5rem; }
.budget h2 { font-size: .72rem; text-transform: uppercase; letter-spacing: .09em; margin: 0 0 .5rem; color: var(--accent); }
.budget .yours { margin: 0 0 .6rem; font-weight: 600; }
.budget .note { color: var(--muted); font-size: .84rem; margin: 0 0 .8rem; }
.budget table { border-collapse: collapse; width: 100%; font-size: .9rem; font-variant-numeric: tabular-nums; }
.budget th { text-align: left; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
  font-weight: 600; padding: .3rem .5rem .3rem 0; border-bottom: 1px solid var(--line); }
.budget td { padding: .35rem .5rem .35rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.budget tr.owner td { font-weight: 600; padding-top: .7rem; }
.budget tr.line td:first-child { padding-left: 1rem; color: var(--muted); }
.budget tr.total td { font-weight: 700; border-bottom: 0; }
.budget .num { white-space: nowrap; }
.budget .envelopes { margin: 1rem 0 0; }
.budget .envelopes h3 { font-size: .8rem; margin: 0 0 .2rem; }
.budget .envelopes ul { margin: .3rem 0 0; padding-left: 1.1rem; font-size: .9rem; }
.sources { border-top: 1px solid var(--line); padding-top: 1rem; color: var(--muted); font-size: .84rem; }
.sources summary { cursor: pointer; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; }
.sources .note { font-style: italic; }
.sources dt { font-weight: 600; color: var(--fg); margin-top: .7rem; }
.sources dd { margin: .1rem 0 0; }
footer { color: var(--muted); font-size: .78rem; margin-top: 2.5rem; }
@media (max-width: 40rem) {
  li.ms { grid-template-columns: 1.5rem 1fr; }
  .when { grid-column: 2; font-weight: 600; }
  .what, .who { grid-column: 2; }
  .who { margin-top: .3rem; }
}
@media print {
  body { background: #fff; color: #000; padding: 0; }
  .tick span { border-color: #999; }
  .sources[open] { display: block; }
}
</style>
</head>
<body>
<main>
  <h1>${esc(meta.title)}</h1>
  <p class="sub">${esc(meta.projectType.toUpperCase())} · ${esc(L.streetDate)} <b>${esc(longDate(plan.streetDate, lang))} ${plan.streetDate.slice(0, 4)}</b> · ${esc(L.out(plan.daysOut))}${meta.markets.length ? ` · ${esc(meta.markets.join(", "))}` : ""}${meta.physical !== "none" ? ` · ${esc(meta.physical)}` : ""}</p>
${startBanner}
${warnings}
${budget}
${phases}
${missing}
${sources}
  <footer>${esc(L.generated)} ${esc(meta.generatedOn)}</footer>
</main>
</body>
</html>
`;
}

/**
 * The money section: the three tiers as a table with one row per department
 * and one per priced step, then the split when there is a budget. Sits above
 * the phases because "what do I need" is asked before "when".
 */
function renderBudget(v: BudgetView, lang: Lang, L: (typeof T)[Lang]): string {
  if (!v.lines.length) return "";
  const c = v.currency;
  const name = (o: string | null) => ownerName(o, lang);
  const free = lang === "fr" ? "gratuit" : "free";
  const cell = (t: Parameters<typeof totals>[0]) =>
    `<td class="num">${esc(Object.values(t).every((n) => n === 0) ? free : totals(t, lang))}</td>`;

  const rows: string[] = [];
  for (const o of v.byOwner) {
    const mine = v.lines.filter((l) => l.owner === o.owner);
    const priced = mine.some((l) => l.floor.length);
    rows.push(
      `      <tr class="owner"><td>${esc(name(o.owner))}</td>${priced ? cell(o.floor) + cell(o.aim) + cell(o.full) : `<td colspan="3" class="muted">${esc(L.noPrice)}</td>`}</tr>`,
    );
    for (const l of mine) {
      rows.push(
        l.floor.length
          ? `      <tr class="line"><td title="${esc(t(l.basis, lang))}">${esc(t(l.title, lang))}${l.sourced ? "" : " ≈"}</td>${cell(settle(l.floor, c))}${cell(settle(l.aim, c))}${cell(settle(l.full, c))}</tr>`
          : `      <tr class="line"><td>${esc(t(l.title, lang))}</td><td colspan="3" class="muted">${esc(t(l.noPriceReason ?? l.basis, lang))}</td></tr>`,
      );
    }
  }
  rows.push(`      <tr class="total"><td>Total</td>${cell(v.tiers.floor)}${cell(v.tiers.aim)}${cell(v.tiers.full)}</tr>`);

  const envelopes = v.envelopes.length
    ? `    <div class="envelopes">
      <h3>${esc(L.envelopes)}</h3>
      <p class="note">${esc(L.envelopeNote)}</p>
      <ul>
${v.envelopes.map((e) => `        <li><b>${esc(name(e.owner))}</b> — ${esc(money(e.amount, c, lang))} <span class="muted">(${esc(TIER_LABEL.floor[lang].toLowerCase())} ${esc(money(e.floor, c, lang))} · ${esc(TIER_LABEL.aim[lang].toLowerCase())} ${esc(money(e.aim, c, lang))})</span></li>`).join("\n")}
      </ul>
    </div>`
    : "";

  return `  <section class="budget">
    <h2>${esc(L.budget)}</h2>
    <p class="yours">${esc(v.budget ? L.budgetYours(money(v.budget.amount, v.budget.currency, lang)) : L.budgetNone)}</p>
    <p class="note">${esc(L.tierNote)}</p>
    <table>
      <thead><tr><th></th><th>${esc(TIER_LABEL.floor[lang])}</th><th>${esc(TIER_LABEL.aim[lang])}</th><th>${esc(TIER_LABEL.full[lang])}</th></tr></thead>
      <tbody>
${rows.join("\n")}
      </tbody>
    </table>
${envelopes}
  </section>`;
}

const DAY = 86400000;
const addISO = (iso: string, n: number) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const daysFromNow = (today: string, iso: string) =>
  Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY);
