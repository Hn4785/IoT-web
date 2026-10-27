ALTER TABLE "AlertRule" DROP CONSTRAINT "AlertRule_active_key_consistency";
ALTER TABLE "AlertRule"
ADD CONSTRAINT "AlertRule_active_key_consistency"
CHECK (
  ("isEnabled" AND "activeKey" IS NOT NULL AND "activeKey" = "stationId"::text || ':' || lower("field"::text))
  OR (NOT "isEnabled" AND "activeKey" IS NULL)
);

ALTER TABLE "Alert" DROP CONSTRAINT "Alert_unresolved_key_consistency";
ALTER TABLE "Alert"
ADD CONSTRAINT "Alert_unresolved_key_consistency"
CHECK (
  ("status" IN ('OPEN', 'ACKNOWLEDGED') AND "unresolvedRuleId" IS NOT NULL AND "unresolvedRuleId" = "ruleId")
  OR ("status" = 'RESOLVED' AND "unresolvedRuleId" IS NULL)
);
