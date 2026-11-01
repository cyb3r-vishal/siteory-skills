import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { MCP_URL } from "../cli/mcp-clients.mjs";

const TMP = mkdtempSync(join(tmpdir(), "siteory-skills-test-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const CLI = fileURLToPath(new URL("../cli/siteory.mjs", import.meta.url));
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

function cli(args, env = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SITEORY_ENGINE: "", ...env } });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A stand-in engine that echoes its argv as JSON and exits with FAKE_EXIT. */
function fakeEngine(source) {
  const file = join(mkdtempSync(join(TMP, "siteory-engine-")), "engine.mjs");
  writeFileSync(file, source ?? `
export const VERSION = "test";
export async function runCli(argv) {
  if (process.env.FAKE_THROW) throw new Error("engine exploded");
  process.stdout.write(JSON.stringify(argv));
  return process.env.FAKE_EXIT === "nan" ? Number.NaN : Number(process.env.FAKE_EXIT ?? 0);
}
`);
  return file;
}

test("--version prints the package version", () => {
  for (const flag of ["--version", "-v"]) {
    const run = cli([flag]);
    assert.equal(run.code, 0);
    assert.equal(run.stdout.trim(), VERSION);
  }
});

test("help prints usage for the CLI and for each command", () => {
  for (const args of [[], ["help"], ["--help"], ["-h"]]) {
    const run = cli(args);
    assert.equal(run.code, 0, args.join(" "));
    assert.match(run.stdout, /siteory check <url> \[options\]/);
    assert.match(run.stdout, /Exit codes: 0 ok, 1 --fail-on threshold met/);
    for (const command of ["login", "whoami", "logout"]) assert.match(run.stdout, new RegExp(`^  siteory ${command} +\\w`, "m"), command);
    assert.match(run.stdout, /Checks need a paid Siteory plan/);
    assert.match(run.stdout, /5 not signed in or no paid plan\./);
  }
  assert.match(cli(["help", "setup"]).stdout, /--skills-only/);
  assert.match(cli(["setup", "--help"]).stdout, /--home <dir>/);
  assert.match(cli(["mcp", "-h"]).stdout, /Clients: claude-code, claude-ai, cursor/);
  assert.match(cli(["skills", "--help"]).stdout, /Usage: siteory skills/);
});

test("usage errors exit 2 with a hint", () => {
  for (const args of [["help", "nope"], ["setup", "--bogus"], ["setup", "stray"], ["mcp", "--client", "nope"], ["skills", "--json"], ["setup", "--home", "x", "--agent", "nope"]]) {
    const run = cli(args);
    assert.equal(run.code, 2, args.join(" "));
    assert.match(run.stderr, /Run "siteory help" for usage\./, args.join(" "));
  }
});

test("mcp prints a guide for every client, or for one", () => {
  const all = cli(["mcp"]);
  assert.equal(all.code, 0);
  for (const label of ["Claude Code", "claude.ai", "Cursor", "VS Code", "Codex", "ChatGPT", "Gemini CLI", "Antigravity", "OpenCode", "Windsurf", "Any other MCP client"]) {
    assert.ok(all.stdout.includes(`## ${label}`), label);
  }
  assert.ok(all.stdout.includes(`claude mcp add --transport http --scope user siteory ${MCP_URL}`));

  const one = cli(["mcp", "--client", "codex"]);
  assert.equal(one.code, 0);
  assert.match(one.stdout, /\[mcp_servers\.siteory\]\nurl = "https:\/\/api\.siteory\.co\/mcp"/);
  assert.doesNotMatch(one.stdout, /## Cursor/);
});

test("skills lists the bundled skills and their install folders", () => {
  const run = cli(["skills"]);
  assert.equal(run.code, 0);
  const names = ["siteory", "siteory-seo", "siteory-ai-visibility", "siteory-security", "siteory-performance", "siteory-accessibility", "siteory-structured-data", "siteory-links", "siteory-social", "siteory-launch"];
  for (const name of names) assert.match(run.stdout, new RegExp(`^  ${name} `, "m"));
  assert.match(run.stdout, /Claude Code +~\/\.claude\/skills/);
});

test("check hands the arguments to the engine and returns its exit code", () => {
  const engine = fakeEngine();
  const env = { SITEORY_ENGINE: engine, FAKE_EXIT: "3" };
  const cases = [
    [["check", "http://localhost:3000", "--json"], ["check", "http://localhost:3000", "--json"]],
    [["http://localhost:3000", "--lens", "seo"], ["check", "http://localhost:3000", "--lens", "seo"]],
    [["--lens", "seo", "https://example.com"], ["check", "--lens", "seo", "https://example.com"]],
    [["help", "check"], ["check", "--help"]],
  ];
  for (const [args, expected] of cases) {
    const run = cli(args, env);
    assert.equal(run.code, 3, args.join(" "));
    assert.deepEqual(JSON.parse(run.stdout), expected);
  }
});

test("login, logout and whoami go to the engine with their flags and exit code", () => {
  const env = { SITEORY_ENGINE: fakeEngine(), FAKE_EXIT: "5" };
  for (const args of [["login"], ["login", "--no-browser"], ["logout"], ["whoami"]]) {
    const run = cli(args, env);
    assert.equal(run.code, 5, args.join(" "));
    assert.deepEqual(JSON.parse(run.stdout), args);
  }
  for (const command of ["login", "logout", "whoami"]) {
    assert.deepEqual(JSON.parse(cli(["help", command], env).stdout), [command, "--help"]);
  }
});

test("check exits 4 when the engine is missing, broken or not an engine", () => {
  const notEngine = fakeEngine("export const VERSION = '1';\n");
  const cases = [
    [{ SITEORY_ENGINE: join(tmpdir(), "no-such-engine.mjs") }, /could not load the check engine/],
    [{ SITEORY_ENGINE: notEngine }, /does not export runCli/],
    [{ SITEORY_ENGINE: fakeEngine(), FAKE_THROW: "1" }, /engine exploded/],
    [{ SITEORY_ENGINE: fakeEngine(), FAKE_EXIT: "nan" }, /^$/],
  ];
  for (const [env, message] of cases) {
    const run = cli(["check", "http://localhost:3000"], env);
    assert.equal(run.code, 4, JSON.stringify(env));
    assert.match(run.stderr, message);
  }
});

const placeholder = readFileSync(new URL("../cli/engine.mjs", import.meta.url), "utf8").includes("is not bundled in this build");

test("the placeholder engine explains itself and exits 4", { skip: !placeholder && "the real engine is vendored" }, () => {
  const run = cli(["check", "http://localhost:3000"]);
  assert.equal(run.code, 4);
  assert.match(run.stderr, /The Siteory check engine is not bundled in this build\. Run npm run vendor\./);
});

test("setup --home stays inside that folder and never runs agent CLIs", () => {
  const home = mkdtempSync(join(TMP, "siteory-cli-home-"));

  const dry = cli(["setup", "--home", home, "--agent", "cursor", "--dry-run"]);
  assert.equal(dry.code, 0, dry.stderr);
  assert.match(dry.stdout, /Dry run: nothing is changed/);
  assert.ok(dry.stdout.endsWith("\n\nNext: run npx siteory login (paid plan required)\n"), dry.stdout);
  assert.deepEqual(readdirSync(home), []);

  const merged = cli(["setup", "--home", home, "--agent", "cursor,windsurf", "--mcp-only"]);
  assert.equal(merged.code, 0, merged.stdout);
  assert.ok(existsSync(join(home, ".cursor", "mcp.json")));
  assert.ok(existsSync(join(home, ".codeium", "windsurf", "mcp_config.json")));

  const outside = join(mkdtempSync(join(TMP, "siteory-outside-")), "codex");
  const native = cli(["setup", "--home", home, "--agent", "claude-code", "--agent", "codex", "--mcp-only"], { CODEX_HOME: outside });
  assert.equal(native.code, 1);
  assert.match(native.stdout, /not run because --home is set/);
  assert.ok(native.stdout.endsWith("Next: run npx siteory login (paid plan required)\n"), "also when a step needs the user");
  assert.ok(native.stdout.includes(`claude mcp add --transport http --scope user siteory ${MCP_URL}`));
  assert.ok(existsSync(join(home, ".codex", "config.toml")), "CODEX_HOME is ignored with --home");
  assert.ok(!existsSync(outside));
});
