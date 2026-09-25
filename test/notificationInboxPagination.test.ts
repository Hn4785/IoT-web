import assert from "node:assert/strict";
import test from "node:test";

import { appendNotificationItems } from "../src/pages/farm-owner/notificationInboxPagination.ts";
import type { NotificationDto } from "../src/types/notification.ts";

function notification(id: string): NotificationDto {
  return {
    id,
    alertId: `alert-${id}`,
    eventType: "OPENED",
    station: { id: "station", code: "NODE01", name: "Station" },
    field: "moisture",
    severity: "WARNING",
    alertStatus: "OPEN",
    isRead: false,
    createdAt: "2026-09-25T00:00:00.000Z",
    readAt: null,
  };
}

test("inbox pagination appends older items without duplicating an overlapping notification", () => {
  const first = [notification("new"), notification("middle")];
  const second = [notification("middle"), notification("old")];

  assert.deepEqual(appendNotificationItems(first, second).map(({ id }) => id), [
    "new", "middle", "old",
  ]);
});
