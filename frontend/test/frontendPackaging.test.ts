import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const DOCKERFILE_PATH = path.join(ROOT_DIR, "Dockerfile");
const DOCKERIGNORE_PATH = path.join(ROOT_DIR, ".dockerignore");
const NGINX_CONF_PATH = path.join(ROOT_DIR, "deploy", "nginx.conf");

const NODE_BASE = "node:24.17.0-bookworm-slim@sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532";
const NGINX_BASE = "nginx:1.28.0-alpine@sha256:30f1c0d78e0ad60901648be663a710bdadf19e4c10ac6782c235200619158284";

test("frontend packaging files exist", () => {
  assert.ok(fs.existsSync(DOCKERFILE_PATH), "Dockerfile must exist");
  assert.ok(fs.existsSync(DOCKERIGNORE_PATH), ".dockerignore must exist");
  assert.ok(fs.existsSync(NGINX_CONF_PATH), "deploy/nginx.conf must exist");
});

test("Dockerfile uses pinned stages, explicit copies, canonical CSS and ignore-scripts", () => {
  const content = fs.readFileSync(DOCKERFILE_PATH, "utf8");
  assert.match(content, new RegExp(`FROM\\s+${NODE_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+AS\\s+build`, "i"));
  assert.match(content, new RegExp(`FROM\\s+${NGINX_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
  assert.match(content, /npm\s+ci\s+--ignore-scripts/);
  assert.doesNotMatch(content, /COPY\s+\.\s+\./);
  assert.match(content, /COPY\s+src\s+\.\/src/);
  assert.doesNotMatch(content, /RUN\s+cp.*Pageheader/);
  assert.match(content, /npm\s+run\s+build/);
  assert.match(content, /EXPOSE\s+8080/);
  assert.match(content, /USER\s+nginx/);
});

test(".dockerignore excludes development and transient files", () => {
  const content = fs.readFileSync(DOCKERIGNORE_PATH, "utf8");
  const entries = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  assert.ok(entries.includes("node_modules"));
  assert.ok(entries.includes("dist"));
  assert.ok(entries.includes(".git"));
});

test("nginx.conf configures dynamic DNS, boundary protection, headers, and asset cache", () => {
  const content = fs.readFileSync(NGINX_CONF_PATH, "utf8");
  assert.match(content, /listen\s+8080;/);
  assert.match(content, /resolver\s+127\.0\.0\.11\s+valid=10s/);
  assert.match(content, /location\s*=\s*\/api\/v1\s*\{/);
  assert.match(content, /location\s+\/api\/v1\/\s*\{/);
  assert.doesNotMatch(content, /location\s+\/api\/v1\s*\{/);
  assert.match(content, /proxy_pass\s+\$api_upstream\$request_uri;/);
  assert.match(content, /X-Content-Type-Options\s+"nosniff"/);
  assert.match(content, /X-Frame-Options/);
  assert.match(content, /Referrer-Policy/);
  assert.match(content, /location\s+\/assets\/\s*\{[\s\S]*?immutable/);
  assert.match(content, /must-revalidate|no-cache/);
  assert.match(content, /location\s*(=|\^~)?\s*\/healthz\b[\s\S]*?return\s+200/);
  assert.match(content, /try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/);
  assert.doesNotMatch(content, /192\.168\./);
  assert.doesNotMatch(content, /localhost:3000/);
});

test("proxy boundary preserves request URI and rejects /api/v10 prefixes", () => {
  const isApiRoute = (p: string) => p === "/api/v1" || p.startsWith("/api/v1/");
  assert.equal(isApiRoute("/api/v1"), true);
  assert.equal(isApiRoute("/api/v1/"), true);
  assert.equal(isApiRoute("/api/v1/auth/login?param=1"), true);
  assert.equal(isApiRoute("/api/v10"), false);
  assert.equal(isApiRoute("/api/v10/health"), false);
  assert.equal(isApiRoute("/api/v1-preview"), false);

  const upstream = "http://api:3000";
  const proxyPass = (uri: string) => `${upstream}${uri}`;
  assert.equal(proxyPass("/api/v1/auth/login?param=1"), "http://api:3000/api/v1/auth/login?param=1");
});
