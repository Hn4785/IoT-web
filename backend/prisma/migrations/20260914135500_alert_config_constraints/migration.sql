ALTER TABLE "AlertRule"
ADD CONSTRAINT "AlertRule_active_key_consistency"
CHECK (
  ("isEnabled" AND "activeKey" = "stationId"::text || ':' || lower("field"::text))
  OR (NOT "isEnabled" AND "activeKey" IS NULL)
);

ALTER TABLE "AlertRule"
ADD CONSTRAINT "AlertRule_sample_counts"
CHECK ("requiredBreachSamples" = 2 AND "requiredRecoverySamples" = 2);

ALTER TABLE "AlertEvaluationState"
ADD CONSTRAINT "AlertEvaluationState_nonnegative_counts"
CHECK ("consecutiveBreachCount" >= 0 AND "consecutiveRecoveryCount" >= 0);

ALTER TABLE "Alert"
ADD CONSTRAINT "Alert_unresolved_key_consistency"
CHECK (
  ("status" IN ('OPEN', 'ACKNOWLEDGED') AND "unresolvedRuleId" = "ruleId")
  OR ("status" = 'RESOLVED' AND "unresolvedRuleId" IS NULL)
);
