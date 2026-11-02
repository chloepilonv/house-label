/**
 * bun run website:deploy [--dir content/website] [--name <project>]
 *
 * Deploys the built page to the artist's own Vercel (VERCEL_TOKEN in .env.local)
 * and records the URL on artist.website. Two REST calls, no SDK: POST /v2/files
 * (by SHA-1), then POST /v13/deployments. Later deploys reuse
 * `artist.website.vercel_project_id`; a `domain` on that row is added once.
 * Docs: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openArtist } from "../../../../../data/artist/client";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const dir = opt("--dir", "content/website");
const file = join(dir, "index.html");

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("✗ Set VERCEL_TOKEN in .env.local — a token from https://vercel.com/account/tokens, the artist's own account.");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`✗ ${file} does not exist. Run \`bun run website:build --public\` first.`);
  process.exit(1);
}

const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
const api = async <T>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> => {
  const res = await fetch(`https://api.vercel.com${path}${path.includes("?") ? team.replace("?", "&") : team}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.raw ? {} : { "content-type": "application/json" }), ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };
  if (!res.ok) throw new Error(`Vercel ${res.status} ${path}: ${body.error?.message ?? body.error?.code ?? "unknown error"}`);
  return body;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const artist = await openArtist();
try {
  const profile = await artist.one("profile");
  const website = (await artist.one("website", { id: 1 })) ?? {};
  const name = opt("--name", (website.vercel_project_id ? null : null) ?? slug(String(profile?.artist_name ?? "artist-site")) || "artist-site");

  const bytes = readFileSync(file);
  const sha = createHash("sha1").update(bytes).digest("hex");
  console.log(`Uploading ${Math.round(bytes.byteLength / 1024)} KB (sha ${sha.slice(0, 8)})…`);
  await api("/v2/files", {
    method: "POST",
    raw: true,
    headers: { "content-type": "application/octet-stream", "x-vercel-digest": sha, "content-length": String(bytes.byteLength) },
    body: bytes,
  });

  const projectId = website.vercel_project_id ? String(website.vercel_project_id) : null;
  console.log(projectId ? `Deploying to project ${projectId}…` : `Creating project "${name}"…`);
  const dep = await api<{ id: string; url: string; projectId?: string; readyState?: string }>("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: projectId ?? name,
      ...(projectId ? { project: projectId } : {}),
      target: "production",
      files: [{ file: "index.html", sha, size: bytes.byteLength }],
      projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null },
    }),
  });

  // Poll until READY. A static file is usually ready in seconds.
  let state = dep.readyState ?? "QUEUED";
  for (let i = 0; i < 60 && !["READY", "ERROR", "CANCELED"].includes(state); i++) {
    await Bun.sleep(2000);
    state = (await api<{ readyState: string }>(`/v13/deployments/${dep.id}`)).readyState;
  }
  if (state !== "READY") throw new Error(`deployment ended in state ${state}`);

  const url = `https://${dep.url}`;
  const project = dep.projectId ?? projectId ?? null;
  await artist.upsert("website", { id: 1, vercel_project_id: project, vercel_url: url, last_deployed_at: new Date().toISOString() }, ["id"]);
  console.log(`\n✓ live: ${url}`);

  // The artist's own domain, once. Vercel answers with the DNS the artist sets.
  const domain = website.domain ? String(website.domain) : null;
  if (domain && project) {
    const have = await api<{ domains?: { name: string }[] }>(`/v9/projects/${project}/domains`);
    if (!have.domains?.some((d) => d.name === domain)) {
      const added = await api<{ name: string; verified?: boolean; verification?: { type: string; domain: string; value: string }[] }>(
        `/v10/projects/${project}/domains`,
        { method: "POST", body: JSON.stringify({ name: domain }) },
      );
      console.log(`\n${domain}: added to the project${added.verified ? ", verified" : ""}.`);
      for (const v of added.verification ?? []) console.log(`  set at the registrar: ${v.type} ${v.domain} → ${v.value}`);
      if (!added.verification?.length && !added.verified) console.log(`  point it: A record @ → 76.76.21.21, or CNAME www → cname.vercel-dns.com`);
    } else {
      console.log(`\n${domain}: already on the project — https://${domain}`);
    }
  }
} finally {
  await artist.close();
}
