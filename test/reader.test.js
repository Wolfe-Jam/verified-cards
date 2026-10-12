import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderBusinessCard } from "agent-business-card";
import { parseRepoInput, buildCard, oneLine } from "../reader.js";

const ref = { owner: "acme", repo: "weather" };
const gh = { name: "weather", description: "Forecasts on request.", default_branch: "main", license: { spdx_id: "MIT" }, homepage: "", topics: ["mcp"] };
const card = (src) => buildCard({ ref, gh, ...src }, { escapeHtml });

test("parseRepoInput: owner/repo, URLs, junk", () => {
  assert.deepEqual(parseRepoInput("acme/weather"), ref);
  assert.deepEqual(parseRepoInput("https://github.com/acme/weather"), ref);
  assert.deepEqual(parseRepoInput("github.com/acme/weather.git/"), ref);
  assert.deepEqual(parseRepoInput("https://github.com/acme/weather/tree/main/src"), ref);
  assert.equal(parseRepoInput("acme"), null);
  assert.equal(parseRepoInput("https://gitlab.com/acme/weather"), null);
  assert.equal(parseRepoInput("../etc"), null);
});

test("public data only: says so, Repository title, no colour (ink)", () => {
  const c = card({});
  assert.equal(c.name, "weather");
  assert.equal(c.title, "Repository");
  assert.equal(c.oneLiner, "Forecasts on request.");
  assert.equal(c.domain, "github.com/acme");
  assert.deepEqual(c.chips, [{ text: "public data" }, { text: "MIT" }]);
  assert.equal(c.accent, undefined);
  assert.match(c.about, /Not endorsed by the owner/);
});

test("trust order: .fafa beats server.json beats package.json beats GitHub", () => {
  const c = card({
    fafa: { agent: { displayName: "Weather Agent", description: "From the fafa.", version: "2.0.0", license: "Apache-2.0" }, metadata: { cards: { accent: "#0066cc" } } },
    fafaPath: ".well-known/fafa",
    serverJson: { name: "io.github.acme/weather", description: "From server.json.", version: "1.0.0" },
    pkg: { name: "weather", description: "From package.json.", version: "0.9.0" },
  });
  assert.equal(c.name, "Weather Agent");
  assert.equal(c.title, "MCP server · v2.0.0");
  assert.equal(c.oneLiner, "From the fafa.");
  assert.equal(c.accent, "#0066cc");
  assert.deepEqual(c.chips[0], { text: "claimed", accent: true });
  assert.ok(c.chips.some((x) => x.text === "Apache-2.0"));
  assert.match(c.about, /owner's own/);
});

test("nothing guessed: no licence, no version → not drawn", () => {
  const c = card({ gh: { name: "bare", default_branch: "main" } });
  assert.equal(c.title, "Repository");
  assert.equal(c.oneLiner, undefined);
  assert.deepEqual(c.chips, [{ text: "public data" }]);
  assert.doesNotMatch(c.tabs[0].html, /Version|License/);
});

test("private package.json is not an npm package; release tag gives the version", () => {
  const c = card({ pkg: { name: "x", private: true, version: "9.9.9" }, release: "v1.2.3" });
  assert.equal(c.title, "Repository · v1.2.3");
});

test("everything from the repo is escaped; only http(s) links", () => {
  const c = card({ gh: { ...gh, description: "<img src=x onerror=alert(1)>", homepage: "javascript:alert(1)", topics: ["<b>"] } });
  const html = c.tabs.map((t) => t.html).join("");
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("&lt;b&gt;"));
});

test("a bad .fafa colour falls back to ink in the printed page", () => {
  const c = card({ fafa: { agent: { name: "w" }, metadata: { cards: { accent: "red;}</style>" } } } });
  const page = renderBusinessCard(c);
  assert.ok(!page.includes("red;}"));
  assert.match(page, /\.bcard\{--accent:var\(--fg\)\}/);
});

test("oneLine cuts at a word, without rewording", () => {
  const long = "Answers weather questions for any city on Earth, with hourly detail, alerts, and a week ahead, from public sources only.";
  const out = oneLine(long, 60);
  assert.ok(out.endsWith("…") && out.length <= 61);
  assert.ok(long.startsWith(out.slice(0, -1)));
});

test("prints a complete page", () => {
  assert.match(renderBusinessCard(card({})), /^<!doctype html>/);
});
