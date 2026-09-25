ALTER TABLE "NotificationDeliveryJob"
    ADD COLUMN "recipientSnapshotAt" TIMESTAMPTZ(3);

CREATE TABLE "NotificationDeliveryRecipient" (
    "lifecycleEventId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    CONSTRAINT "NotificationDeliveryRecipient_pkey"
        PRIMARY KEY ("lifecycleEventId", "recipientUserId")
);

ALTER TABLE "NotificationDeliveryRecipient"
    ADD CONSTRAINT "NotificationDeliveryRecipient_lifecycleEventId_fkey"
    FOREIGN KEY ("lifecycleEventId") REFERENCES "NotificationDeliveryJob"("lifecycleEventId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDeliveryRecipient"
    ADD CONSTRAINT "NotificationDeliveryRecipient_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
