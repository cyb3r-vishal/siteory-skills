// `siteory setup`: installs the bundled skills and connects coding agents to the Siteory MCP
// server. It never prompts and never stores secrets. An existing config file is copied to a
// timestamped backup and then rewritten atomically; a file that is not plain JSON is left alone.
// Only our own skill directories are replaced.
import { spawnSync } from "node:child_process";
import { constants, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CODEX_TOML, COMMANDS, MCP_URL, SNIPPETS } from "./mcp-clients.mjs";
import { listSkills } from "./skills.mjs";

export class UsageError extends Error {}

const PLUGIN_ID = "siteory@siteory";
const codexHome = (ctx) => ctx.env.CODEX_HOME || join(ctx.home, ".codex");
const configHome = (ctx) => ctx.env.XDG_CONFIG_HOME || join(ctx.home, ".config");

/** Skill paths are relative to the home directory, or to the project with --project. */
export const AGENTS = {
  "claude-code": {
    label: "Claude Code",
    skills: [".claude", "skills"],
    projectSkills: [".claude", "skills"],
    detect: (ctx) => [join(ctx.home, ".claude")],
    mcpTarget: "claude mcp add --scope user",
    mcp: claudeCodeMcp,
    next: "In Claude Code, run /mcp, select siteory and choose Authenticate.",
  },
  codex: {
    label: "Codex",
    skills: [".agents", "skills"],
    projectSkills: [".agents", "skills"],
    detect: (ctx) => [codexHome(ctx)],
    mcpTarget: "$CODEX_HOME/config.toml (default ~/.codex)",
    mcp: codexMcp,
    next: "Sign in to Siteory from Codex: codex mcp login siteory",
  },
  cursor: {
    label: "Cursor",
    skills: [".cursor", "skills"],
    projectSkills: [".agents", "skills"],
    detect: (ctx) => [join(ctx.home, ".cursor")],
    mcpTarget: "~/.cursor/mcp.json",
    mcp: (ctx) => mergeJson(ctx, join(ctx.home, ".cursor", "mcp.json"), SNIPPETS.cursor),
    next: "In Cursor, open the MCP settings and sign in to siteory when it asks.",
  },
  vscode: {
    label: "VS Code",
    skills: [".copilot", "skills"],
    projectSkills: [".agents", "skills"],
    detect: (ctx) => [join(ctx.home, ".vscode")],
    mcpTarget: "code --add-mcp (user profile)",
    mcp: vscodeMcp,
    next: "In VS Code, run \"MCP: List Servers\", start siteory and sign in when it asks.",
  },
  gemini: {
    label: "Gemini CLI",
    skills: [".agents", "skills"],
    projectSkills: [".agents", "skills"],
    detect: (ctx) => [join(ctx.home, ".gemini", "settings.json")],
    mcpTarget: "gemini mcp add -s user",
    mcp: geminiMcp,
    next: "In Gemini CLI, run /mcp auth siteory.",
  },
  opencode: {
    label: "OpenCode",
    skills: [".agents", "skills"],
    projectSkills: [".agents", "skills"],
    detect: (ctx) => [join(configHome(ctx), "opencode"), join(ctx.home, ".local", "share", "opencode")],
    mcpTarget: "~/.config/opencode/opencode.json",
    mcp: (ctx) => mergeJson(ctx, join(configHome(ctx), "opencode", "opencode.json"), SNIPPETS.opencode),
    next: "Sign in to Siteory from OpenCode: opencode mcp auth siteory",
  },
  windsurf: {
    label: "Windsurf",
    skills: [".codeium", "windsurf", "skills"],
    projectSkills: [".windsurf", "skills"],
    detect: (ctx) => [join(ctx.home, ".codeium", "windsurf")],
    mcpTarget: "~/.codeium/windsurf/mcp_config.json",
    mcp: (ctx) => mergeJson(ctx, join(ctx.home, ".codeium", "windsurf", "mcp_config.json"), SNIPPETS.windsurf),
    next: "In Windsurf, refresh the MCP panel and sign in to siteory when it asks.",
  },
};

const STATUS_LABEL = { done: "[done]", present: "[exists]", planned: "[dry run]", manual: "[action needed]", skipped: "[skipped]" };

/**
 * options: { agents?, skillsOnly?, mcpOnly?, project?, dryRun?, home, cwd?, env?, platform? }
 * deps: { run?(command, args) -> spawnSync-like result, log?(line) }
 * Returns { code, results }. code is 1 when any step needs the user to finish it by hand.
 */
export function setup(options, deps = {}) {
  if (options.skillsOnly && options.mcpOnly) throw new UsageError("--skills-only and --mcp-only cannot be combined.");
  const ctx = {
    home: options.home,
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? {},
    platform: options.platform ?? process.platform,
    dryRun: Boolean(options.dryRun),
    run: deps.run ?? ((command, args) => runCommand(command, args, ctx.platform)),
  };
  const log = deps.log ?? console.log;
  const { ids, detected } = resolveAgents(options.agents, ctx);
  if (ids.length === 0) {
    log(`No supported coding agents were found under ${ctx.home}.`);
    log(`Choose one or more with --agent: ${Object.keys(AGENTS).join(", ")}.`);
    return { code: 1, results: [] };
  }

  const results = [];
  const active = ids.filter((id) => {
    if (id !== "claude-code" || !claudePluginEnabled(ctx)) return true;
    results.push({ area: "agent", agent: AGENTS[id].label, status: "skipped", message: `The ${PLUGIN_ID} plugin is enabled, so Claude Code already has the Siteory skills and MCP server.` });
    return false;
  });
  if (!options.mcpOnly) results.push(...installSkills(ctx, active, Boolean(options.project)));
  if (!options.skillsOnly) {
    for (const id of active) results.push({ area: "mcp", agent: AGENTS[id].label, id, ...attempt(() => AGENTS[id].mcp(ctx)) });
  }

  log(`Siteory setup for ${ids.map((id) => AGENTS[id].label).join(", ")}${detected ? " (detected)" : ""}${ctx.dryRun ? ". Dry run: nothing is changed." : "."}`);
  printReport(results, log);
  return { code: results.some((row) => row.status === "manual") ? 1 : 0, results };
}

function printReport(results, log) {
  for (const [area, title] of [["agent", "Agents"], ["skills", "Skills"], ["mcp", `MCP server ${MCP_URL}`]]) {
    const rows = results.filter((result) => result.area === area);
    if (rows.length === 0) continue;
    log(`\n${title}`);
    for (const row of rows) {
      log(`  ${STATUS_LABEL[row.status]} ${area === "mcp" ? `${row.agent}: ` : ""}${row.message}`);
      if (row.snippet) log(row.snippet.replace(/^/gm, "      "));
    }
  }
  const next = results.filter((row) => row.area === "mcp" && row.status !== "manual").map((row) => AGENTS[row.id].next);
  if (results.some((row) => row.area === "skills" && row.status !== "manual")) next.unshift("Restart your agents so they load the skills.");
  if (next.length === 0) return;
  log("\nNext steps");
  for (const line of next) log(`  - ${line}`);
}

function resolveAgents(requested, ctx) {
  if (requested?.length) {
    const unknown = requested.filter((id) => !Object.hasOwn(AGENTS, id));
    if (unknown.length > 0) throw new UsageError(`Unknown agent: ${unknown.join(", ")}. Choose from ${Object.keys(AGENTS).join(", ")}.`);
    return { ids: [...new Set(requested)], detected: false };
  }
  const ids = Object.keys(AGENTS).filter((id) => AGENTS[id].detect(ctx).some((path) => existsSync(path)));
  return { ids, detected: true };
}

function claudePluginEnabled(ctx) {
  return readJson(join(ctx.home, ".claude", "settings.json"))?.enabledPlugins?.[PLUGIN_ID] === true;
}

function installSkills(ctx, ids, project) {
  const targets = new Map();
  for (const id of ids) {
    const dir = join(project ? ctx.cwd : ctx.home, ...(project ? AGENTS[id].projectSkills : AGENTS[id].skills));
    targets.set(dir, [...(targets.get(dir) ?? []), AGENTS[id].label]);
  }
  const skills = listSkills();
  const names = skills.map((skill) => skill.name).join(", ");
  return [...targets].map(([dir, labels]) => ({
    area: "skills",
    ...attempt(() => {
      const where = `${dir} (${labels.join(", ")})`;
      if (ctx.dryRun) return { status: "planned", message: `Would install ${names} into ${where}.` };
      for (const skill of skills) {
        // Removes a symlink or junction itself, never the directory it points to.
        rmSync(join(dir, skill.name), { recursive: true, force: true });
        cpSync(skill.dir, join(dir, skill.name), { recursive: true });
      }
      return { status: "done", message: `Installed ${names} into ${where}.` };
    }),
  }));
}

function attempt(step) {
  try {
    return step();
  } catch (error) {
    return { status: "manual", message: `Failed: ${error.message}` };
  }
}

function claudeCodeMcp(ctx) {
  const command = `claude ${COMMANDS.claude.join(" ")}`;
  if (ctx.dryRun) return { status: "planned", message: `Would run: ${command}` };
  // No "claude mcp get" probe: it also finds local and project servers, which are not the user-scope install.
  const result = ctx.run("claude", COMMANDS.claude);
  if (result.status === 0) return { status: "done", message: "Added the siteory server to Claude Code (user scope)." };
  if (`${result.stdout ?? ""}\n${result.stderr ?? ""}`.includes("already exists in user config")) {
    return { status: "present", message: "Claude Code already has a user-scope MCP server named siteory; left unchanged." };
  }
  return { status: "manual", message: `Could not run claude (${failure(result)}). Run it yourself:`, snippet: command };
}

function codexMcp(ctx) {
  const file = join(codexHome(ctx), "config.toml");
  const text = readText(file);
  if (text instanceof Error) return manual(`Could not read ${file} (${text.code}).`, CODEX_TOML.trimEnd());
  const state = text === null ? "absent" : codexServerState(text);
  if (state === "present") return { status: "present", message: `${file} already configures mcp_servers.siteory; left unchanged.` };
  if (state === "inline") return manual(`${file} sets mcp_servers to an inline table, so it was left unchanged. Add this entry inside that table:`, `siteory = { url = "${MCP_URL}" }`);
  if (ctx.dryRun) return { status: "planned", message: `Would add [mcp_servers.siteory] to ${file}${text === null ? "" : " after a backup copy"}.` };
  const separator = !text ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  const backup = writeConfig(file, text, `${text ?? ""}${separator}${CODEX_TOML}`);
  return { status: "done", message: `Added [mcp_servers.siteory] to ${file}${backup ? ` (backup: ${backup})` : ""}.` };
}

function vscodeMcp(ctx) {
  const file = vscodeUserConfig(ctx);
  if (readJson(file)?.servers?.siteory !== undefined) return { status: "present", message: `${file} already has a siteory server; left unchanged.` };
  if (ctx.dryRun) return { status: "planned", message: `Would run: code ${COMMANDS.vscode[0]} '${COMMANDS.vscode[1]}'` };
  const result = ctx.run("code", COMMANDS.vscode);
  if (result.status === 0) return { status: "done", message: "Added the siteory server to the VS Code user profile." };
  return manual(`Could not run code (${failure(result)}). In VS Code, run "MCP: Open User Configuration" and add:`, SNIPPETS.vscode);
}

function geminiMcp(ctx) {
  const file = join(ctx.home, ".gemini", "settings.json");
  const command = `gemini ${COMMANDS.gemini.join(" ")}`;
  if (readJson(file)?.mcpServers?.siteory !== undefined) return { status: "present", message: `${file} already has a siteory server; left unchanged.` };
  if (ctx.dryRun) return { status: "planned", message: `Would run: ${command}` };
  const result = ctx.run("gemini", COMMANDS.gemini);
  if (result.status === 0) return { status: "done", message: "Added the siteory server to Gemini CLI (user scope)." };
  return manual(`Could not run gemini (${failure(result)}). Run "${command}", or add this to ${file}:`, SNIPPETS.gemini);
}

/** Adds snippet's siteory entry to a JSON config file, keeping everything else in it. */
function mergeJson(ctx, file, snippet) {
  const parent = Object.keys(snippet).find((key) => snippet[key]?.siteory);
  const text = readText(file);
  if (text instanceof Error) return manual(`Could not read ${file} (${text.code}).`, snippet);
  let config = snippet;
  if (text !== null) {
    try {
      config = text.trim() ? JSON.parse(text.replace(/^﻿/, "")) : {};
    } catch {
      return manual(`${file} is not plain JSON (it may contain comments), so it was left unchanged. Add this yourself:`, snippet);
    }
    if (!isObject(config) || (config[parent] !== undefined && !isObject(config[parent]))) {
      return manual(`${file} does not have the expected layout, so it was left unchanged. Add this yourself:`, snippet);
    }
    if (config[parent]?.siteory !== undefined) return { status: "present", message: `${file} already has a siteory server; left unchanged.` };
    config = { ...config, [parent]: { ...config[parent], siteory: snippet[parent].siteory } };
  }
  if (ctx.dryRun) return { status: "planned", message: `Would add the siteory server to ${file}${text === null ? "" : " after a backup copy"}.` };
  const backup = writeConfig(file, text, `${JSON.stringify(config, null, 2)}\n`);
  return { status: "done", message: `Added the siteory server to ${file}${backup ? ` (backup: ${backup})` : ""}.` };
}

function manual(message, snippet) {
  return { status: "manual", message, snippet: typeof snippet === "string" ? snippet : JSON.stringify(snippet, null, 2) };
}

/**
 * "present" when a Codex config.toml already defines mcp_servers.siteory in any TOML form:
 * a [mcp_servers.siteory] table (or a sub-table), a dotted key, a key inside [mcp_servers], or
 * a key of a root-level `mcp_servers = { ... }` inline table. "inline" when such an inline table
 * has no siteory key: appending [mcp_servers.siteory] would redefine it and break the file.
 * Otherwise "absent".
 */
export function codexServerState(toml) {
  let table = "";
  let inline = false;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    // A bare `mcp_servers = ...` line is an inline table whatever table we think we are in: a multi-line
    // array can make the header tracking below drift, and a false "inline" only costs a manual step.
    const assignment = line.match(/^(["']?)mcp_servers\1\s*=(.*)/);
    if (assignment) {
      if (/[{,]\s*(["']?)siteory\1\s*[.=]/.test(assignment[2])) return "present";
      inline = true;
      continue;
    }
    if (line.startsWith("[[")) {
      table = "[[array]]";
      continue;
    }
    const header = line.match(/^\[([^\]]+)\]/);
    if (header) {
      table = tomlKey(header[1]);
      if (isSiteoryKey(table)) return "present";
      continue;
    }
    const key = line.match(/^([\w\-.'" ]+?)\s*=(.*)/);
    if (!key) continue;
    const path = table ? `${table}.${tomlKey(key[1])}` : tomlKey(key[1]);
    if (isSiteoryKey(path)) return "present";
    if (path !== "mcp_servers") continue;
    // ponytail: only the assignment's own line is read; a TOML 1.1 multi-line inline table falls back to "inline" (a manual step, never a write).
    if (/[{,]\s*(["']?)siteory\1\s*[.=]/.test(key[2])) return "present";
    inline = true;
  }
  return inline ? "inline" : "absent";
}

const tomlKey = (key) => key.split(".").map((part) => part.trim().replace(/^(["'])(.*)\1$/, "$2")).join(".");
const isSiteoryKey = (key) => key === "mcp_servers.siteory" || key.startsWith("mcp_servers.siteory.");

function vscodeUserConfig(ctx) {
  if (ctx.platform === "win32") return join(ctx.env.APPDATA || join(ctx.home, "AppData", "Roaming"), "Code", "User", "mcp.json");
  if (ctx.platform === "darwin") return join(ctx.home, "Library", "Application Support", "Code", "User", "mcp.json");
  return join(configHome(ctx), "Code", "User", "mcp.json");
}

/** Backs up `file` when it existed (previous !== null), then replaces it atomically. */
function writeConfig(file, previous, content) {
  // Rename over a symlink would replace the link itself (dotfiles managers link these files).
  const target = previous === null ? file : realpathSync(file);
  mkdirSync(dirname(target), { recursive: true });
  let backup = null;
  let mode;
  if (previous !== null) {
    backup = `${target}.siteory-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(target, backup, constants.COPYFILE_EXCL);
    // Keep the original permissions: these files can hold other servers' tokens.
    mode = statSync(target).mode & 0o777;
  }
  const temp = `${target}.siteory-${process.pid}.tmp`;
  writeFileSync(temp, content, { mode });
  try {
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
  return backup;
}

/** File text, null when the file does not exist, or the Error for any other failure. */
function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    return error.code === "ENOENT" ? null : error;
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function failure(result) {
  if (result.error) return result.error.message;
  const line = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.split("\n").map((text) => text.trim()).find(Boolean);
  return line ?? `exit code ${result.status}`;
}

/**
 * Runs a native agent CLI. On Windows the npm-installed CLIs are .cmd shims, which Node can only
 * start through cmd.exe (CVE-2024-27980), so the command line is built here from constant arguments.
 * cmd.exe looks in the current folder before PATH, so a cloned repo could plant claude.cmd: run
 * from the home folder and turn that lookup off.
 */
export function runCommand(command, args, platform = process.platform) {
  const options = { encoding: "utf8", timeout: 120_000, windowsHide: true };
  if (platform !== "win32") return spawnSync(command, args, options);
  return spawnSync(windowsCommandLine(command, args), {
    ...options,
    shell: true,
    cwd: homedir(),
    env: { ...process.env, NoDefaultCurrentDirectoryInExePath: "1" },
  });
}

export function windowsCommandLine(command, args) {
  return [command, ...args].map((arg) => {
    // cmd.exe would interpret these; quoting below is only correct without them.
    if (/[%^&|<>!\\\r\n]/.test(arg)) throw new Error(`Refusing to pass ${JSON.stringify(arg)} through cmd.exe.`);
    return /^[\w\-.:/@=]+$/.test(arg) ? arg : `"${arg.replaceAll("\"", "\\\"")}"`;
  }).join(" ");
}
