import { defineConfig } from "vitepress";

// docs.houselabel.ai — built from doc/ with `bun run docs:build`.
// Three sections, in the order an artist meets them: Start, the Agents, AI 101.
export default defineConfig({
  title: "House Label",
  description: "A record label made of agents, for independent artists. Open source (AGPL-3.0).",
  lang: "en-CA",
  cleanUrls: true,
  appearance: true,
  lastUpdated: true,
  srcExclude: ["templates/**", "PRD.md", "KNOWLEDGE-HUB.md"],
  // ARCHITECTURE.md and DEVELOPMENT.md link to files in the repo (../AGENTS.md,
  // ../agents/README.md) — those are GitHub pages, not docs pages.
  ignoreDeadLinks: [/^\.\.?\/\.\.\//, /^\.\/\.\.\//],
  head: [
    ["link", { rel: "icon", href: "/favicon.svg" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    ["link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap" }],
  ],
  themeConfig: {
    siteTitle: "House Label",
    logo: { src: "/favicon.svg", width: 20, height: 20 },
    nav: [
      { text: "Start", link: "/" },
      { text: "Agents", link: "/agents/" },
      { text: "AI 101", link: "/ai-101/" },
      { text: "GitHub", link: "https://github.com/chloepilonv/house-label" },
    ],
    sidebar: [
      {
        text: "House Label",
        items: [
          { text: "Welcome to House Label", link: "/" },
          { text: "QuickStart", link: "/start/quickstart" },
          { text: "How it works", link: "/start/how-it-works" },
        ],
      },
      {
        text: "Agents",
        items: [
          { text: "The roster", link: "/agents/" },
          { text: "Label manager", link: "/agents/label-manager" },
          { text: "Distribution", link: "/agents/distribution" },
          { text: "Digital marketing", link: "/agents/digital-marketing" },
          { text: "Press", link: "/agents/press" },
          { text: "Promotion", link: "/agents/promotion" },
          { text: "Presskit", link: "/agents/presskit" },
          { text: "Rights", link: "/agents/rights" },
          { text: "Platforms", link: "/agents/platforms" },
        ],
      },
      {
        text: "AI 101",
        items: [
          { text: "What runs your label", link: "/ai-101/" },
          { text: "Providers, keys and cost", link: "/ai-101/providers" },
          { text: "Your data: where it lives", link: "/ai-101/your-data" },
          { text: "Our data: the catalog", link: "/ai-101/the-catalog" },
          { text: "What the agents never do", link: "/ai-101/limits" },
        ],
      },
      {
        text: "Contributors",
        collapsed: true,
        items: [
          { text: "Development", link: "/DEVELOPMENT" },
          { text: "Architecture", link: "/ARCHITECTURE" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/chloepilonv/house-label" }],
    footer: { message: "Beta · Quebec validated · Canada and the US next." },
    search: { provider: "local" },
    outline: [2, 3],
  },
});
