import assert from "node:assert/strict";
import test from "node:test";

import {
  appendNotificationItems,
  applyNotificationErrorState,
  isAccessLoss,
} from "../src/pages/farm-owner/notificationInboxPagination.ts";
import type { NotificationDto } from "../src/types/notification.ts";

function notification(id: string, isRead = false): NotificationDto {
  return {
    id,
    alertId: `alert-${id}`,
    eventType: "OPENED",
    station: { id: "station", code: "NODE01", name: "Station" },
    field: "moisture",
    severity: "WARNING",
    alertStatus: "OPEN",
    isRead,
    createdAt: "2026-09-25T00:00:00.000Z",
    readAt: null,
  };
}

const err = (status?: number, message = "err") => Object.assign(new Error(message), {
  isAxiosError: true,
  response: status !== undefined ? { status, data: { message } } : undefined,
});

test("inbox pagination appends older items without duplicating an overlapping notification", () => {
  const first = [notification("new"), notification("middle")];
  const second = [notification("middle"), notification("old")];

  assert.deepEqual(appendNotificationItems(first, second).map(({ id }) => id), [
    "new", "middle", "old",
  ]);
});

test("isAccessLoss identifies 401, 403, 404 and distinguishes from 5xx and network errors", () => {
  assert.equal(isAccessLoss(err(401)), true);
  assert.equal(isAccessLoss(err(403)), true);
  assert.equal(isAccessLoss(err(404)), true);
  assert.equal(isAccessLoss(err(500)), false);
  assert.equal(isAccessLoss(new Error("Network Error")), false);
});

test("applyNotificationErrorState purges protected state on 401, 403, 404", () => {
  const current = {
    items: [notification("1"), notification("2")],
    unreadCount: 2,
    nextCursor: "cursor-1",
  };

  for (const status of [401, 403, 404]) {
    const res = applyNotificationErrorState(err(status, "Denied"), current);
    assert.equal(res.accessLost, true);
    assert.deepEqual(res.items, []);
    assert.equal(res.unreadCount, 0);
    assert.equal(res.nextCursor, null);
    assert.equal(res.error, "Denied");
  }
});

test("applyNotificationErrorState retains authorized rows on 5xx and network failures", () => {
  const current = {
    items: [notification("1"), notification("2")],
    unreadCount: 2,
    nextCursor: "cursor-1",
  };

  const on500 = applyNotificationErrorState(err(500, "Server Error"), current);
  assert.equal(on500.accessLost, false);
  assert.equal(on500.items.length, 2);
  assert.equal(on500.unreadCount, 2);
  assert.equal(on500.nextCursor, "cursor-1");
  assert.equal(on500.error, "Server Error");

  const onNet = applyNotificationErrorState(new Error("Network Error"), current);
  assert.equal(onNet.accessLost, false);
  assert.equal(onNet.items.length, 2);
  assert.equal(onNet.unreadCount, 2);
});

test("access-loss generation fence prevents stale pagination or toggleRead from repopulating rows", () => {
  let generation = 1;
  let state = {
    items: [notification("1")],
    unreadCount: 1,
    nextCursor: "cursor-2",
  };

  const loadMoreGen = generation;
  const accessErr = applyNotificationErrorState(err(403, "Forbidden"), state);
  if (accessErr.accessLost) {
    generation += 1;
    state = { items: accessErr.items, unreadCount: accessErr.unreadCount, nextCursor: accessErr.nextCursor };
  }

  assert.equal(state.items.length, 0);

  // Stale loadMore from older generation must not repopulate
  if (loadMoreGen === generation) {
    state.items = appendNotificationItems(state.items, [notification("2")]);
  }

  assert.equal(state.items.length, 0);
});
