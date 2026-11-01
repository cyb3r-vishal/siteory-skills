#!/usr/bin/env node
// The siteory command. `check`, `login`, `logout` and `whoami` run the bundled check engine
// (cli/engine.mjs); `setup`, `mcp` and `skills` connect coding agents to Siteory. Zero
// dependencies, Node 20 or later.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { CLIENTS, MCP_URL } from "./mcp-clients.mjs";
import { AGENTS, UsageError, setup } from "./setup.mjs";
import { listSkills } from "./skills.mjs";

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const HELP = {
  main: `siteory ${VERSION}: check websites for SEO, AI visibility and security issues, and connect coding agents to Siteory.

Usage:
  siteory check <url> [options]   Check a deployed site or a local dev server (shorthand: siteory <url>)
  siteory login                   Sign in to Siteory in your browser, once per machine
  siteory whoami                  Show the signed-in account and plan
  siteory logout                  Sign out on this machine
  siteory setup [options]         Install the Siteory skills and MCP server into your coding agents
  siteory mcp [--client <id>]     Print MCP config for Claude Code, Cursor, VS Code, Codex and others
  siteory skills                  List the bundled agent skills and where they install
  siteory help [command]          Show help for a command
  siteory --version               Print the version

Checks need a paid Siteory plan (from $9) and a sign-in on this machine: run siteory login once.
Plans: https://siteory.co/pricing

Common check options (siteory check --help lists all):
  --lens <list>          seo, aeo, security, foundations (the default), performance,
                         accessibility, schema, links, social, launch, or all
  --external             Links and social lenses: also request third-party URLs
  --json                 Print one JSON object (schema siteory.local/1)
  --only <id[,id]>       Report only these findings, with full detail and a fix prompt
  --fail-on <severity>   Exit 1 when a finding at or above critical|high|medium|low|info remains
  --prod <origin>        Production origin, for host-dependent checks such as canonical hosts

Exit codes: 0 ok, 1 --fail-on threshold met, 2 usage error or a skipped --only id, 3 start page unreadable, 4 internal error,
5 not signed in or no paid plan.

Examples:
  npx siteory login
  npx -y siteory check http://localhost:3000
  npx -y siteory check https://example.com --lens seo --json
  npx -y siteory check http://localhost:3000 --only seo_missing_h1 --fail-on info
  npx -y siteory check http://localhost:3000 --lens all --fail-on high
  npx siteory setup --dry-run

Docs: https://siteory.co/mcp`,

  setup: `Usage: siteory setup [options]

Installs the Siteory agent skills and connects the coding agents on this machine to the
Siteory MCP server at ${MCP_URL}. It never prompts and never stores secrets.
A config file is backed up before it changes, and a file that cannot be merged safely is
left alone with instructions.

Options:
  --agent <id>     Set up this agent; repeat or comma-separate for several. Default: every
                   agent found in your home directory. One of:
                   ${Object.keys(AGENTS).join(", ")}
  --skills-only    Install the skills only.
  --mcp-only       Add the MCP server only.
  --project        Install the skills into the current project instead of your home directory.
                   The MCP server is always added for your user.
  --dry-run        Show what would change without changing anything.
  --home <dir>     Use <dir> as the home directory and do not run agent CLIs (for testing).
  -h, --help       Show this help.

Where it writes:
${Object.values(AGENTS).map((agent) => `  ${agent.label.padEnd(12)} skills ~/${agent.skills.join("/")}, MCP ${agent.mcpTarget}`).join("\n")}

Exit codes: 0 done, 1 a step needs you to finish it (see "action needed"), 2 usage error.`,

  mcp: `Usage: siteory mcp [--client <id>]

Prints how to connect an MCP client to the Siteory MCP server (${MCP_URL}).
Sign-in happens in your browser (OAuth); there is no API key.

Clients: ${Object.keys(CLIENTS).join(", ")}`,

  skills: `Usage: siteory skills

Lists the agent skills bundled with this package and where "siteory setup" installs them.`,
};

async function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return help(rest[0]);
    case "--version":
    case "-v":
      console.log(VERSION);
      return 0;
    case "setup":
      return setupCommand(rest);
    case "mcp":
      return mcpCommand(rest);
    case "skills":
      return skillsCommand(rest);
    case "check":
    case "login":
    case "logout":
    case "whoami":
      return runEngine(argv);
    default:
      // `siteory <url>` and any check flags: the engine owns check parsing and its errors.
      return runEngine(["check", ...argv]);
  }
}

function help(topic) {
  if (["check", "login", "logout", "whoami"].includes(topic)) return runEngine([topic, "--help"]);
  if (topic !== undefined && !Object.hasOwn(HELP, topic)) throw new UsageError(`Unknown command "${topic}".`);
  console.log(HELP[topic ?? "main"]);
  return 0;
}

function setupCommand(args) {
  const { values } = parseArgs({
    args,
    options: {
      agent: { type: "string", multiple: true },
      "skills-only": { type: "boolean" },
      "mcp-only": { type: "boolean" },
      project: { type: "boolean" },
      "dry-run": { type: "boolean" },
      home: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return help("setup");
  const hermetic = values.home !== undefined;
  const options = {
    agents: values.agent?.flatMap((value) => value.split(",")).map((id) => id.trim()).filter(Boolean),
    skillsOnly: values["skills-only"],
    mcpOnly: values["mcp-only"],
    project: values.project,
    dryRun: values["dry-run"],
    home: hermetic ? resolve(values.home) : homedir(),
    // With --home every path stays under that directory: ignore CODEX_HOME, XDG_CONFIG_HOME and APPDATA.
    env: hermetic ? {} : process.env,
  };
  const skipCli = () => ({ status: null, error: new Error("not run because --home is set") });
  const { code } = setup(options, hermetic ? { run: skipCli } : {});
  console.log("\nNext: run npx siteory login (paid plan required)");
  return code;
}

function mcpCommand(args) {
  const { values } = parseArgs({ args, options: { client: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help) return help("mcp");
  if (values.client !== undefined && !Object.hasOwn(CLIENTS, values.client)) {
    throw new UsageError(`Unknown client "${values.client}". Choose from ${Object.keys(CLIENTS).join(", ")}.`);
  }
  console.log(`Siteory MCP server: ${MCP_URL}\nSign-in happens in your browser (OAuth). There is no API key to copy.`);
  for (const id of values.client ? [values.client] : Object.keys(CLIENTS)) {
    console.log(`\n## ${CLIENTS[id].label} (--client ${id})\n\n${CLIENTS[id].guide.join("\n")}`);
  }
  return 0;
}

function skillsCommand(args) {
  const { values } = parseArgs({ args, options: { help: { type: "boolean", short: "h" } } });
  if (values.help) return help("skills");
  const skills = listSkills();
  const width = Math.max(...skills.map((skill) => skill.name.length));
  console.log(`Skills bundled with siteory ${VERSION}:`);
  for (const skill of skills) console.log(`  ${skill.name.padEnd(width)}  ${skill.description.split(/(?<=\.)\s/)[0]}`);
  console.log("\n\"siteory setup\" installs each skill as <dir>/<skill name>:");
  const rows = Object.values(AGENTS).map((agent) => [agent.label, `~/${agent.skills.join("/")}`, `./${agent.projectSkills.join("/")}`]);
  const pathWidth = Math.max(...rows.map(([, path]) => path.length));
  for (const [label, path, projectPath] of rows) console.log(`  ${label.padEnd(12)} ${path.padEnd(pathWidth)}  with --project: ${projectPath}`);
  return 0;
}

async function runEngine(argv) {
  // SITEORY_ENGINE points at another engine build; the tests use it for a fake engine.
  const enginePath = process.env.SITEORY_ENGINE
    ? resolve(process.env.SITEORY_ENGINE)
    : fileURLToPath(new URL("./engine.mjs", import.meta.url));
  let engine;
  try {
    engine = await import(pathToFileURL(enginePath).href);
  } catch (error) {
    console.error(`siteory: could not load the check engine from ${enginePath}: ${error.message}`);
    return 4;
  }
  if (typeof engine.runCli !== "function") {
    console.error(`siteory: ${enginePath} does not export runCli, so it is not the Siteory check engine.`);
    return 4;
  }
  const code = await engine.runCli(argv);
  return Number.isInteger(code) ? code : 4;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError || String(error?.code).startsWith("ERR_PARSE_ARGS")) {
    console.error(`siteory: ${error.message}\nRun "siteory help" for usage.`);
    process.exitCode = 2;
  } else {
    console.error(`siteory: ${error?.stack ?? error}`);
    process.exitCode = 4;
  }
}
