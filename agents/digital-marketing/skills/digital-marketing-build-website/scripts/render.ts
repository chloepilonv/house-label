/**
 * Site → HTML. One file, no build step: an artist site is a hub (one release,
 * one call to action, links out), so a single page deploys to Vercel as is.
 * `preview` draws a labelled dashed box per missing field; `public` draws nothing.
 * FR and EN share the page behind a toggle. The only external asset is Google Fonts.
 */
import type { Locale, Site, SiteRelease, SiteShow } from "./site";

export interface RenderOpts {
  mode: "preview" | "public";
  /** url → data URI (or a rewritten URL). Anything not in here is used as-is. */
  images?: Record<string, string>;
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** FR and EN, one visible at a time through `html[data-lang]`. */
const t = (en: string, fr: string): string => `<span class="en">${en}</span><span class="fr">${fr}</span>`;

const fmtDate = (d: string | null): string => {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : esc(d);
};

const fontsHref = (display: string, body: string): string => {
  const fam = (f: string, axes: string) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:${axes}`;
  const d = display === "Bricolage Grotesque" ? fam(display, "opsz,wght@12..96,300..800") : fam(display, "wght@400;500;600;700;800");
  const b = body === "Instrument Sans" ? fam(body, "ital,wght@0,400;0,500;0,600;1,400") : fam(body, "wght@400;500;600");
  return `https://fonts.googleapis.com/css2?${d}&${b}&display=swap`;
};

export function renderSite(site: Site, opts: RenderOpts): string {
  const images = opts.images ?? {};
  const img = (u: string | null): string | null => (u ? (images[u] ?? u) : null);
  const preview = opts.mode === "preview";
  /** A placeholder: dashed and labelled in preview, gone in public. */
  const ph = (inner: string, tag = "div", cls = "", style = ""): string =>
    preview ? `<${tag} class="ph ${cls}"${style ? ` style="${style}"` : ""}>${inner}</${tag}>` : "";
  const on = (section: string): boolean => site.sections[section] !== false;

  const th = site.theme;
  const name = esc(site.name || "—");
  const letters = [...(site.name || "—")].map((ch, i) => `<span style="--i:${i}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
  const hero = img(site.photos[0] ?? null);
  const genre = site.genres[0] ? esc(site.genres[0]) : "";
  const place = [site.city, site.region].filter(Boolean).map(esc).join(", ");

  // ── hero ────────────────────────────────────────────────────────────────
  const r = site.hero.release;
  const heroEyebrow = r
    ? r.upcoming
      ? t(`New ${esc(r.type)} · ${esc(r.date ?? "")}`, `Nouvel ${esc(r.type)} · ${esc(r.date ?? "")}`)
      : t(`Latest ${esc(r.type)}`, `Dernier ${esc(r.type)}`)
    : "";
  const ctaPresave = r?.upcoming
    ? site.hero.presave
      ? `<a class="btn gold" href="${esc(site.hero.presave)}" target="_blank" rel="noopener">${t("Pre-save", "Pré-sauvegarder")}</a>`
      : ph(`<a class="btn gold" href="#contact">${t("Pre-save", "Pré-sauvegarder")}</a>`, "span")
    : r?.link
      ? `<a class="btn gold" href="${esc(r.link)}" target="_blank" rel="noopener">${t("Listen", "Écouter")}</a>`
      : "";
  const ctaListen =
    r?.upcoming && site.hero.listen
      ? `<a class="btn ghost" href="${esc(site.hero.listen.url)}" target="_blank" rel="noopener">${t(`Listen to “${esc(site.hero.listen.title)}”`, `Écouter « ${esc(site.hero.listen.title)} »`)}</a>`
      : "";
  const heroBlock = r
    ? `<div class="release">
      <div class="eyebrow">${heroEyebrow}</div>
      <div class="name">${esc(r.title)}</div>
      <div class="meta">${[genre, place].filter(Boolean).join(" · ")}</div>
      <div class="cta-row">${ctaPresave}${ctaListen}</div>
    </div>`
    : ph(`<div class="release"><div class="name">${t("No release on file", "Aucune sortie au dossier")}</div></div>`);

  // ── music ───────────────────────────────────────────────────────────────
  const card = (x: SiteRelease): string => {
    const cover = img(x.cover);
    const art = cover
      ? `<div class="art"><img src="${esc(cover)}" alt=""><div class="hover">${x.link ? t("Listen ↗", "Écouter ↗") : ""}</div></div>`
      : x.upcoming
        ? `<div class="art ${preview ? "ph" : "soon"}"><div><div class="big">${esc(fmtDate(x.date).slice(0, 5))}<br>${esc(x.year ?? "")}</div><div class="sm">${t("artwork to come", "pochette à venir")}</div></div></div>`
        : `<div class="art ${preview ? "ph" : "soon"}"><div><div class="sm">${t("no artwork", "sans pochette")}</div></div></div>`;
    const inner = `${art}<div class="t">${esc(x.title)}</div><div class="m">${esc(x.type)}${x.year ? ` · ${esc(x.year)}` : ""}</div>`;
    return x.link
      ? `<a class="rel${x.upcoming ? " upcoming" : ""}" href="${esc(x.link)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="rel${x.upcoming ? " upcoming" : ""}">${inner}</div>`;
  };
  const music = site.releases.length
    ? `<div class="grid reveal">${site.releases.map(card).join("")}</div>`
    : ph(`<div class="widget"><b>${t("No releases on file", "Aucune sortie au dossier")}</b></div>`);

  // ── shows ───────────────────────────────────────────────────────────────
  const showLi = (x: SiteShow) => `<li><span class="d">${fmtDate(x.date)}</span><span class="v">${esc(x.venue)}</span><span class="c">${esc(x.city ?? "")}</span></li>`;
  const upcoming = site.shows.upcoming.length
    ? `<ul class="show-list">${site.shows.upcoming.map(showLi).join("")}</ul>`
    : site.shows.widget
      ? `<a class="bit-widget-initializer" data-artist-name="${esc(site.shows.widget)}" data-display-local-dates="false" data-display-past-dates="false" data-auto-style="true"></a><script defer src="https://widgetv3.bandsintown.com/main.min.js"></script>`
      : preview
        ? ph(`<div><b>${t("No dates announced", "Aucune date annoncée")}</b>${t("The Bandsintown widget renders here once an artist name is on file.", "Le widget Bandsintown s'affiche ici dès qu'un nom d'artiste est enregistré.")}</div><a class="btn ghost" href="#contact">${t(`Book ${name}`, `Booker ${name}`)}</a>`, "div", "widget")
        : `<div class="widget"><div><b>${t("No dates announced", "Aucune date annoncée")}</b></div><a class="btn ghost" href="#contact">${t(`Book ${name}`, `Booker ${name}`)}</a></div>`;
  const past = site.shows.past.length
    ? `<ul class="show-list">${site.shows.past.slice(0, 8).map(showLi).join("")}</ul>`
    : ph(`<div class="widget"><b>${t("No past shows on file", "Aucun spectacle passé au dossier")}</b></div>`);
  const ticker = site.shows.cities.length
    ? `<div class="ticker" aria-hidden="true"><div class="track">${[...site.shows.cities, ...site.shows.cities].map((c) => `<span>${esc(c)}</span>`).join("")}</div></div>`
    : "";

  // ── bio ─────────────────────────────────────────────────────────────────
  const bioFor = (l: Locale): string => {
    const lead = site.bio.lead[l] ? `<p class="lead">${esc(site.bio.lead[l])}</p>` : "";
    const text = site.bio.text[l];
    if (text) return `${lead}${text.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("")}`;
    const other = l === "en" ? "fr" : "en";
    const msg = l === "en" ? "The English biography is not on file yet." : "La biographie en français n'est pas encore au dossier.";
    return lead + (site.bio.text[other] ? ph(`<p>${msg}</p>`, "div", "", "padding:22px 24px;color:var(--ink-2)") : ph(`<p>${msg}</p>`, "div", "", "padding:22px 24px;color:var(--ink-2)"));
  };
  const facts = `<div class="facts">
    ${place ? `<div><div class="k">${t("Based in", "Basée à")}</div><div class="v">${place}</div></div>` : ""}
    ${site.markets.length ? `<div><div class="k">${t("Markets", "Marchés")}</div><div class="v">${site.markets.map(esc).join(" · ")}</div></div>` : ""}
    ${site.releases.length ? `<div><div class="k">${t("Releases", "Sorties")}</div><div class="v">${site.releases.length}</div></div>` : ""}
    ${site.roles.length ? `<div><div class="k">${t("Roles", "Rôles")}</div><div class="v">${t(site.roles.map((x) => esc(x.en)).join(" · "), site.roles.map((x) => esc(x.fr)).join(" · "))}</div></div>` : ""}
  </div>`;
  const gallery = site.photos.length > 1
    ? `<div class="gallery">${site.photos.slice(1, 4).map((p) => `<figure><img src="${esc(img(p))}" alt="${name}"></figure>`).join("")}</div>`
    : ph(`<div class="widget"><b>${t("Photos", "Photos")}</b>${t("Drop them in Drive › Artist › Photos.", "Dépose-les dans Drive › Artist › Photos.")}</div>`, "div", "gallery");

  // ── press ───────────────────────────────────────────────────────────────
  const quotes = site.press.quotes.slice(0, 4).map(
    (q) => `<div class="quote"><blockquote>${esc(q.text)}</blockquote><cite><span>${esc(q.source)}</span>${q.url ? `<a href="${esc(q.url)}" target="_blank" rel="noopener">${t("Read", "Lire")}</a>` : ""}</cite></div>`,
  );
  const clippingsOnly = site.press.clippings.filter((c) => !site.press.quotes.some((q) => q.url && q.url === c.url)).slice(0, 4).map(
    (c) => `<div class="quote"><blockquote>${esc(c.title)}</blockquote><cite><span>${esc(c.outlet ?? "")}</span>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${t("Read the article", "Lire l'article")}</a>` : ""}</cite></div>`,
  );
  const pressCards = [...quotes, ...clippingsOnly];
  const awards = site.press.awards.map(
    (a) => `<div class="award reveal"><div class="yr">${esc(a.year ?? "")}</div><div><div class="w">${esc(a.title)}</div>${a.organization ? `<div class="o">${esc(a.organization)}</div>` : ""}</div></div>`,
  ).join("");
  const press = pressCards.length
    ? `<div class="press reveal">${pressCards.join("")}</div>${awards}`
    : ph(`<div class="widget"><b>${t("No press on file", "Aucune presse au dossier")}</b></div>`) + awards;

  // ── store ───────────────────────────────────────────────────────────────
  const storeUrl = site.store.url ?? site.store.bandcamp;
  const storeItems = ["Vinyle", "T-shirt", "Affiche"].map((x) => ph(`<div><b>${x}</b>${t("Title, price and photo come from the store.", "Titre, prix et photo viendront de la boutique.")}</div>`, "div", "item")).join("");
  const store =
    on("store") && (site.store.url || preview)
      ? `<section id="store"><div class="wrap">
      <div class="sec-head reveal"><h2>${t("Store", "Boutique")}</h2>${storeUrl ? `<a class="btn ghost" href="${esc(storeUrl)}" target="_blank" rel="noopener">${t("See everything", "Tout voir")} ↗</a>` : ""}</div>
      ${preview ? `<div class="merch reveal">${storeItems}</div>` : ""}
    </div></section>`
      : "";

  // ── contact ─────────────────────────────────────────────────────────────
  const team = site.contact.team.map(
    (m) => `<li><span class="r">${esc(m.role)}</span>${m.email ? `<a class="e" href="mailto:${esc(m.email)}">${esc(m.name ?? m.email)}</a>` : `<span class="e">${esc(m.name ?? "")}</span>`}</li>`,
  );
  if (site.contact.emails.booking) team.unshift(`<li><span class="r">Booking</span><a class="e" href="mailto:${esc(site.contact.emails.booking)}">${esc(site.contact.emails.booking)}</a></li>`);
  if (!team.length && site.contact.emails.contact) team.push(`<li><span class="r">Contact</span><a class="e" href="mailto:${esc(site.contact.emails.contact)}">${esc(site.contact.emails.contact)}</a></li>`);
  const teamList = team.length ? `<ul class="team">${team.join("")}</ul>` : ph(`<div class="widget"><b>${t("No contact on file", "Aucun contact au dossier")}</b></div>`);
  const presskit = site.contact.presskit ? `<div style="margin-top:22px"><a class="btn ghost" href="${esc(site.contact.presskit)}" target="_blank" rel="noopener">Presskit ↗</a></div>` : "";
  const newsletter = site.contact.newsletter
    ? `<a class="btn gold" href="${esc(site.contact.newsletter)}" target="_blank" rel="noopener">${t("Subscribe", "S'abonner")}</a>`
    : ph(`<a class="btn gold" href="#contact">${t("Subscribe", "S'abonner")}</a>`, "span");
  const sms = site.contact.sms
    ? `<a class="btn ghost" href="${esc(site.contact.sms)}" target="_blank" rel="noopener">SMS / WhatsApp</a>`
    : ph(`<span style="font-size:13px;color:var(--ink-2)">${t("SMS / WhatsApp: no channel on file.", "SMS / WhatsApp : aucun canal enregistré.")}</span>`, "div", "", "padding:14px 18px");
  const socials = site.contact.socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join("");

  const navStore = storeUrl ? `<li><a href="${esc(storeUrl)}" target="_blank" rel="noopener">${t("Store", "Boutique")} ↗</a></li>` : "";

  return `<title>${name}</title>
<meta name="description" content="${name}${genre ? ` · ${genre}` : ""}${place ? ` · ${place}` : ""}">
<link rel="stylesheet" href="${fontsHref(th.fontDisplay, th.fontBody)}">
<style>
  :root{
    --ground:${th.background}; --ink:${th.text}; --gold:${th.accent};
    --surface:color-mix(in srgb,var(--ground) 93%,var(--ink)); --line:color-mix(in srgb,var(--ground) 86%,var(--ink));
    --ink-2:color-mix(in srgb,var(--ink) 64%,var(--ground)); --ink-3:color-mix(in srgb,var(--ink) 42%,var(--ground));
    --gold-deep:color-mix(in srgb,var(--gold) 68%,var(--ground)); --gold-ink:var(--ground);
    --display:"${esc(th.fontDisplay)}","Helvetica Neue",Arial,sans-serif; --body:"${esc(th.fontBody)}","Helvetica Neue",Arial,sans-serif;
    --max:1240px; --pad:clamp(20px,4vw,56px);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:var(--ground);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  a{color:inherit;text-decoration:none} img{display:block;max-width:100%}
  ::selection{background:var(--gold);color:var(--gold-ink)} :focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  html[data-lang="fr"] .en{display:none!important} html[data-lang="en"] .fr{display:none!important}
  .eyebrow{font-weight:600;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
  h2{font-family:var(--display);font-weight:700;font-variation-settings:"opsz" 96;font-size:clamp(40px,7vw,96px);line-height:.92;letter-spacing:-.025em;text-wrap:balance}
  h3{font-family:var(--display);font-weight:600;font-size:clamp(20px,2.4vw,28px);line-height:1.05;letter-spacing:-.01em}
  .wrap{max-width:var(--max);margin:0 auto;padding:0 var(--pad)}
  section{padding:clamp(72px,10vw,140px) 0;border-top:1px solid var(--line)}
  .sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:clamp(32px,5vw,64px);flex-wrap:wrap}
  .sec-head p{color:var(--ink-2);max-width:42ch}
${preview ? `  .ph{position:relative;border:1px dashed var(--gold-deep);border-radius:4px}
  .ph::after{content:"to be completed";position:absolute;top:-9px;right:12px;background:var(--ground);padding:0 6px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep)}
  html[data-lang="fr"] .ph::after{content:"à compléter"}
  span.ph{display:inline-flex}` : ""}
  nav{position:fixed;inset:0 0 auto 0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:18px var(--pad);mix-blend-mode:difference;color:#fff}
  nav .brand{font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase}
  nav ul{display:flex;gap:clamp(14px,2.4vw,32px);list-style:none;align-items:center}
  nav li a{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding:6px 0;border-bottom:1px solid transparent}
  nav li a:hover{border-bottom-color:#fff}
  nav .lang{display:flex;border:1px solid rgba(255,255,255,.45);border-radius:999px;overflow:hidden}
  nav .lang button{background:none;border:0;color:inherit;font:inherit;font-size:11px;font-weight:600;letter-spacing:.14em;padding:5px 10px;cursor:pointer}
  nav .lang button[aria-pressed="true"]{background:#fff;color:#000}
  @media (max-width:720px){nav ul li:not(.keep){display:none}}
  .hero{position:relative;min-height:88svh;display:flex;align-items:flex-end;overflow:hidden;isolation:isolate}
  .hero .bg{position:absolute;inset:-6% 0 0 0;z-index:-2;background:${hero ? `url("${esc(hero)}") center 18%/cover no-repeat` : "radial-gradient(120% 80% at 70% 20%,var(--surface),var(--ground))"};animation:drift 22s ease-in-out infinite alternate;transform-origin:center 30%}
  @keyframes drift{from{transform:scale(1.02)}to{transform:scale(1.1) translateY(-2%)}}
  .hero .veil{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,color-mix(in srgb,var(--ground) 15%,transparent) 0%,color-mix(in srgb,var(--ground) 5%,transparent) 35%,color-mix(in srgb,var(--ground) 75%,transparent) 72%,var(--ground) 100%)}
  .hero .grain{position:absolute;inset:0;z-index:-1;opacity:.14;mix-blend-mode:overlay;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
  .hero .wrap{width:100%;padding-bottom:clamp(36px,6vw,72px);display:grid;grid-template-columns:1fr auto;align-items:end;gap:32px}
  .title{font-family:var(--display);font-weight:800;font-variation-settings:"opsz" 96;font-size:clamp(64px,15.5vw,236px);line-height:.82;letter-spacing:-.04em;text-transform:uppercase;display:flex;flex-wrap:wrap}
  .title span{display:inline-block;animation:rise .9s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * 45ms)}
  @keyframes rise{from{transform:translateY(.35em) skewY(3deg)}to{transform:none}}
  .hero .release{display:grid;gap:14px;justify-items:start;max-width:360px}
  .hero .release .name{font-family:var(--display);font-weight:500;font-size:clamp(22px,2.6vw,30px);line-height:1.05;letter-spacing:-.01em}
  .hero .release .meta{color:var(--ink-2);font-size:14px}
  .btn{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;border:1px solid var(--ink);transition:transform .25s,background .25s,color .25s;cursor:pointer;font-family:var(--body)}
  .btn:hover{transform:translateY(-2px)}
  .btn.gold{background:var(--gold);border-color:var(--gold);color:var(--gold-ink)} .btn.gold:hover{background:var(--ink);border-color:var(--ink)}
  .btn.ghost:hover{background:var(--ink);color:var(--ground)}
  .cta-row{display:flex;gap:10px;flex-wrap:wrap}
  @media (max-width:860px){.hero .wrap{grid-template-columns:1fr}}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:clamp(14px,2vw,28px)}
  .rel{display:grid;gap:12px}
  .rel .art{aspect-ratio:1;overflow:hidden;background:var(--surface);position:relative}
  .rel .art img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
  .rel:hover .art img{transform:scale(1.05)}
  .rel .art .hover{position:absolute;inset:auto 0 0 0;padding:12px;background:linear-gradient(0deg,color-mix(in srgb,var(--ground) 85%,transparent),transparent);font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;opacity:0;transform:translateY(6px);transition:.3s}
  .rel:hover .art .hover{opacity:1;transform:none}
  .rel .t{font-family:var(--display);font-weight:600;font-size:17px;line-height:1.1;letter-spacing:-.01em}
  .rel .m{color:var(--ink-3);font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-variant-numeric:tabular-nums}
  .rel .art.ph,.rel .art.soon{display:grid;place-items:center;text-align:center;padding:20px}
  .rel .art .big{font-family:var(--display);font-weight:800;font-size:clamp(40px,4vw,56px);line-height:.9;letter-spacing:-.03em;color:var(--gold)}
  .rel .art .sm{color:var(--ink-2);font-size:12px;margin-top:10px;letter-spacing:.1em;text-transform:uppercase}
  .shows{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(32px,5vw,80px)}
  .show-list{list-style:none;display:grid}
  .show-list li{display:grid;grid-template-columns:118px 1fr auto;gap:18px;align-items:baseline;padding:16px 0;border-top:1px solid var(--line)}
  .show-list li:last-child{border-bottom:1px solid var(--line)}
  .show-list .d{font-variant-numeric:tabular-nums;color:var(--ink-2);font-size:13px;letter-spacing:.06em}
  .show-list .v{font-family:var(--display);font-weight:600;font-size:18px;letter-spacing:-.01em}
  .show-list .c{color:var(--ink-2);font-size:13px;text-align:right;white-space:nowrap}
  .widget{min-height:200px;display:grid;place-items:center;text-align:center;padding:32px;color:var(--ink-2);gap:14px}
  .widget b{color:var(--ink);font-family:var(--display);font-size:22px;font-weight:600;display:block;margin-bottom:6px}
  @media (max-width:860px){.shows{grid-template-columns:1fr}.show-list li{grid-template-columns:96px 1fr}.show-list .c{grid-column:2;text-align:left}}
  .ticker{overflow:hidden;border-block:1px solid var(--line);padding:18px 0;margin-top:clamp(48px,6vw,88px);white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
  .ticker .track{display:inline-flex;animation:scroll 48s linear infinite}
  .ticker span{font-family:var(--display);font-weight:700;font-size:clamp(28px,4vw,48px);letter-spacing:-.02em;padding:0 22px;color:var(--ink-3)}
  .ticker span::after{content:"•";color:var(--gold);margin-left:44px}
  @keyframes scroll{to{transform:translateX(-50%)}}
  .bio{display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,5vw,80px);align-items:start}
  .bio .text p{font-size:17px;max-width:60ch} .bio .text p+p{margin-top:1.2em}
  .bio .text .lead{font-family:var(--display);font-size:clamp(22px,2.4vw,30px);font-weight:500;line-height:1.25;letter-spacing:-.015em;margin-bottom:28px;text-wrap:balance}
  .facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);margin-top:36px}
  .facts div{background:var(--ground);padding:18px 20px}
  .facts .k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
  .facts .v{font-family:var(--display);font-weight:600;font-size:19px;letter-spacing:-.01em}
  .gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px;position:sticky;top:96px}
  .gallery figure{overflow:hidden;background:var(--surface)}
  .gallery figure:first-child{grid-column:1/-1;aspect-ratio:4/3} .gallery figure:not(:first-child){aspect-ratio:1}
  .gallery img{width:100%;height:100%;object-fit:cover;transition:transform 1s} .gallery figure:hover img{transform:scale(1.04)}
  @media (max-width:860px){.bio{grid-template-columns:1fr}.gallery{position:static}}
  .press{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,3vw,40px)}
  .quote{padding:32px;border:1px solid var(--line);display:grid;gap:22px;align-content:space-between;min-height:240px}
  .quote blockquote{font-family:var(--display);font-weight:500;font-size:clamp(20px,2.1vw,26px);line-height:1.25;letter-spacing:-.015em;text-wrap:balance}
  .quote blockquote::before{content:"« ";color:var(--gold)} .quote blockquote::after{content:" »";color:var(--gold)}
  .quote cite{font-style:normal;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);display:flex;justify-content:space-between;gap:12px}
  .quote cite a{border-bottom:1px solid var(--gold-deep)}
  .award{margin-top:clamp(20px,3vw,40px);display:flex;align-items:center;gap:20px;padding:22px 28px;background:var(--surface);border-left:3px solid var(--gold)}
  .award .yr{font-family:var(--display);font-weight:800;font-size:40px;letter-spacing:-.03em;color:var(--gold);font-variant-numeric:tabular-nums}
  .award .w{font-family:var(--display);font-weight:600;font-size:19px} .award .o{color:var(--ink-2);font-size:13px}
  @media (max-width:720px){.press{grid-template-columns:1fr}}
  .merch{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(14px,2vw,28px)}
  .item{aspect-ratio:4/5;display:grid;place-items:center;text-align:center;padding:24px;color:var(--ink-3);font-size:13px;line-height:1.5}
  .item b{display:block;color:var(--ink-2);font-family:var(--display);font-size:20px;font-weight:600;margin-bottom:8px}
  @media (max-width:720px){.merch{grid-template-columns:1fr}}
  .contact{display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,5vw,80px)}
  .team{list-style:none;display:grid}
  .team li{display:grid;grid-template-columns:1fr auto;gap:16px;padding:14px 0;border-top:1px solid var(--line);align-items:baseline}
  .team li:last-child{border-bottom:1px solid var(--line)}
  .team .r{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3)}
  .team .e{font-family:var(--display);font-weight:500;font-size:16px} .team a.e:hover{color:var(--gold)}
  .signup{display:grid;gap:18px;align-content:start}
  .socials{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .socials a{padding:9px 14px;border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;transition:.25s}
  .socials a:hover{border-color:var(--gold);color:var(--gold)}
  @media (max-width:860px){.contact{grid-template-columns:1fr}}
  footer{border-top:1px solid var(--line);padding:40px 0 60px;color:var(--ink-3);font-size:12px}
  footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:center}
  .reveal{transform:translateY(28px);transition:transform 1s cubic-bezier(.2,.8,.2,1)} .reveal.in{transform:none}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.reveal{transform:none}}
</style>

<nav aria-label="main">
  <a class="brand" href="#top">${name}</a>
  <ul>
    <li><a href="#music">${t("Music", "Musique")}</a></li>
    <li><a href="#shows">${t("Shows", "Spectacles")}</a></li>
    <li><a href="#bio">Bio</a></li>
    ${navStore}
    <li><a href="#contact">Contact</a></li>
    <li class="keep"><div class="lang" role="group" aria-label="Language"><button type="button" data-set="fr" aria-pressed="${site.locale === "fr"}">FR</button><button type="button" data-set="en" aria-pressed="${site.locale === "en"}">EN</button></div></li>
  </ul>
</nav>

<header class="hero" id="top">
  <div class="bg" role="img" aria-label="${name}"></div>
  <div class="veil"></div><div class="grain"></div>
  <div class="wrap">
    <h1 class="title" aria-label="${name}">${letters}</h1>
    ${heroBlock}
  </div>
</header>

<section id="music"><div class="wrap">
  <div class="sec-head reveal"><h2>${t("Music", "Musique")}</h2></div>
  ${music}
</div></section>

<section id="shows">
  <div class="wrap">
    <div class="sec-head reveal"><h2>${t("Shows", "Spectacles")}</h2></div>
    <div class="shows reveal">
      <div><div class="eyebrow" style="margin-bottom:14px">${t("Upcoming", "À venir")}</div>${upcoming}</div>
      <div><div class="eyebrow" style="margin-bottom:14px">${t("Past", "Passés")}</div>${past}</div>
    </div>
  </div>
  ${ticker}
</section>

<section id="bio"><div class="wrap">
  <div class="sec-head reveal"><h2>${t("Biography", "Biographie")}</h2></div>
  <div class="bio reveal">
    <div class="text"><div class="en">${bioFor("en")}</div><div class="fr">${bioFor("fr")}</div>${facts}</div>
    ${gallery}
  </div>
</div></section>

${on("press") ? `<section id="press"><div class="wrap">
  <div class="sec-head reveal"><h2>${t("Press", "Presse")}</h2></div>
  ${press}
</div></section>` : ""}

${store}

<section id="contact"><div class="wrap">
  <div class="sec-head reveal"><h2>Contact</h2></div>
  <div class="contact reveal">
    <div><div class="eyebrow" style="margin-bottom:14px">${t("Team", "Équipe")}</div>${teamList}${presskit}</div>
    <div class="signup">
      <div class="eyebrow">${t("Newsletter", "Infolettre")}</div>
      <h3>${t("The next release, before everyone else.", "La prochaine sortie, avant tout le monde.")}</h3>
      <div class="cta-row">${newsletter}${sms}</div>
      <div class="socials">${socials}</div>
    </div>
  </div>
</div></section>

<footer><div class="wrap">
  <div>© ${new Date().getFullYear()} ${name}${preview ? ` · ${t("dashed = field to complete", "pointillé = champ à compléter")}` : ""}</div>
</div></footer>

<script>
  (function(){
    var root=document.documentElement, dflt=${JSON.stringify(site.locale)};
    var saved=null; try{saved=localStorage.getItem('site-lang')}catch(e){}
    function set(l){root.setAttribute('data-lang',l);root.lang=l;document.querySelectorAll('nav .lang button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.set===l))});try{localStorage.setItem('site-lang',l)}catch(e){}}
    set(saved==='en'||saved==='fr'?saved:dflt);
    document.querySelectorAll('nav .lang button').forEach(function(b){b.addEventListener('click',function(){set(b.dataset.set)})});
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
      document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)});
    }else{document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in')})}
  })();
</script>
`;
}

/** The full document `deploy.ts` ships. Artifacts wrap the fragment themselves. */
export function renderDocument(site: Site, opts: RenderOpts): string {
  return `<!doctype html>\n<html lang="${site.locale}" data-lang="${site.locale}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${renderSite(site, opts)}\n</head>\n<body></body>\n</html>\n`;
}
