# Backend Roadmap Tasks

## Completed foundation

- [x] Task 1: Reproducible tooling boundary
- [x] Task 2: Validated runtime configuration
- [x] Task 3: Public health contract
- [x] Task 4: Safe errors, request IDs, and HTTP hardening
- [x] Task 5: Weather query and response contracts
- [x] Task 6: Controlled upstream test server
- [x] Task 7: Private Weather client success paths
- [x] Task 8: Weather client failure controls
- [x] Task 9: OpenAPI contract and operator documentation
- [x] Task 10: Integration-core completion gate

## Phase A: Identity and access

- [x] IA-1: Review roadmap and approve the `identity-access` design spec
- [x] IA-2: Establish PostgreSQL/Prisma identity persistence
- [x] IA-3: Implement Admin user provisioning and three-role assignment
- [x] Checkpoint A1: Review persistence and provisioning contract
- [x] IA-4: Implement login and current-session contract
- [x] IA-5: Implement refresh rotation, logout and revocation
- [x] Checkpoint A2: Review session security and replay resistance
- [x] IA-6: Enforce farm/plot/station resource scope
- [x] IA-7: Implement Client Developer API-key lifecycle
- [x] Checkpoint A: Backend contract verified; frontend can replace mock authentication

## Phase B: Authorized station data

- [ ] SD-1: Approve the `station-data` design spec
- [ ] SD-2: Expose authorized farm/plot/station hierarchy
- [ ] Checkpoint B1: Review hierarchy ownership and scope denials
- [ ] SD-3: Expose validated latest measurements
- [ ] SD-4: Expose bounded historical measurements
- [ ] SD-5: Expose scoped Client Developer data access
- [ ] Checkpoint B: Frontend replaces station and soil mocks

## Phase C: Alerts and configuration

- [ ] AC-1: Approve the `alert-config` design spec
- [ ] AC-2: Implement scoped alert rules
- [ ] AC-3: Implement acknowledge/resolve lifecycle
- [ ] Checkpoint C1: Review alert state transitions and idempotency
- [ ] AC-4: Implement notification delivery controls
- [ ] AC-5: Implement versioned IoT configuration publishing
- [ ] Checkpoint C: Frontend replaces alert/configuration mocks

## Phase D: Operations

- [ ] OP-1: Persist security and administrative audit events
- [ ] OP-2: Add observability and readiness
- [ ] Checkpoint D1: Review audit leakage and failure-injection evidence
- [ ] OP-3: Add container and CI quality gates
- [ ] OP-4: Rehearse migration, backup, restore and rollback
- [ ] OP-5: Pass the production release gate
