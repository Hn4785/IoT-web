-- Required for case-insensitive, database-enforced email uniqueness.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FARMER', 'CLIENT_DEVELOPER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING_PASSWORD_CHANGE');

-- CreateEnum
CREATE TYPE "SystemAuthorityKey" AS ENUM ('SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_PASSWORD_CHANGE',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3),
    "deletionRequestedAt" TIMESTAMPTZ(3),
    "anonymizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAuthority" (
    "authority" "SystemAuthorityKey" NOT NULL,
    "holderUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SystemAuthority_pkey" PRIMARY KEY ("authority")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "replacedBySessionId" UUID,
    "revokeReason" VARCHAR(80),
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" UUID NOT NULL,
    "plotId" UUID NOT NULL,
    "upstreamCode" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmMembership" (
    "userId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmMembership_pkey" PRIMARY KEY ("userId","farmId")
);

-- CreateTable
CREATE TABLE "ClientStationGrant" (
    "userId" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientStationGrant_pkey" PRIMARY KEY ("userId","stationId")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyStationScope" (
    "apiKeyId" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyStationScope_pkey" PRIMARY KEY ("apiKeyId","stationId")
);

-- CreateTable
CREATE TABLE "SecurityAuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" VARCHAR(120),
    "result" "AuditResult" NOT NULL,
    "requestId" VARCHAR(128) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SystemAuthority_holderUserId_key" ON "SystemAuthority"("holderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Plot_farmId_idx" ON "Plot"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_farmId_name_key" ON "Plot"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Station_upstreamCode_key" ON "Station"("upstreamCode");

-- CreateIndex
CREATE INDEX "Station_plotId_idx" ON "Station"("plotId");

-- CreateIndex
CREATE INDEX "FarmMembership_farmId_idx" ON "FarmMembership"("farmId");

-- CreateIndex
CREATE INDEX "ClientStationGrant_stationId_idx" ON "ClientStationGrant"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_ownerUserId_revokedAt_idx" ON "ApiKey"("ownerUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiKeyStationScope_stationId_idx" ON "ApiKeyStationScope"("stationId");

-- CreateIndex
CREATE INDEX "SecurityAuditEvent_actorUserId_createdAt_idx" ON "SecurityAuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityAuditEvent_targetType_targetId_createdAt_idx" ON "SecurityAuditEvent"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityAuditEvent_createdAt_idx" ON "SecurityAuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "SystemAuthority" ADD CONSTRAINT "SystemAuthority_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMembership" ADD CONSTRAINT "FarmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMembership" ADD CONSTRAINT "FarmMembership_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStationGrant" ADD CONSTRAINT "ClientStationGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStationGrant" ADD CONSTRAINT "ClientStationGrant_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyStationScope" ADD CONSTRAINT "ApiKeyStationScope_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyStationScope" ADD CONSTRAINT "ApiKeyStationScope_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAuditEvent" ADD CONSTRAINT "SecurityAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
