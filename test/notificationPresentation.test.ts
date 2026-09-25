import assert from "node:assert/strict";
import test from "node:test";

import { toNotificationView } from "../src/components/notifications/notificationView.ts";
import type { NotificationDto } from "../src/types/notification.ts";

const notification: NotificationDto = {
  id: "notification-1",
  alertId: "alert-1",
  eventType: "OPENED",
  station: { id: "station-1", code: "NODE01", name: "Station NODE01" },
  field: "MOISTURE",
  severity: "CRITICAL",
  alertStatus: "OPEN",
  isRead: false,
  createdAt: "2026-09-25T09:00:00.000Z",
  readAt: null,
};

test("notification presentation uses the backend event, station, and read state", () => {
  assert.deepEqual(toNotificationView(notification), {
    id: "notification-1",
    alertId: "alert-1",
    title: "Alert opened · NODE01",
    message: "MOISTURE at Station NODE01",
    stationCode: "NODE01",
    severity: "critical",
    createdAt: "2026-09-25T09:00:00.000Z",
    isRead: false,
  });
});

test("notification presentation reflects resolved warnings without inventing device data", () => {
  assert.deepEqual(toNotificationView({
    ...notification,
    id: "notification-2",
    eventType: "RESOLVED",
    severity: "WARNING",
    isRead: true,
  }), {
    id: "notification-2",
    alertId: "alert-1",
    title: "Alert resolved · NODE01",
    message: "MOISTURE at Station NODE01",
    stationCode: "NODE01",
    severity: "warning",
    createdAt: "2026-09-25T09:00:00.000Z",
    isRead: true,
  });
});
