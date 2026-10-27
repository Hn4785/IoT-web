import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createServer, loadConfigFromFile } from "vite";

test("local Vite forwards login requests to the API instead of returning its own 404", async () => {
  const forwardedPaths: string[] = [];
  const backend = createHttpServer((request, response) => {
    forwardedPaths.push(request.url ?? "");
    response.writeHead(418, { "x-proxy-test": "backend" });
    response.end();
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address !== "string");
  const previousTarget = process.env.DEV_API_PROXY_TARGET;
  process.env.DEV_API_PROXY_TARGET = `http://127.0.0.1:${address.port}`;

  let vite: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    const loaded = await loadConfigFromFile({ command: "serve", mode: "development" });
    assert.ok(loaded);
    vite = await createServer({
      ...loaded.config,
      configFile: false,
      server: { ...loaded.config.server, host: "127.0.0.1", port: 0 },
    });
    await vite.listen();
    const viteAddress = vite.httpServer?.address();
    assert.ok(viteAddress && typeof viteAddress !== "string");
    const response = await fetch(`http://127.0.0.1:${viteAddress.port}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 418);
    assert.equal(response.headers.get("x-proxy-test"), "backend");
    assert.deepEqual(forwardedPaths, ["/api/v1/auth/login"]);
  } finally {
    await vite?.close();
    await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
    if (previousTarget === undefined) delete process.env.DEV_API_PROXY_TARGET;
    else process.env.DEV_API_PROXY_TARGET = previousTarget;
  }
});
