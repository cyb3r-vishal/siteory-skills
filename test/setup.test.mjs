import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { CODEX_TOML, COMMANDS, MCP_URL, SNIPPETS } from "../cli/mcp-clients.mjs";
import { UsageError, codexServerState, runCommand, setup, windowsCommandLine } from "../cli/setup.mjs";

const TMP = mkdtempSync(join(tmpdir(), "siteory-skills-test-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const SKILLS = [
  "siteory",
  "siteory-accessibility",
  "siteory-ai-visibility",
  "siteory-launch",
  "siteory-links",
  "siteory-performance",
  "siteory-security",
  "siteory-seo",
  "siteory-social",
  "siteory-structured-data",
];

const tempDir = (prefix = "siteory-home-") => mkdtempSync(join(TMP, prefix));

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const readJsonFile = (file) => JSON.parse(readFileSync(file, "utf8"));
const backupsOf = (file) => readdirSync(dirname(file)).filter((name) => name.startsWith(`${file.split(/[\\/]/).pop()}.siteory-backup-`));

/** Runs setup with a recording fake for the agent CLIs. `respond` decides each exit status. */
function runSetup(options, respond = () => ({ status: 0 })) {
  const calls = [];
  const lines = [];
  const result = setup(
    { env: {}, platform: "linux", cwd: options.home, ...options },
    { run: (command, args) => (calls.push([command, ...args]), respond(command, args)), log: (line) => lines.push(line) },
  );
  return { ...result, calls, output: lines.join("\n"), statuses: result.results.map((row) => row.status) };
}

test("a dry run plans every step and changes nothing", () => {
  const home = tempDir();
  for (const dir of [".claude", ".cursor", ".codex"]) mkdirSync(join(home, dir));
  write(join(home, ".cursor", "mcp.json"), "{}\n");

  const run = runSetup({ home, dryRun: true });

  assert.equal(run.code, 0);
  assert.match(run.output, /Claude Code, Codex, Cursor \(detected\)\. Dry run/);
  assert.ok(run.statuses.every((status) => status === "planned"), run.output);
  assert.deepEqual(run.calls, []);
  assert.ok(!existsSync(join(home, ".claude", "skills")));
  assert.ok(!existsSync(join(home, ".codex", "config.toml")));
  assert.equal(readFileSync(join(home, ".cursor", "mcp.json"), "utf8"), "{}\n");
  assert.deepEqual(backupsOf(join(home, ".cursor", "mcp.json")), []);
});

test("installs skills and replaces only the Siteory skill folders", () => {
  const home = tempDir();
  write(join(home, ".claude", "skills", "other-skill", "SKILL.md"), "keep me");
  write(join(home, ".claude", "skills", "siteory", "stale.txt"), "from an older version");

  const run = runSetup({ home, agents: ["claude-code", "codex", "gemini"], skillsOnly: true });

  assert.equal(run.code, 0, run.output);
  assert.deepEqual(run.calls, []);
  for (const name of SKILLS) {
    assert.ok(existsSync(join(home, ".claude", "skills", name, "SKILL.md")), name);
    assert.ok(existsSync(join(home, ".agents", "skills", name, "scripts", "siteory.mjs")), name);
  }
  assert.ok(!existsSync(join(home, ".claude", "skills", "siteory", "stale.txt")));
  assert.equal(readFileSync(join(home, ".claude", "skills", "other-skill", "SKILL.md"), "utf8"), "keep me");
  // Codex and Gemini share ~/.agents/skills: one copy, one result row.
  assert.equal(run.results.filter((row) => row.area === "skills").length, 2);
  assert.match(run.output, /\.agents[\\/]skills \(Codex, Gemini CLI\)/);
});

test("--project installs skills into the project folders", () => {
  const home = tempDir();
  const project = tempDir("siteory-project-");

  const run = runSetup({ home, cwd: project, agents: ["claude-code", "cursor", "windsurf"], project: true, skillsOnly: true });

  assert.equal(run.code, 0, run.output);
  for (const dir of [[".claude", "skills"], [".agents", "skills"], [".windsurf", "skills"]]) {
    assert.ok(existsSync(join(project, ...dir, "siteory-seo", "SKILL.md")), dir.join("/"));
  }
  assert.deepEqual(readdirSync(home), []);
});

test("merges the Cursor config, keeps other servers and backs the file up once", () => {
  const home = tempDir();
  const file = join(home, ".cursor", "mcp.json");
  const original = JSON.stringify({ mcpServers: { other: { url: "https://other.example/mcp" } }, theme: "dark" }, null, 4);
  write(file, original);

  const first = runSetup({ home, agents: ["cursor"], mcpOnly: true });
  assert.equal(first.code, 0, first.output);
  assert.deepEqual(readJsonFile(file), {
    mcpServers: { other: { url: "https://other.example/mcp" }, siteory: { url: MCP_URL } },
    theme: "dark",
  });
  const backups = backupsOf(file);
  assert.equal(backups.length, 1);
  assert.equal(readFileSync(join(dirname(file), backups[0]), "utf8"), original);
  assert.ok(!readdirSync(dirname(file)).some((name) => name.endsWith(".tmp")));

  const second = runSetup({ home, agents: ["cursor"], mcpOnly: true });
  assert.deepEqual(second.statuses, ["present"]);
  assert.equal(backupsOf(file).length, 1);
});

test("creates OpenCode and Windsurf configs and respects XDG_CONFIG_HOME", () => {
  const home = tempDir();
  const xdg = join(home, "xdg");
  write(join(xdg, "opencode", "opencode.json"), JSON.stringify({ model: "x", mcp: { local: { type: "local" } } }));

  const run = runSetup({ home, agents: ["opencode", "windsurf"], mcpOnly: true, env: { XDG_CONFIG_HOME: xdg } });

  assert.equal(run.code, 0, run.output);
  assert.deepEqual(readJsonFile(join(xdg, "opencode", "opencode.json")), {
    model: "x",
    mcp: { local: { type: "local" }, siteory: { type: "remote", url: MCP_URL, enabled: true } },
  });
  assert.deepEqual(readJsonFile(join(home, ".codeium", "windsurf", "mcp_config.json")), SNIPPETS.windsurf);

  const fresh = tempDir();
  runSetup({ home: fresh, agents: ["opencode"], mcpOnly: true });
  assert.deepEqual(readJsonFile(join(fresh, ".config", "opencode", "opencode.json")), SNIPPETS.opencode);
});

test("leaves files it cannot merge untouched and hands the step to the user", () => {
  const cases = {
    jsonc: "{\n  // personal servers\n  \"mcpServers\": {}\n}\n",
    array: "[]",
    badShape: "{\"mcpServers\": \"nope\"}",
  };
  for (const [label, text] of Object.entries(cases)) {
    const home = tempDir();
    const file = join(home, ".cursor", "mcp.json");
    write(file, text);

    const run = runSetup({ home, agents: ["cursor"], mcpOnly: true });

    assert.equal(run.code, 1, label);
    assert.deepEqual(run.statuses, ["manual"], label);
    assert.equal(readFileSync(file, "utf8"), text, label);
    assert.deepEqual(backupsOf(file), [], label);
    assert.match(run.output, /\[action needed\]/, label);
    assert.ok(run.output.includes(`"url": "${MCP_URL}"`), label);
  }
});

test("writes through a symlinked config file and keeps the link", (t) => {
  const home = tempDir();
  const real = join(home, "dotfiles", "mcp.json");
  const file = join(home, ".cursor", "mcp.json");
  write(real, "{}\n");
  mkdirSync(dirname(file));
  try {
    symlinkSync(real, file, "file");
  } catch (error) {
    if (error.code === "EPERM") return t.skip("creating a file symlink needs Developer Mode or elevation on Windows");
    throw error;
  }

  const run = runSetup({ home, agents: ["cursor"], mcpOnly: true });

  assert.equal(run.code, 0, run.output);
  assert.ok(lstatSync(file).isSymbolicLink(), "the link was replaced by a regular file");
  assert.deepEqual(readJsonFile(real), SNIPPETS.cursor);
  assert.equal(backupsOf(real).length, 1);
  assert.deepEqual(backupsOf(file), []);
});

test("treats an empty JSON file as empty config, and an unreadable path as a manual step", () => {
  const home = tempDir();
  const file = join(home, ".codeium", "windsurf", "mcp_config.json");
  write(file, "  \n");
  assert.equal(runSetup({ home, agents: ["windsurf"], mcpOnly: true }).code, 0);
  assert.deepEqual(readJsonFile(file), SNIPPETS.windsurf);

  const other = tempDir();
  mkdirSync(join(other, ".cursor", "mcp.json"), { recursive: true }); // a directory where the file should be
  const run = runSetup({ home: other, agents: ["cursor"], mcpOnly: true });
  assert.equal(run.code, 1);
  assert.match(run.output, /Could not read/);
});

test("appends the Codex table once and honours CODEX_HOME", () => {
  const home = tempDir();
  const file = join(home, ".codex", "config.toml");
  write(file, "model = \"gpt-5\"");

  assert.equal(runSetup({ home, agents: ["codex"], mcpOnly: true }).code, 0);
  assert.equal(readFileSync(file, "utf8"), `model = "gpt-5"\n\n${CODEX_TOML}`);
  assert.equal(backupsOf(file).length, 1);

  const again = runSetup({ home, agents: ["codex"], mcpOnly: true });
  assert.deepEqual(again.statuses, ["present"]);
  assert.equal(readFileSync(file, "utf8").split("[mcp_servers.siteory]").length, 2);

  const codexHome = join(home, "custom-codex");
  runSetup({ home, agents: ["codex"], mcpOnly: true, env: { CODEX_HOME: codexHome } });
  assert.equal(readFileSync(join(codexHome, "config.toml"), "utf8"), CODEX_TOML);
});

test("codexServerState recognises every TOML form of mcp_servers.siteory and inline mcp_servers tables", () => {
  const present = [
    "[mcp_servers.siteory]\nurl = \"x\"",
    "[ mcp_servers . \"siteory\" ]",
    "[mcp_servers.siteory.env]\nA = \"1\"",
    "mcp_servers.siteory.url = \"x\"",
    "[mcp_servers]\nsiteory = { url = \"x\" }",
    "[mcp_servers]\r\nsiteory.url = \"x\"\r\n",
    "mcp_servers = { siteory = { url = \"x\" } }",
    "mcp_servers = { other = { url = \"y\" }, \"siteory\" = { url = \"x\" } }",
  ];
  const absent = [
    "# [mcp_servers.siteory]",
    "[mcp_servers.siteory2]\nurl = \"x\"",
    "[mcp_servers.other]\nurl = \"siteory\"",
    "[profiles.work]\nmcp_servers.siteory = 1",
    "[[skills.config]]\npath = \"siteory\"",
    "\"mcp_servers.siteory\" = 1",
    "",
  ];
  const inline = [
    "model = \"gpt-5\"\nmcp_servers = { other = { command = \"npx\", args = [\"-y\", \"x\"] } }",
    "mcp_servers = {}",
    "\"mcp_servers\" = { other = { url = \"https://siteory.example/mcp\" } }",
    // A multi-line nested array makes `[\"c\"],` look like a table header; the bare assignment still counts.
    "servers = [\n  [\"a\", \"b\"],\n  [\"c\"],\n]\nmcp_servers = { other = { url = \"x\" } }",
    // Inside another table this is not the root table, but treating it as inline only costs a manual step.
    "[profiles.work]\nmcp_servers = { other = { url = \"x\" } }",
  ];
  for (const toml of present) assert.equal(codexServerState(toml), "present", toml);
  for (const toml of absent) assert.equal(codexServerState(toml), "absent", toml);
  for (const toml of inline) assert.equal(codexServerState(toml), "inline", toml);
});

test("leaves a Codex config with an inline mcp_servers table unchanged", () => {
  const home = tempDir();
  const file = join(home, ".codex", "config.toml");
  const other = "model = \"gpt-5\"\nmcp_servers = { other = { command = \"npx\", args = [\"-y\", \"x\"] } }\n";
  write(file, other);

  const run = runSetup({ home, agents: ["codex"], mcpOnly: true });
  assert.equal(run.code, 1);
  assert.deepEqual(run.statuses, ["manual"]);
  assert.equal(readFileSync(file, "utf8"), other);
  assert.deepEqual(backupsOf(file), []);
  assert.ok(run.output.includes(`siteory = { url = "${MCP_URL}" }`), run.output);

  const configured = `mcp_servers = { siteory = { url = "${MCP_URL}" } }\n`;
  write(file, configured);
  assert.deepEqual(runSetup({ home, agents: ["codex"], mcpOnly: true }).statuses, ["present"]);
  assert.equal(readFileSync(file, "utf8"), configured);
});

test("adds Claude Code at user scope and treats a user-scope server as present", () => {
  const home = tempDir();
  // No "claude mcp get" probe: it also succeeds for a local or project siteory server.
  const added = runSetup({ home, agents: ["claude-code"], mcpOnly: true });
  assert.equal(added.code, 0);
  assert.deepEqual(added.calls, [["claude", ...COMMANDS.claude]]);
  assert.deepEqual(added.statuses, ["done"]);
  assert.match(added.output, /run \/mcp, select siteory and choose Authenticate/);

  const existing = runSetup({ home, agents: ["claude-code"], mcpOnly: true }, () => ({ status: 1, stdout: "", stderr: "MCP server siteory already exists in user config\n" }));
  assert.equal(existing.code, 0);
  assert.deepEqual(existing.calls, [["claude", ...COMMANDS.claude]]);
  assert.deepEqual(existing.statuses, ["present"]);
});

test("reports a failed agent CLI with the command to run by hand", () => {
  const home = tempDir();
  const run = runSetup({ home, agents: ["claude-code", "gemini"], mcpOnly: true }, () => ({ status: 1, stderr: "claude: not found\n" }));
  assert.equal(run.code, 1);
  assert.deepEqual(run.statuses, ["manual", "manual"]);
  assert.ok(run.output.includes(`claude ${COMMANDS.claude.join(" ")}`));
  assert.match(run.output, /claude: not found/);
  assert.ok(run.output.includes(`"httpUrl": "${MCP_URL}"`));
  assert.doesNotMatch(run.output, /Next steps/);
});

test("uses code --add-mcp and gemini mcp add, skipping servers already configured", () => {
  const home = tempDir();
  const fresh = runSetup({ home, agents: ["vscode", "gemini"], mcpOnly: true });
  assert.deepEqual(fresh.calls, [["code", ...COMMANDS.vscode], ["gemini", ...COMMANDS.gemini]]);
  assert.deepEqual(JSON.parse(COMMANDS.vscode[1]), { name: "siteory", type: "http", url: MCP_URL });

  write(join(home, ".config", "Code", "User", "mcp.json"), JSON.stringify(SNIPPETS.vscode));
  write(join(home, ".gemini", "settings.json"), JSON.stringify(SNIPPETS.gemini));
  const configured = runSetup({ home, agents: ["vscode", "gemini"], mcpOnly: true });
  assert.deepEqual(configured.calls, []);
  assert.deepEqual(configured.statuses, ["present", "present"]);

  const windows = tempDir();
  write(join(windows, "AppData", "Roaming", "Code", "User", "mcp.json"), JSON.stringify(SNIPPETS.vscode));
  assert.deepEqual(runSetup({ home: windows, agents: ["vscode"], mcpOnly: true, platform: "win32" }).statuses, ["present"]);
});

test("skips Claude Code when the Siteory plugin is enabled", () => {
  const home = tempDir();
  write(join(home, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: { "siteory@siteory": true } }));

  const run = runSetup({ home, agents: ["claude-code"] });

  assert.equal(run.code, 0);
  assert.deepEqual(run.calls, []);
  assert.deepEqual(run.statuses, ["skipped"]);
  assert.ok(!existsSync(join(home, ".claude", "skills")));
});

test("detects agents from their home folders", () => {
  const home = tempDir();
  for (const dir of [".claude", join(".codeium", "windsurf"), join(".config", "opencode")]) mkdirSync(join(home, dir), { recursive: true });
  write(join(home, ".gemini", "settings.json"), "{}");
  assert.match(runSetup({ home, dryRun: true }).output, /for Claude Code, Gemini CLI, OpenCode, Windsurf \(detected\)/);

  const antigravityOnly = tempDir();
  mkdirSync(join(antigravityOnly, ".gemini", "antigravity"), { recursive: true });
  const none = runSetup({ home: antigravityOnly, dryRun: true });
  assert.equal(none.code, 1);
  assert.match(none.output, /No supported coding agents were found/);
});

test("rejects unknown agents and conflicting flags", () => {
  const home = tempDir();
  assert.throws(() => setup({ home, agents: ["claude-code", "nope"] }), (error) => error instanceof UsageError && /Unknown agent: nope/.test(error.message));
  assert.throws(() => setup({ home, skillsOnly: true, mcpOnly: true }), UsageError);
});

test("windowsCommandLine quotes JSON for cmd.exe and refuses shell metacharacters", () => {
  assert.equal(windowsCommandLine("claude", COMMANDS.claude), `claude mcp add --transport http --scope user siteory ${MCP_URL}`);
  assert.equal(windowsCommandLine("code", COMMANDS.vscode), `code --add-mcp "{\\"name\\":\\"siteory\\",\\"type\\":\\"http\\",\\"url\\":\\"${MCP_URL}\\"}"`);
  for (const bad of ["a&b", "%PATH%", "a|b", "a>b", "a^b", "a!b", "a\\b", "a\nb"]) {
    assert.throws(() => windowsCommandLine("code", [bad]), /Refusing/, bad);
  }
});

test("runCommand passes the JSON argument through cmd.exe intact", { skip: process.platform !== "win32" }, () => {
  const result = runCommand("node", ["-e", "process.stdout.write(process.argv[1])", COMMANDS.vscode[1]], "win32");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, COMMANDS.vscode[1]);
});

test("runCommand on Windows ignores a CLI planted in the current folder", { skip: process.platform !== "win32" }, () => {
  const repo = tempDir("siteory-repo-");
  const bin = tempDir("siteory-bin-");
  write(join(repo, "zzsiteoryprobe.cmd"), "@echo PLANTED\r\n");
  write(join(bin, "zzsiteoryprobe.cmd"), "@echo FROM-PATH\r\n");
  const env = { ...process.env };
  // Claude Code's own shell sets this, which would hide the problem; a normal terminal does not.
  for (const key of Object.keys(env)) if (key.toLowerCase() === "nodefaultcurrentdirectoryinexepath") delete env[key];
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  env[pathKey] = `${bin};${env[pathKey]}`;
  const setupUrl = new URL("../cli/setup.mjs", import.meta.url).href;
  const script = `import { runCommand } from ${JSON.stringify(setupUrl)};
const run = (command, ...args) => runCommand(command, args, "win32").stdout.trim();
process.stdout.write(JSON.stringify([run("zzsiteoryprobe"), run("cd"), run("set", "NoDefaultCurrentDirectoryInExePath")]));`;

  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: repo, env, encoding: "utf8" });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ["FROM-PATH", homedir(), "NoDefaultCurrentDirectoryInExePath=1"]);
});
