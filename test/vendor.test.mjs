import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const TMP = mkdtempSync(join(tmpdir(), "siteory-skills-test-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const SCRIPT = fileURLToPath(new URL("../scripts/vendor-engine.mjs", import.meta.url));

/** A throwaway copy of the repository layout, so vendoring never touches the real files. */
function fakeRepo() {
  const root = mkdtempSync(join(TMP, "siteory-vendor-"));
  mkdirSync(join(root, "scripts"));
  copyFileSync(SCRIPT, join(root, "scripts", "vendor-engine.mjs"));
  mkdirSync(join(root, "cli"));
  writeFileSync(join(root, "cli", "engine.mjs"), "old engine");
  mkdirSync(join(root, "skills", "alpha", "scripts"), { recursive: true });
  writeFileSync(join(root, "skills", "alpha", "scripts", "siteory.mjs"), "old engine");
  mkdirSync(join(root, "skills", "beta")); // no scripts/ folder yet
  return root;
}

const vendor = (root, args) => spawnSync(process.execPath, [join(root, "scripts", "vendor-engine.mjs"), ...args], { encoding: "utf8" });
const targets = (root) => [join(root, "cli", "engine.mjs"), join(root, "skills", "alpha", "scripts", "siteory.mjs"), join(root, "skills", "beta", "scripts", "siteory.mjs")];

test("copies a valid engine bundle into the CLI and every skill", () => {
  const root = fakeRepo();
  const bundle = join(root, "bundle.mjs");
  const source = "#!/usr/bin/env node\nexport const VERSION = \"9.9.9\";\nexport async function runCli() { return 0; }\n";
  writeFileSync(bundle, source);

  const run = vendor(root, ["--from", bundle]);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Vendored engine 9\.9\.9/);
  for (const target of targets(root)) assert.equal(readFileSync(target, "utf8"), source, target);
});

test("refuses files that are not the engine and leaves the old copies in place", () => {
  const root = fakeRepo();
  const notEngine = join(root, "not-engine.mjs");
  writeFileSync(notEngine, "export const VERSION = \"1\";\n");
  const broken = join(root, "broken.mjs");
  writeFileSync(broken, "export const = ;\n");

  const cases = [
    [["--from", notEngine], /does not export runCli/],
    [["--from", broken], /cannot import/],
    [["--from", join(root, "missing.mjs")], /cannot read .*ENOENT/],
    [["--bogus"], /Unknown option/],
  ];
  for (const [args, message] of cases) {
    const run = vendor(root, args);
    assert.equal(run.status, 1, args.join(" "));
    assert.match(run.stderr, message, args.join(" "));
  }
  assert.equal(readFileSync(join(root, "cli", "engine.mjs"), "utf8"), "old engine");
  assert.ok(!existsSync(join(root, "skills", "beta", "scripts")));
});
