import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { listSkills, parseFrontmatter } from "../cli/skills.mjs";

const TMP = mkdtempSync(join(tmpdir(), "siteory-skills-test-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const VALIDATOR = fileURLToPath(new URL("../scripts/validate-skills.mjs", import.meta.url));
const validate = (dir) => spawnSync(process.execPath, [VALIDATOR, ...(dir ? [dir] : [])], { encoding: "utf8" });

function skill(root, dir, text, extra = {}) {
  const files = { "SKILL.md": text, ...extra };
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

const frontmatter = (fields, body = "# Title\n\nBody.\n") => `---\n${fields}\n---\n${body}`;
const valid = (name) => frontmatter(`name: ${name}\ndescription: Does one thing. Use when testing.\nlicense: MIT\nmetadata:\n  author: siteory\n  version: "0.1.0"`);

test("the bundled skills pass validation", () => {
  const run = validate();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /10 skills passed validation\./);
  assert.deepEqual(listSkills().map((skill) => skill.name), [
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
  ]);
});

test("the validator reports each broken skill", () => {
  const root = mkdtempSync(join(TMP, "siteory-skills-"));
  skill(root, "good-skill", valid("good-skill"), { "references/guide.md": "x", "scripts/run.mjs": "x" });
  // The good skill mentions both files:
  skill(root, "good-skill", valid("good-skill").replace("Body.", "See references/guide.md and run scripts/run.mjs."));
  skill(root, "bom-skill", `﻿${valid("bom-skill")}`);
  skill(root, "crlf-skill", valid("crlf-skill").replaceAll("\n", "\r\n"));
  skill(root, "wrong-name", valid("other-name"));
  skill(root, "extra-field", valid("extra-field").replace("license: MIT", "license: MIT\nallowed-tools: Bash"));
  skill(root, "long-desc", frontmatter(`name: long-desc\ndescription: ${"a".repeat(1025)}`));
  skill(root, "colon-desc", frontmatter("name: colon-desc\ndescription: Audits: everything"));
  skill(root, "number-meta", frontmatter("name: number-meta\ndescription: Fine.\nmetadata:\n  version: 1.0"));
  skill(root, "missing-ref", valid("missing-ref").replace("Body.", "Read references/nope.md first."));
  skill(root, "orphan-ref", valid("orphan-ref"), { "references/unlinked.md": "x" });
  skill(root, "long-body", valid("long-body").replace("Body.", "line\n".repeat(400)));
  mkdirSync(join(root, "no-skill-md"));
  writeFileSync(join(root, "no-skill-md", "README.md"), "x");

  const run = validate(root);
  assert.equal(run.status, 1);
  const expected = {
    "bom-skill": /SKILL\.md starts with a UTF-8 BOM/,
    "crlf-skill": /SKILL\.md has CR characters/,
    "wrong-name": /name "other-name" must equal the directory name "wrong-name"/,
    "extra-field": /field "allowed-tools" is not portable/,
    "long-desc": /description must be 1-1024 characters \(has 1025\)/,
    "colon-desc": /quote this value; it contains YAML syntax/,
    "number-meta": /quote "1\.0"; YAML reads it as a number/,
    "missing-ref": /mentions references\/nope\.md, which does not exist/,
    "orphan-ref": /references\/unlinked\.md is never mentioned in SKILL\.md/,
    "long-body": /body has \d+ lines; keep it under 400/,
    "no-skill-md": /SKILL\.md is missing\./,
  };
  for (const [name, message] of Object.entries(expected)) {
    assert.match(run.stderr, new RegExp(`^${name}: .*${message.source}`, "m"), name);
  }
  assert.doesNotMatch(run.stderr, /^good-skill:/m);
  assert.match(run.stderr, /11 of 12 skills failed validation\./);
});

test("parseFrontmatter reads the portable YAML subset", () => {
  const { data, body } = parseFrontmatter([
    "---",
    "name: demo",
    "description: \"Say \\\"hi\\\" in two words\"",
    "license: 'MIT'",
    "compatibility: 'It''s fine'",
    "# a comment",
    "metadata:",
    "  author: siteory",
    "  version: \"0.1.0\"",
    "---",
    "Body text",
  ].join("\n"));
  assert.deepEqual(data, {
    name: "demo",
    description: "Say \"hi\" in two words",
    license: "MIT",
    compatibility: "It's fine",
    metadata: { author: "siteory", version: "0.1.0" },
  });
  assert.equal(body, "Body text");
});

test("parseFrontmatter rejects what other skill clients would misread", () => {
  const cases = {
    "no opening line": "name: x\n",
    "no closing line": "---\nname: x\n",
    "duplicate key": "---\nname: x\nname: y\n---\n",
    "stray indentation": "---\n  name: x\n---\n",
    "block scalar": "---\ndescription: >\n  folded\n---\n",
    "boolean value": "---\nname: true\n---\n",
    "unterminated quote": "---\nname: 'x\n---\n",
    "comment in value": "---\nname: x # note\n---\n",
  };
  for (const [label, text] of Object.entries(cases)) assert.throws(() => parseFrontmatter(text), Error, label);
});
