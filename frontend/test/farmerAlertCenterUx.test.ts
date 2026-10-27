import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createAlertService } from "../src/services/alertService.ts";

const sidebar = readFileSync(new URL("../src/components/layout/Sidebar.tsx", import.meta.url), "utf8");
const routeConfig = readFileSync(new URL("../src/routes/routeConfig.tsx", import.meta.url), "utf8");
const routeComponents = readFileSync(new URL("../src/routes/routeComponents.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/alerts/AlertWorkspace.tsx", import.meta.url), "utf8");

test("service response mapping includes canManageRules boolean capability", async () => {
  const fields = [{ field: "temperature", unit: "°C", metadataRevision: "rev-1" }];
  const clientOwner = {
    async get<T>(): Promise<{ data: T }> {
      return { data: { success: true, data: { fields, canManageRules: true } } } as { data: T };
    },
    async post<T>(): Promise<{ data: T }> { return { data: {} } as { data: T }; },
    async patch<T>(): Promise<{ data: T }> { return { data: {} } as { data: T }; },
  };

  const ownerMeta = await createAlertService(clientOwner).getFieldMetadata("station-owner");
  assert.equal(ownerMeta.canManageRules, true);
  assert.deepEqual(ownerMeta.fields, fields);

  const clientViewer = {
    async get<T>(): Promise<{ data: T }> {
      return { data: { success: true, data: { fields, canManageRules: false } } } as { data: T };
    },
    async post<T>(): Promise<{ data: T }> { return { data: {} } as { data: T }; },
    async patch<T>(): Promise<{ data: T }> { return { data: {} } as { data: T }; },
  };

  const viewerMeta = await createAlertService(clientViewer).getFieldMetadata("station-viewer");
  assert.equal(viewerMeta.canManageRules, false);
});

test("Farmer navigation keeps one Alert Center item and removes duplicate Alerts entry", () => {
  assert.match(sidebar, /label:\s*['"]Alert Center['"],\s*path:\s*['"]\/farm-owner\/alert-center['"]/);
  assert.doesNotMatch(sidebar, /path:\s*['"]\/farm-owner\/alerts['"]/);
  assert.doesNotMatch(sidebar, /label:\s*['"]Alerts['"]/);
});

test("routing preserves legacy /farm-owner/alerts as role-protected redirect without duplicate component imports", () => {
  assert.doesNotMatch(routeComponents, /AgriculturalAlerts/);
  assert.doesNotMatch(routeConfig, /import\b.*AgriculturalAlerts/);
  assert.match(routeConfig, /path:\s*['"]\/farm-owner\/alert-center['"][\s\S]*?roles:\s*\[['"]FARMER['"]\]/);
  assert.match(
    routeConfig,
    /path:\s*['"]\/farm-owner\/alerts['"][\s\S]*?roles:\s*\[['"]FARMER['"]\][\s\S]*?Navigate\s+to=['"]\/farm-owner\/alert-center['"]/,
  );
});

test("AlertWorkspace gates rule management controls by canManageRules capability and provides read-only copy", () => {
  assert.match(workspace, /canManageRules/);
  assert.match(workspace, /canManageRules\s*(&&|\?)/);
  assert.match(workspace, /managed by the (data\s+)?source owner/i);
  assert.match(workspace, /read-only/i);
});

test("AlertWorkspace presents rules as Automatic or Paused with simple English explanation", () => {
  assert.match(workspace, /Automatic/);
  assert.match(workspace, /Paused/);
  assert.match(workspace, /evaluate(s)? new samples and notify(ies)? authorized accounts/i);
  assert.doesNotMatch(workspace, /remote.*control/i);
});

test("AlertWorkspace truthfully explains empty field metadata without N/A", () => {
  assert.match(workspace, /confirmed measurement units are not available;\s*monitoring remains available/i);
  assert.doesNotMatch(workspace, />\s*N\/A\s*</);
  assert.doesNotMatch(workspace, /['"]N\/A['"]/);
});
