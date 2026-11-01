// How each MCP client connects to the Siteory server. `siteory mcp` prints these guides, and
// `siteory setup` uses the same snippets when it has to hand a step back to the user.
export const MCP_URL = "https://api.siteory.co/mcp";

export const SNIPPETS = {
  cursor: { mcpServers: { siteory: { url: MCP_URL } } },
  vscode: { servers: { siteory: { type: "http", url: MCP_URL } } },
  gemini: { mcpServers: { siteory: { httpUrl: MCP_URL } } },
  antigravity: { mcpServers: { siteory: { serverUrl: MCP_URL } } },
  opencode: { $schema: "https://opencode.ai/config.json", mcp: { siteory: { type: "remote", url: MCP_URL, enabled: true } } },
  windsurf: { mcpServers: { siteory: { serverUrl: MCP_URL } } },
  other: { mcpServers: { siteory: { command: "npx", args: ["-y", "mcp-remote", MCP_URL] } } },
};

export const CODEX_TOML = `[mcp_servers.siteory]\nurl = "${MCP_URL}"\n`;

/** Native CLI arguments. Constants only: on Windows they pass through cmd.exe. */
export const COMMANDS = {
  claude: ["mcp", "add", "--transport", "http", "--scope", "user", "siteory", MCP_URL],
  gemini: ["mcp", "add", "--transport", "http", "-s", "user", "siteory", MCP_URL],
  vscode: ["--add-mcp", JSON.stringify({ name: "siteory", type: "http", url: MCP_URL })],
};

const json = (value) => JSON.stringify(value, null, 2);
const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=siteory&config=${Buffer.from(JSON.stringify(SNIPPETS.cursor.mcpServers.siteory)).toString("base64")}`;

export const CLIENTS = {
  "claude-code": {
    label: "Claude Code",
    guide: [
      `claude mcp add --transport http --scope user siteory ${MCP_URL}`,
      "Then run /mcp in Claude Code, select siteory and choose Authenticate.",
      "",
      "Or install the plugin, which also adds the skills. Use the plugin or the command above, not both, or the tools appear twice:",
      "/plugin marketplace add cyb3r-vishal/siteory-skills",
      "/plugin install siteory@siteory",
    ],
  },
  "claude-ai": {
    label: "claude.ai, Claude Desktop and Cowork",
    guide: [
      "Open Customize > Connectors > Add custom connector, enter this URL and select Connect:",
      MCP_URL,
      "On Team and Enterprise plans an owner adds it under Organization settings > Connectors, then members select Connect.",
    ],
  },
  cursor: {
    label: "Cursor",
    guide: [
      "Add to ~/.cursor/mcp.json (all projects) or .cursor/mcp.json (one project):",
      json(SNIPPETS.cursor),
      `Install link: ${cursorLink}`,
      "Cursor opens a browser window to sign in the first time it connects.",
    ],
  },
  vscode: {
    label: "VS Code",
    guide: [
      `macOS and Linux: code --add-mcp '${COMMANDS.vscode[1]}'`,
      "Any platform, including Windows where shells mangle the quotes above: run \"MCP: Open User Configuration\" (or edit .vscode/mcp.json in a project) and add:",
      json(SNIPPETS.vscode),
      "Then run \"MCP: List Servers\", start siteory and sign in when VS Code asks.",
    ],
  },
  codex: {
    label: "Codex",
    guide: [
      "Add to ~/.codex/config.toml (or $CODEX_HOME/config.toml):",
      CODEX_TOML.trimEnd(),
      "Then sign in: codex mcp login siteory",
    ],
  },
  chatgpt: {
    label: "ChatGPT",
    guide: [
      "In ChatGPT, open Plugins, choose + > Add custom MCP server, enter this URL and choose OAuth:",
      MCP_URL,
      "Custom MCP servers need developer mode on a plan that offers it.",
    ],
  },
  gemini: {
    label: "Gemini CLI",
    guide: [
      `gemini mcp add --transport http -s user siteory ${MCP_URL}`,
      "Or add to ~/.gemini/settings.json (httpUrl means streamable HTTP; url would mean SSE):",
      json(SNIPPETS.gemini),
      "Then run /mcp auth siteory in Gemini CLI.",
    ],
  },
  antigravity: {
    label: "Antigravity",
    guide: [
      "Add to ~/.gemini/config/mcp_config.json (or .agents/mcp_config.json in a workspace):",
      json(SNIPPETS.antigravity),
      "Antigravity opens a browser window to sign in when it first connects.",
    ],
  },
  opencode: {
    label: "OpenCode",
    guide: [
      "Add to ~/.config/opencode/opencode.json (or opencode.json in a project):",
      json(SNIPPETS.opencode),
      "Then sign in: opencode mcp auth siteory",
    ],
  },
  windsurf: {
    label: "Windsurf",
    guide: [
      "Add to ~/.codeium/windsurf/mcp_config.json:",
      json(SNIPPETS.windsurf),
      "Refresh the MCP panel and sign in when Windsurf asks.",
    ],
  },
  other: {
    label: "Any other MCP client",
    guide: [
      `Clients that support remote servers with OAuth take the URL directly: ${MCP_URL}`,
      "Clients that only run local (stdio) servers can use the mcp-remote bridge, which opens the browser sign-in for them:",
      json(SNIPPETS.other),
    ],
  },
};
