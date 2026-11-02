/**
 * Reusable source scout — step 2 of the encadré crawl method.
 *
 * Fans out one agent per region, each of which must FETCH a candidate URL
 * before it may propose it, then dedupes the union into a proposal table.
 * It returns proposals; a human still approves them (see the gates in
 * agents/agent-recruitor/skills/recruit-dataset/SKILL.md).
 *
 *   Workflow({ name: "scout-sources", args: {
 *     topic:   "booking",
 *     have:    ["Le Ritz PDB", "Bar Le Ritz"],          // already in the catalog
 *     fields:  "capacity, booking contact, genres, whether it has a house PA",
 *     regions: [{ key: "qc", prompt: "Music venues in Montreal and Quebec City ..." }],
 *   }})
 *
 * Output feeds `bun run catalog:sources propose <file.json>` unchanged.
 */
export const meta = {
  name: 'scout-sources',
  description: 'Scout crawlable sources for a catalog dataset, one agent per region, every URL fetch-verified',
  whenToUse: 'Growing any data/catalog dataset: grants, venues, press. Step 2 of the encadré crawl method.',
  phases: [
    { title: 'Scout', detail: 'one agent per region; each verifies its own URLs' },
    { title: 'Merge', detail: 'dedupe against what the catalog already has' },
  ],
}

const topic = args?.topic ?? 'grants'
const have = args?.have ?? []
const fields = args?.fields ?? 'the programs or entities it lists'
const regions = args?.regions ?? []
if (!regions.length) throw new Error('scout-sources: args.regions is required — [{key, prompt}, ...]')

const SOURCE_SCHEMA = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'kebab-case slug, unique' },
          org_name: { type: 'string' },
          url: { type: 'string', description: 'the INDEX page listing entities — fetch-verified, never a homepage' },
          country: { type: 'string', enum: ['CA', 'US'] },
          region: { type: 'string', description: 'province/state code, city, or national' },
          language: { type: 'string', enum: ['en', 'fr', 'bilingual'] },
          trust: { type: 'integer', description: '1 official/major, 2 established, 3 other' },
          verified: { type: 'boolean', description: 'true ONLY if you fetched the URL and saw the list' },
          note: { type: 'string', description: 'what the page shows; flag JS-rendered lists, 403s, or pagination' },
        },
        required: ['id', 'org_name', 'url', 'country', 'region', 'language', 'trust', 'verified', 'note'],
      },
    },
    excluded: {
      type: 'array',
      items: {
        type: 'object',
        properties: { org_name: { type: 'string' }, reason: { type: 'string' } },
        required: ['org_name', 'reason'],
      },
    },
  },
  required: ['sources', 'excluded'],
}

phase('Scout')
const scouted = await parallel(
  regions.map((r) => () =>
    agent(
      `Scout ${topic} sources for a crawlable catalogue.\n\n` +
      `REGION / SEGMENT: ${r.prompt}\n\n` +
      (have.length ? `ALREADY IN THE CATALOGUE — do not propose these again: ${have.join(', ')}.\n\n` : '') +
      `For each organization you propose:\n` +
      `1. Find the page that LISTS what we want to crawl (${fields}) — an index page, not a homepage, not a single entry.\n` +
      `2. ACTUALLY FETCH that URL and confirm it renders the list. Set verified=true only if you saw it.\n` +
      `3. If it 403s, 404s, or renders empty because the list is JavaScript-driven, still include it with ` +
      `verified=false and say so in the note — those get a browser-based engine rather than the free fetch path.\n` +
      `4. Propose ONLY organizations that hold and award the money themselves. An industry ` +
      `association, newsletter, or portal that LISTS other organizations' opportunities is an ` +
      `aggregator — put it in excluded with that reason, however good its page looks.\n` +
      `5. Note anything the crawler must know: pagination, a user-agent block, a discipline filter to apply, ` +
      `or that details live one hop deeper on child pages.\n\n` +
      `Never invent a URL. A URL you did not fetch does not ship. Four verified sources beat twelve guesses.`,
      { label: `scout:${r.key}`, phase: 'Scout', schema: SOURCE_SCHEMA },
    ),
  ),
)

const all = scouted.filter(Boolean).flatMap((s) => s.sources ?? [])
const excluded = scouted.filter(Boolean).flatMap((s) => s.excluded ?? [])
log(`${all.length} candidates from ${scouted.filter(Boolean).length}/${regions.length} regions`)

phase('Merge')
const merged = await agent(
  `Clean this scouted ${topic} source list.\n\nCANDIDATES:\n${JSON.stringify(all, null, 1)}\n\n` +
  `1. Remove duplicate organizations (same org under two ids or URLs) — keep the better index URL.\n` +
  (have.length ? `2. Remove anything already covered by: ${have.join(', ')}.\n` : '2. —\n') +
  `3. Remove aggregators, blogs and listicles — we crawl primary sources only.\n` +
  `4. Make every id unique and kebab-case.\n` +
  `5. Sort verified first, then trust ascending, then country.\n` +
  `Keep every note: it tells the crawler which engine each page needs.`,
  { label: 'merge+dedupe', phase: 'Merge', schema: SOURCE_SCHEMA },
)

const final = merged?.sources ?? all
return {
  topic,
  proposed: final,
  counts: {
    scouted: all.length,
    after_dedupe: final.length,
    verified: final.filter((s) => s.verified).length,
    needs_browser_engine: final.filter((s) => !s.verified).length,
  },
  excluded,
  next: `Save proposed[] to a .json file, then: bun run catalog:sources propose <file> && bun run catalog:sources approve <ids>`,
}
