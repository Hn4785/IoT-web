CREATE TABLE "NotificationDeliveryJob" (
    "lifecycleEventId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "stationCode" VARCHAR(80) NOT NULL,
    "stationName" VARCHAR(160) NOT NULL,
    "field" "SoilAlertField" NOT NULL,
    "severity" "AlertRuleSeverity" NOT NULL,
    "alertStatus" "AlertStatus" NOT NULL,
    "cursorUserId" UUID,
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDeliveryJob_pkey" PRIMARY KEY ("lifecycleEventId")
);

CREATE INDEX "NotificationDeliveryJob_deliveredAt_createdAt_lifecycleEventId_idx"
    ON "NotificationDeliveryJob"("deliveredAt", "createdAt", "lifecycleEventId");

ALTER TABLE "NotificationDeliveryJob" ADD CONSTRAINT "NotificationDeliveryJob_lifecycleEventId_fkey"
    FOREIGN KEY ("lifecycleEventId") REFERENCES "AlertLifecycleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Historical deliveries are already materialized. Capture the best available
-- display values once, then mark these jobs complete so migration never resends.
INSERT INTO "NotificationDeliveryJob" (
    "lifecycleEventId", "farmId", "stationId", "stationCode", "stationName",
    "field", "severity", "alertStatus", "deliveredAt", "createdAt"
)
SELECT event."id", plot."farmId", station."id", station."upstreamCode", station."name",
       rule."field", rule."severity",
       CASE event."type"
           WHEN 'OPENED' THEN 'OPEN'::"AlertStatus"
           WHEN 'ACKNOWLEDGED' THEN 'ACKNOWLEDGED'::"AlertStatus"
           ELSE 'RESOLVED'::"AlertStatus"
       END,
       CURRENT_TIMESTAMP, event."createdAt"
FROM "AlertLifecycleEvent" AS event
JOIN "Alert" AS alert ON alert."id" = event."alertId"
JOIN "AlertRule" AS rule ON rule."id" = alert."ruleId"
JOIN "Station" AS station ON station."id" = rule."stationId"
JOIN "Plot" AS plot ON plot."id" = station."plotId";
