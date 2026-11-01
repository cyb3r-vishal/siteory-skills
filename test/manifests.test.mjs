import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { MCP_URL } from "../cli/mcp-clients.mjs";
import { listSkills, parseFrontmatter } from "../cli/skills.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const json = (path) => JSON.parse(read(path));
const pkg = json("package.json");

const MANIFESTS = [
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".mcp.json",
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  ".cursor-plugin/plugin.json",
  ".cursor-plugin/marketplace.json",
  "gemini-extension.json",
];

test("every manifest is valid JSON named siteory at the package version", () => {
  for (const path of MANIFESTS) {
    const manifest = json(path);
    if (manifest.name !== undefined) assert.equal(manifest.name, "siteory", path);
    if (manifest.version !== undefined) assert.equal(manifest.version, pkg.version, path);
  }
});

test("every MCP entry points at the Siteory server", () => {
  assert.deepEqual(json(".mcp.json"), { mcpServers: { siteory: { type: "http", url: MCP_URL } } });
  assert.deepEqual(json("gemini-extension.json").mcpServers, { siteory: { httpUrl: MCP_URL } });
  const codex = json(".codex-plugin/plugin.json");
  assert.ok(existsSync(join(ROOT, codex.mcpServers)), codex.mcpServers);
  assert.equal(readFileSync(join(ROOT, codex.skills, "siteory", "SKILL.md"), "utf8").startsWith("---\n"), true);
  const yaml = read("skills/siteory/agents/openai.yaml");
  assert.ok(yaml.includes(`url: "${MCP_URL}"`));
  assert.match(yaml, /transport: "streamable_http"/);
  const short = yaml.match(/short_description: "([^"]+)"/)[1];
  assert.ok(short.length >= 25 && short.length <= 64, short);
});

test("marketplaces list the plugin at the repository root", () => {
  for (const path of [".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json"]) {
    const marketplace = json(path);
    assert.equal(marketplace.owner.name, "Siteory", path);
    assert.deepEqual(marketplace.plugins.map(({ name, source }) => ({ name, source })), [{ name: "siteory", source: "./" }], path);
  }
  const codex = json(".agents/plugins/marketplace.json");
  assert.equal(codex.plugins[0].source.url, "https://github.com/cyb3r-vishal/siteory-skills.git");
  assert.equal(`git+${codex.plugins[0].source.url}`, pkg.repository.url);
});

test("the Claude plugin keeps the layout claude.ai accepts", () => {
  const plugin = json(".claude-plugin/plugin.json");
  for (const field of ["description", "author", "homepage", "license", "privacyPolicyUrl"]) assert.ok(plugin[field], field);
  assert.ok(!existsSync(join(ROOT, "bin")), "a top-level bin/ blocks claude.ai and Cowork installs");
  assert.ok(!existsSync(join(ROOT, "CLAUDE.md")), "a root CLAUDE.md is not loaded for plugins");
});

test("package.json ships a zero-dependency CLI with the skills", () => {
  assert.equal(pkg.name, "siteory");
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.bin, { siteory: "cli/siteory.mjs" });
  assert.deepEqual(pkg.files, ["cli/", "skills/", "README.md", "LICENSE"]);
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.dependencies, undefined);
  assert.ok(read("cli/siteory.mjs").startsWith("#!/usr/bin/env node\n"));
  for (const skill of listSkills()) assert.ok(existsSync(join(skill.dir, "scripts", "siteory.mjs")), skill.name);
});

test("the license is proprietary everywhere it is declared", () => {
  const license = read("LICENSE");
  assert.ok(license.startsWith("Siteory License\n\nCopyright (c) 2026 Siteory. All rights reserved.\n"));
  assert.match(license, /requires an active paid Siteory plan/);
  assert.ok(license.includes("https://siteory.co/terms"));
  assert.equal(pkg.license, "SEE LICENSE IN LICENSE");
  for (const path of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) assert.equal(json(path).license, "Proprietary", path);
  for (const skill of listSkills()) {
    assert.equal(parseFrontmatter(readFileSync(join(skill.dir, "SKILL.md"), "utf8")).data.license, "Proprietary. See LICENSE.", skill.name);
  }
  assert.match(read("README.md"), /\n## License\n\nProprietary\./);
});

test("every skill says it needs a paid plan, how to sign in and what exit code 5 means", () => {
  for (const skill of listSkills()) {
    const section = readFileSync(join(skill.dir, "SKILL.md"), "utf8").match(/\n## Before you start\n([\s\S]*?)\n## /)?.[1];
    assert.ok(section, `${skill.name} has no "Before you start" section`);
    assert.match(section, /paid Siteory plan \(from \$9/, skill.name);
    assert.ok(section.includes("node \"<skill base dir>/scripts/siteory.mjs\" login"), skill.name);
    assert.match(section, /Exit code 5 .*not signed in or (?:the account )?has no paid plan.*stop/, skill.name);
  }
  assert.match(read("skills/siteory/references/output-schema.md"), /\n\| 5 \| Not signed in/);
});
