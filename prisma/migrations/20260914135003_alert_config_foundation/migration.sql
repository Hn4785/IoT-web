-- CreateEnum
CREATE TYPE "SoilAlertField" AS ENUM ('TEMPERATURE', 'MOISTURE', 'EC', 'PH', 'NITROGEN', 'PHOSPHORUS', 'POTASSIUM', 'LIGHT');

-- CreateEnum
CREATE TYPE "AlertRuleSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertEvaluationStatus" AS ENUM ('READY', 'DISABLED', 'BLOCKED_METADATA');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertResolutionReason" AS ENUM ('RECOVERED', 'MANUAL', 'RULE_DISABLED', 'METADATA_CHANGED');

-- CreateEnum
CREATE TYPE "AlertLifecycleEventType" AS ENUM ('OPENED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertEvaluationResult" AS ENUM ('BREACH', 'NORMAL', 'MISSING', 'STALE', 'INVALID', 'METADATA_BLOCKED', 'UPSTREAM_ERROR');

-- CreateEnum
CREATE TYPE "IdempotencyClaimStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "field" "SoilAlertField" NOT NULL,
    "unit" VARCHAR(32) NOT NULL,
    "metadataRevision" VARCHAR(160) NOT NULL,
    "condition" JSONB NOT NULL,
    "severity" "AlertRuleSeverity" NOT NULL,
    "requiredBreachSamples" INTEGER NOT NULL DEFAULT 2,
    "requiredRecoverySamples" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "evaluationStatus" "AlertEvaluationStatus" NOT NULL DEFAULT 'READY',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "activeKey" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvaluationState" (
    "ruleId" UUID NOT NULL,
    "lastObservedAt" TIMESTAMPTZ(3),
    "lastValue" DECIMAL(18,6),
    "lastEvaluatedAt" TIMESTAMPTZ(3),
    "lastResult" "AlertEvaluationResult",
    "consecutiveBreachCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveRecoveryCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AlertEvaluationState_pkey" PRIMARY KEY ("ruleId")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "unresolvedRuleId" UUID,
    "status" "AlertStatus" NOT NULL,
    "openedValue" DECIMAL(18,6) NOT NULL,
    "openedObservedAt" TIMESTAMPTZ(3) NOT NULL,
    "latestValue" DECIMAL(18,6) NOT NULL,
    "latestObservedAt" TIMESTAMPTZ(3) NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgedBy" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedBy" UUID,
    "resolutionReason" "AlertResolutionReason",
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLifecycleEvent" (
    "id" UUID NOT NULL,
    "alertId" UUID NOT NULL,
    "type" "AlertLifecycleEventType" NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" UUID,
    "note" VARCHAR(500),
    "requestId" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" UUID NOT NULL,
    "lifecycleEventId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyClaim" (
    "id" UUID NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "status" "IdempotencyClaimStatus" NOT NULL,
    "response" JSONB,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluatorLease" (
    "name" VARCHAR(80) NOT NULL,
    "holderId" VARCHAR(120) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "continuationId" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EvaluatorLease_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_activeKey_key" ON "AlertRule"("activeKey");

-- CreateIndex
CREATE INDEX "AlertRule_stationId_createdAt_id_idx" ON "AlertRule"("stationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AlertRule_isEnabled_id_idx" ON "AlertRule"("isEnabled", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_unresolvedRuleId_key" ON "Alert"("unresolvedRuleId");

-- CreateIndex
CREATE INDEX "Alert_ruleId_updatedAt_id_idx" ON "Alert"("ruleId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Alert_status_updatedAt_id_idx" ON "Alert"("status", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "AlertLifecycleEvent_createdAt_idx" ON "AlertLifecycleEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertLifecycleEvent_alertId_revision_key" ON "AlertLifecycleEvent"("alertId", "revision");

-- CreateIndex
CREATE INDEX "InAppNotification_recipientUserId_createdAt_id_idx" ON "InAppNotification"("recipientUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_lifecycleEventId_recipientUserId_key" ON "InAppNotification"("lifecycleEventId", "recipientUserId");

-- CreateIndex
CREATE INDEX "IdempotencyClaim_expiresAt_idx" ON "IdempotencyClaim"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyClaim_operation_key_key" ON "IdempotencyClaim"("operation", "key");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvaluationState" ADD CONSTRAINT "AlertEvaluationState_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLifecycleEvent" ADD CONSTRAINT "AlertLifecycleEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLifecycleEvent" ADD CONSTRAINT "AlertLifecycleEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_lifecycleEventId_fkey" FOREIGN KEY ("lifecycleEventId") REFERENCES "AlertLifecycleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
