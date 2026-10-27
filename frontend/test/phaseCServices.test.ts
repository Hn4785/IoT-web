import assert from "node:assert/strict";
import test from "node:test";

import { API_ENDPOINTS } from "../src/api/endpoints.ts";
import { createAlertService } from "../src/services/alertService.ts";
import { createNotificationService } from "../src/services/notificationService.ts";
import { createDeviceCapabilityService } from "../src/services/deviceCapabilityService.ts";

function envelope<T>(data: T) {
  return { data: { success: true as const, data } };
}

test("alert mutations include unique non-empty Idempotency-Key header", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(): Promise<{ data: T }> { return envelope({}) as { data: T }; },
    async post<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return envelope({ id: "alert-1", name: "Rule" }) as { data: T };
    },
    async patch<T>(): Promise<{ data: T }> { return envelope({}) as { data: T }; },
  };
  const service = createAlertService(client);

  await service.acknowledge("alert-1", "Checked onsite");
  await service.resolve("alert-1", "Recovered");
  await service.createRule("station-1", {
    name: "High Temp",
    metric: "temperature",
    operator: "ABOVE",
    threshold: 40,
    severity: "CRITICAL",
    mode: "AUTOMATIC",
  });

  assert.equal(calls.length, 3);
  const keys = calls.map((call) => {
    const config = call[2] as { headers?: Record<string, string> } | undefined;
    return config?.headers?.["Idempotency-Key"];
  });

  for (const key of keys) {
    assert.equal(typeof key, "string");
    assert.ok(key && key.length > 0);
    assert.ok(key.length <= 160);
  }
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, 3);
});

test("alert and rule lists preserve cursor contracts", async () => {
  const calls: unknown[][] = [];
  const page = { items: [], nextCursor: "next" };
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return envelope(page) as { data: T };
    },
    async post<T>(): Promise<{ data: T }> { return envelope({}) as { data: T }; },
    async patch<T>(): Promise<{ data: T }> { return envelope({}) as { data: T }; },
  };
  const service = createAlertService(client);

  assert.equal((await service.listAlerts({ status: "OPEN", limit: 20 })).nextCursor, "next");
  assert.equal((await service.listRules("station-1", { limit: 20 })).nextCursor, "next");
  assert.deepEqual(calls, [
    ["/alerts", { params: { status: "OPEN", limit: 20 } }],
    ["/stations/station-1/alert-rules", { params: { limit: 20 } }],
  ]);
});

test("alert rule setup reads confirmed field metadata from the selected station", async () => {
  const calls: unknown[][] = [];
  const fields = [{ field: "moisture", unit: "%", metadataRevision: "soil-v1" }];
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return envelope({ fields }) as { data: T };
    },
    async post<T>(): Promise<{ data: T }> { return envelope({}) as { data: T }; },
    async patch<T>(): Promise<{ data: T }> { return envelope({}) as { data: T }; },
  };

  const metadata = await createAlertService(client).getFieldMetadata("station-1");

  assert.deepEqual(metadata.fields, fields);
  assert.deepEqual(calls, [["/stations/station-1/field-metadata"]]);
});

test("notification service unwraps inbox and updates read state", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(["get", ...args]);
      return envelope({ items: [], nextCursor: null, unreadCount: 3 }) as { data: T };
    },
    async patch<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(["patch", ...args]);
      return envelope({ id: "notification-1", isRead: true }) as { data: T };
    },
  };
  const service = createNotificationService(client);

  assert.equal((await service.list({ isRead: false, limit: 50 })).unreadCount, 3);
  assert.equal((await service.setRead("notification-1", true)).isRead, true);
  assert.deepEqual(calls, [
    ["get", "/notifications", { params: { isRead: false, limit: 50 } }],
    ["patch", "/notifications/notification-1", { isRead: true }],
  ]);
});

test("phase C endpoints stay aligned with backend routes", () => {
  assert.equal(API_ENDPOINTS.alerts.acknowledgements("a"), "/alerts/a/acknowledgements");
  assert.equal(API_ENDPOINTS.alerts.resolutions("a"), "/alerts/a/resolutions");
  assert.equal(API_ENDPOINTS.alertRules.byStation("s"), "/stations/s/alert-rules");
  assert.equal(API_ENDPOINTS.stations.fieldMetadata("s"), "/stations/s/field-metadata");
  assert.equal(API_ENDPOINTS.notifications.byId("n"), "/notifications/n");
  assert.equal(API_ENDPOINTS.deviceConfigurations.capability, "/device-configurations/capability");
});

test("device UI reads the backend capability boundary", async () => {
  const calls: string[] = [];
  const service = createDeviceCapabilityService({
    async get<T>(url: string): Promise<{ data: T }> {
      calls.push(url);
      return envelope({ status: "NOT_AVAILABLE", reasonCode: "DEVICE_CONTRACT_PENDING" }) as { data: T };
    },
  });

  assert.deepEqual(await service.get(), {
    status: "NOT_AVAILABLE",
    reasonCode: "DEVICE_CONTRACT_PENDING",
  });
  assert.deepEqual(calls, ["/device-configurations/capability"]);
});
