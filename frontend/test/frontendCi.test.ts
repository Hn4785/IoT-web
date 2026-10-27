import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("Frontend CI Workflow", () => {
  const workflowPath = path.resolve(process.cwd(), "../.github/workflows/frontend-ci.yml");

  test("workflow file exists and meets all CI constraints", () => {
    assert.equal(fs.existsSync(workflowPath), true, "frontend-ci.yml must exist");
    const content = fs.readFileSync(workflowPath, "utf8");

    // Runner OS
    assert.match(content, /runs-on:\s*ubuntu-24\.04/, "must use ubuntu-24.04 runner");

    // Triggers for the default branch
    assert.match(content, /push:\s*\n\s*branches:\s*\[\s*main\s*\]/, "push must trigger on main only");
    assert.match(content, /pull_request:\s*\n\s*branches:\s*\[\s*main\s*\]/, "pull_request must trigger on main only");
    assert.doesNotMatch(content, /master|develop|feature\/\*|agent\/\*/, "must not include other branch patterns");

    // Permissions
    assert.match(content, /permissions:\s*\n\s*contents:\s*read/, "must specify read-only contents permissions");

    // Pinned actions
    assert.match(content, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/, "checkout action must be pinned to exact SHA");
    assert.match(content, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/, "setup-node action must be pinned to exact SHA");

    // Node version & cache
    assert.match(content, /node-version:\s*['"]?24\.17\.0['"]?/, "must use Node 24.17.0");
    assert.match(content, /cache:\s*['"]?npm['"]?/, "must cache npm");
    assert.match(content, /cache-dependency-path:\s*frontend\/package-lock\.json/, "must cache the frontend lockfile");
    assert.match(content, /defaults:\s*\n\s*run:\s*\n\s*working-directory:\s*frontend/, "must run frontend commands in their package directory");

    // Timeout
    assert.match(content, /timeout-minutes:\s*15/, "must set 15-minute timeout");

    // Steps & gates
    assert.match(content, /npm ci --ignore-scripts/, "must run npm ci with ignore-scripts");
    assert.match(content, /npx playwright install --with-deps chromium/, "must install playwright chromium with deps");
    assert.match(content, /npm test/, "must run unit tests");
    assert.match(content, /npm run lint/, "must run linter");
    assert.match(content, /npm run build/, "must build project");
    assert.match(content, /npm run test:e2e -- e2e\/smoke\.spec\.ts/, "must run e2e smoke test");
    assert.match(content, /npm audit --audit-level=high/, "must run npm audit with high audit-level");

    // No weakening flags
    assert.doesNotMatch(content, /continue-on-error:\s*true/i, "must not use continue-on-error");
  });
});
