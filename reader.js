// Reads a repo's public files into a BusinessCard for agent-business-card.
// Pure: no fetching, no DOM. The page fetches; this decides what the card says.
//
// Trust order (highest first), every field traceable to one of these:
//   1. the owner's .fafa (.well-known/fafa or agent.fafa)
//   2. server.json (MCP Registry)
//   3. package.json
//   4. GitHub's repository data
// Nothing is guessed: a field no source gives is not drawn. No colour = ink.

/** "owner/repo", a GitHub URL, or "github.com/owner/repo" → { owner, repo } or null. */
export function parseRepoInput(input) {
  const s = String(input ?? "").trim().replace(/\/+$/, "").replace(/\.git$/, "");
  const m =
    s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:[/?#].*)?$/i) ??
    s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  const [owner, repo] = [m[1], m[2]];
  if (owner.startsWith(".") || repo.startsWith(".")) return null;
  return { owner, repo };
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const httpUrl = (v) => {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};

/** Cut a description to about one line for the front, at a word, without rewording it. */
export function oneLine(text, max = 120) {
  const t = str(text)?.replace(/\s+/g, " ");
  if (!t) return t;
  // A natural break first: the end of the first sentence, then a " — " aside.
  const sentence = t.match(/^.{20,}?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  const dash = t.indexOf(" — ");
  if (dash >= 20 && dash <= max) return t.slice(0, dash);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[\s,;:.—-]+$/, "") + "…";
}

/**
 * @param {object} src
 * @param {{owner:string, repo:string}} src.ref
 * @param {object} src.gh          GitHub /repos/{owner}/{repo} JSON
 * @param {string} [src.release]   latest release tag, if any
 * @param {object} [src.fafa]      parsed .fafa YAML
 * @param {string} [src.fafaPath]  where the .fafa was found
 * @param {object} [src.serverJson]
 * @param {object} [src.pkg]       package.json
 * @param {{escapeHtml:(s:string)=>string}} lib
 */
export function buildCard(src, { escapeHtml }) {
  const e = (s) => escapeHtml(String(s));
  const { ref, gh = {}, release, fafaPath } = src;
  const agent = src.fafa && typeof src.fafa.agent === "object" ? src.fafa.agent : {};
  const cards = src.fafa?.metadata?.cards ?? {};
  const sj = src.serverJson && typeof src.serverJson === "object" ? src.serverJson : {};
  const pkg = src.pkg && typeof src.pkg === "object" ? src.pkg : {};
  const claimed = Boolean(src.fafa);
  const repoUrl = `https://github.com/${ref.owner}/${ref.repo}`;

  const name = str(agent.displayName) ?? str(agent.name) ?? str(sj.title) ?? str(gh.name) ?? ref.repo;
  const description = str(agent.description) ?? str(sj.description) ?? str(pkg.description) ?? str(gh.description);
  const version =
    str(agent.version) ?? str(sj.version) ?? (pkg.private ? undefined : str(pkg.version)) ?? str(release)?.replace(/^v(?=\d)/, "");
  const kind = str(sj.name) ? "MCP server" : str(pkg.name) && !pkg.private ? "npm package" : "Repository";
  const license = str(agent.license) ?? str(pkg.license) ?? (gh.license?.spdx_id !== "NOASSERTION" ? str(gh.license?.spdx_id) : undefined);
  const homepage = httpUrl(gh.homepage) ?? httpUrl(sj.websiteUrl) ?? httpUrl(pkg.homepage);
  const domain = homepage ? new URL(homepage).host.replace(/^www\./, "") : `github.com/${ref.owner}`;

  const chips = [
    claimed ? { text: "claimed", accent: true } : { text: "public data" },
    ...(str(sj.name) ? [{ text: "MCP Registry" }] : []),
    ...(license ? [{ text: license }] : []),
  ];

  const link = (href, text) => `<a href="${e(href)}" target="_blank" rel="noopener">${e(text)}</a>`;
  const rows = [
    ["Repository", link(repoUrl, `${ref.owner}/${ref.repo}`)],
    str(agent.id) && ["Agent ID", `<code>${e(agent.id)}</code>`],
    str(agent.vendor) && ["Publisher", e(agent.vendor)],
    version && ["Version", `v${e(version)}`],
    license && ["License", e(license)],
    homepage && ["Homepage", link(homepage, homepage.replace(/^https?:\/\//, "").replace(/\/$/, ""))],
    str(sj.name) && ["MCP Registry", `<code>${e(sj.name)}</code>`],
    str(pkg.name) && !pkg.private && ["Package (npm)", `<code>${e(pkg.name)}</code>`],
    Array.isArray(gh.topics) && gh.topics.length && ["Topics", gh.topics.slice(0, 8).map((t) => `<span class="tag">${e(t)}</span>`).join(" ")],
  ].filter(Boolean);
  const aboutHtml =
    (description ? `<p class="lead">${e(description)}</p>` : `<p class="none">No description in the repo yet.</p>`) +
    `<table class="kv"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;

  const branch = str(gh.default_branch) ?? "main";
  const fileRow = (path, found) =>
    `<tr><td><code>${e(path)}</code></td><td>${found ? link(`${repoUrl}/blob/${branch}/${path}`, "read") : "not found"}</td></tr>`;
  const sourcesHtml = `<table class="disc"><thead><tr><th>source</th><th></th></tr></thead><tbody>${[
    fileRow(fafaPath ?? ".well-known/fafa", claimed),
    fileRow("server.json", Boolean(src.serverJson)),
    fileRow("package.json", Boolean(src.pkg)),
  ].join("")}<tr><td>GitHub repository data</td><td>${link(repoUrl, "read")}</td></tr></tbody></table>
  <p class="fetch">Every field on this business card comes from one of these. Nothing is guessed.</p>`;

  const about = claimed
    ? `<p class="whatis-head">Business Cards for Agents</p><p>Printed from the owner's own <code>.fafa</code> and the repo's public files.</p><p class="whatis-foot">Printed by <code>agent-business-card</code></p>`
    : `<p class="whatis-head">Business Cards for Agents</p><p>Printed from public GitHub data. Not endorsed by the owner.</p><p>Is this yours? Add a <code>.fafa</code> to make it yours.</p><p class="whatis-foot">Printed by <code>agent-business-card</code></p>`;

  return {
    name,
    title: version ? `${kind} · v${version}` : kind,
    ...(description ? { oneLiner: oneLine(description), description } : {}), // description: the full text, for the .fafa
    domain,
    chips,
    tabs: [
      { key: "about", label: "About", heading: "About", html: aboutHtml },
      { key: "sources", label: "Sources", heading: "Sources", html: sourcesHtml },
    ],
    about,
    ...(str(cards.accent) ? { accent: str(cards.accent) } : {}),
  };
}

/**
 * The .fafa an owner adds at .well-known/fafa to claim the business card. JSON
 * strings are valid YAML double-quoted scalars, so every value is quoted safely.
 * No colour means no metadata block: the business card prints in ink.
 */
export function fafaSnippet({ name, description, accent }) {
  const q = (v) => JSON.stringify(String(v));
  const lines = ['version: "1.0"', "agent:", `  name: ${q(name)}`];
  if (description) lines.push(`  description: ${q(description)}`);
  if (accent) lines.push("metadata:", "  cards:", `    accent: ${q(accent)}`);
  return lines.join("\n") + "\n";
}
