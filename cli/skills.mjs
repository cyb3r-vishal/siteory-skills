// Reads the bundled skills. The frontmatter parser accepts only the YAML subset that
// every skills client can read: "key: value" lines plus one level of nested map.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));

/** The bundled skills, sorted by name: [{ name, description, dir }]. */
export function listSkills(skillsDir = SKILLS_DIR) {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(skillsDir, entry.name);
      const { data } = parseFrontmatter(readFileSync(join(dir, "SKILL.md"), "utf8"));
      return { name: entry.name, description: String(data.description ?? ""), dir };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Splits SKILL.md into frontmatter data and body. Throws an Error that names the line
 * for anything outside the supported subset.
 */
export function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) {
    throw new Error("SKILL.md must start with a \"---\" line (no BOM, LF line endings).");
  }
  const end = text.indexOf("\n---", 3);
  const after = text.charAt(end + 4);
  if (end === -1 || (after !== "\n" && after !== "")) {
    throw new Error("The frontmatter has no closing \"---\" line.");
  }
  const data = {};
  let nested = null;
  text.slice(4, end).split("\n").forEach((line, index) => {
    const lineNo = index + 2;
    if (line.trim() === "" || line.trimStart().startsWith("#")) return;
    if (line.startsWith(" ")) {
      const match = line.match(/^ {2}([A-Za-z0-9_-]+): (.+)$/);
      if (!nested || !match) throw new Error(`Line ${lineNo}: unexpected indentation.`);
      nested[match[1]] = scalar(match[2], lineNo);
      return;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):(?: (.*))?$/);
    if (!match) throw new Error(`Line ${lineNo}: expected "key: value".`);
    if (Object.hasOwn(data, match[1])) throw new Error(`Line ${lineNo}: duplicate key "${match[1]}".`);
    if (!match[2]?.trim()) {
      nested = data[match[1]] = {};
      return;
    }
    nested = null;
    data[match[1]] = scalar(match[2], lineNo);
  });
  return { data, body: text.slice(end + 5) };
}

const NON_STRING = /^(?:true|false|yes|no|on|off|null|~|[-+]?(?:\d[\d_]*)?\.?\d+(?:[eE][-+]?\d+)?|0x[0-9a-fA-F]+|0o[0-7]+|[-+]?\.(?:inf|nan))$/i;

function scalar(raw, lineNo) {
  const value = raw.trim();
  if (value.startsWith("\"")) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Line ${lineNo}: invalid double-quoted string.`);
    }
  }
  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'") || value.slice(1, -1).replaceAll("''", "").includes("'")) {
      throw new Error(`Line ${lineNo}: invalid single-quoted string.`);
    }
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (/^[-?:,[\]{}#&*!|>%@`]/.test(value) || /: | #/.test(value) || value.endsWith(":")) {
    throw new Error(`Line ${lineNo}: quote this value; it contains YAML syntax.`);
  }
  if (NON_STRING.test(value)) {
    throw new Error(`Line ${lineNo}: quote "${value}"; YAML reads it as a number, boolean or null.`);
  }
  return value;
}
