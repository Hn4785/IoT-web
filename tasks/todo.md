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

- [x] SD-1: Approve the `station-data` design spec
- [x] SD-2: Expose authorized farm/plot/station hierarchy
- [x] Checkpoint B1: Review hierarchy ownership and scope denials
- [x] SD-3: Expose validated latest measurements
- [x] Checkpoint B2: Verify latest DTO and frontend adapter against approved sample JSON
- [ ] SD-4: Expose bounded historical measurements
- [ ] SD-5: Expose scoped Client Developer data access
- [ ] Checkpoint B-core: Frontend replaces station and soil mocks against verified fake upstream data
- [ ] Checkpoint B-device: Hardware metadata and one real station validate physical assumptions

Integration note: the upstream API is temporarily unavailable during device
installation, so implementation uses the API Guide response JSON as its sample
contract. The planned topology is one `CENTER` station and six node stations,
`NODE01` through `NODE06`; the six nodes share the same JSON structure. Treat this
as a deployment fixture rather than a permanent hardcoded registry. `CENTER`
behavior remains unverified. The development seed may remain the deterministic
NODE01/NODE02 subset. Until upstream access is restored, B-core evidence is
`sample-verified`; only B-device/live evidence may be marked `live-verified`.

## Phase C: Alerts and in-app notifications

- [x] AC-1: Approve the `alert-config` design spec
- [ ] AC-2: Implement scoped alert rules
- [ ] AC-3: Implement acknowledge/resolve lifecycle
- [ ] Checkpoint C1: Review alert state transitions and idempotency
- [ ] AC-4: Implement the scoped in-app notification inbox
- [ ] C-device design gate: Approve hardware schema and transport before configuration work
- [ ] Checkpoint C-core: Frontend replaces alert and notification mocks

## Phase D: Operations

- [ ] OP-1: Persist security and administrative audit events
- [ ] OP-2: Add observability and readiness
- [ ] Checkpoint D1: Review audit leakage and failure-injection evidence
- [ ] OP-3: Add container and CI quality gates
- [ ] OP-4: Rehearse migration, backup, restore and rollback
- [ ] OP-5: Pass the production release gate
