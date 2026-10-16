# Threat model and limits

## Protected operation

One test EOA agent reads synthetic Atlas/Boreal content and updates a title/body preview. Each action names one grant, resource, service, action, raw-body hash, nonce and request deadline in an EIP-712 domain bound to this deployment and chain.

The executor's trusted owner comes from configuration and a strict synthetic-resource parser. The grant cannot choose its own trust root. Real Arkiv creator and current owner must both match. Readonly flags, payload/attribute consistency, version, chain, deployment, agent, scope, block expiry and the immutable policy ceiling are checked.

## Attacks tested

Wrong project, creator impersonation, another agent, changed signed body/domain/service, sequential and concurrent replay, expired request/policy, unsafe flags, transferred ownership, corrupt payload and unavailable/stale RPC state. A refused write must leave preview text and revision unchanged. See the test matrix for the evidence layer of each scenario.

## Replay and side-effect boundary

Challenges are random 256-bit values, bound to agent/service/deployment/session and expire within 30 seconds. Atomic PostgreSQL conditional DELETE/RETURNING gates the preview UPDATE in one statement. No function-local Map, Set, mutex or ALLOW cache is security state. A DB failure rolls the statement back. A consumed nonce cannot be used again, including after restart or lost HTTP response. A fresh challenge can be issued; exactly-once response delivery is not promised.

SQL time rechecks request/challenge/policy deadlines. Recent verification is required, and the shared highest observed block cannot regress. These do not make an Arkiv read and a PostgreSQL write one distributed transaction. A deletion can race an already authorized update; actions already completed are not undone.

## Operational limits

One shared five-minute demo session, up to two normal grants, one forged test and one expiry test. Challenge issuance is bounded in the shared DB. Chain operation identity is unique per run/resource/operation. A partial unique index serializes pending writes for each signer. The selected signed raw transaction is persisted before broadcast, retries use the same bytes, and ambiguous submissions retain their signer slot.

All Vercel server functions share one environment trust boundary. Operator compromise, owner key compromise, RPC dishonesty, consensus failure and alternate-provider credentials are outside this prototype's protection. Browser cookies protect demo operations; tool authority relies on signatures and fresh Arkiv reads. RPC, Neon and synchronized operational clocks are dependencies.

## Honest claims

Grants and synthetic metadata are public. No real personal data is placed on chain. App results are not immutable on-chain audit receipts. Grant deletion is not secure erasure. BOUND does not solve prompt injection, guarantee instantaneous global revocation, isolate separate operators, or claim audited production security. Free service quotas may interrupt the demo; paid fallback is disabled.
