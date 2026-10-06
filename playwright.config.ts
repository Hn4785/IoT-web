import { defineConfig } from "@playwright/test";

const isRealApi = process.env.QA_REAL_API === "true";
const devApiProxyTarget = isRealApi
  ? "http://127.0.0.1:3001"
  : (process.env.DEV_API_PROXY_TARGET || "http://127.0.0.1:3000");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    env: {
      ...process.env,
      DEV_API_PROXY_TARGET: devApiProxyTarget,
    },
  },
});
