# Friction and development observations

Date: 16 October 2026 (Europe/Istanbul). Actual observations; no borrowed reports or invented performance figures.

Environment: Windows, PowerShell, Node 22.23.3 for checked commands, npm 11.12.1, official Arkiv SDK 0.8.1, viem 2.57.7, Neon HTTP driver 1.2.0. Host Node 25.5.0 exists but is not the target runtime. See the lockfile for all exact versions.

## Initial setup and revised hosting

The project began with only its Markdown plan. Docker was initially unavailable, then started, but the user supplied the serverless revision and the generated Docker/four-process scaffold was removed. Current deployment uses one verified Hobby project and one verified Neon Free project. No paid services were enabled.

## First write/read and creator identity

Surface: SDK wallet `createEntity`, typed attributes, independent public-client block-pinned query. Endpoint: public Tiramisu RPC, no credentials in this report.

Expected: readonly grant has the actual signing creator/owner and decodes with six typed attributes. Actual: matched at block 641823. `expiresAt` is a block number. Create/delete hashes, exact query and returned flags are in `schema.md` and `docs/evidence.json`.

Reproduce: `npm run setup:env`, fund the printed test owner/attacker addresses, migrate the dedicated DB, then `npm run arkiv:probe`. The script writes public observations locally and does not print secrets. It uses fresh run IDs; historical short-lived records do not remain active forever.

## Serverless transaction preparation

Expected: an uncertain network result cannot create a second grant on retry. The SDK's convenient create/delete methods both sign/send and wait for a receipt; there is no public create-transaction preparation method in the installed SDK surface.

Implementation: the supported viem custom transport intercepts `eth_sendRawTransaction`, durably stores the SDK-built signed bytes and hash with compare-and-set, then stops before network submission. The resumable operation broadcasts only those exact recorded bytes and checks receipts by hash. No SDK internal ABI encoder is imported or reproduced. A preparing lease can be reclaimed only before raw bytes are selected; a lost claimant cannot broadcast.

Reproduction code: `packages/core/src/chain.ts`. Crash/response-loss handling needs receipt evidence and DB constraints, not an in-memory nonce queue. A useful future SDK improvement would be an officially supported prepared mutation transaction API; this is an observation from this integration, not a protocol defect.

## Delete, forged namespace and expiry

Actual: owner delete removed the grant from the new pinned view. A payload/attribute clone signed by the attacker had the attacker's real creator. Real HTTP requests rejected it as `UNTRUSTED_CREATOR`; both content and preview denied it. A roughly 60-second entity disappeared from active queries while its payload policy ceiling was still later. Details are in the exported evidence.

## Replay and database clock

Real Neon tests used two independent Node processes. Only one consumed the shared challenge and incremented the preview revision. A failing preview constraint rolled the challenge deletion back. A new process could not replay a consumed challenge; an unused challenge correctly survived restart.

An initial local test exposed approximately four seconds of host/database clock difference. Database wall time now drives operational expiry/freshness timestamps. A separate initial implementation bug reused one timeout signal across all queries from a warm client; after eight seconds all later queries failed. It was corrected to create a timeout per fetch. These were application integration errors, not evidence of Neon or Arkiv data corruption.

## RPC freshness and independence

No positive grant cache is used. Timestamp freshness is still limited to 15 seconds old / 5 seconds future. Snapshot reads are retried at most once when the head changes. Shared SQL high-water state prevents a second function copy from accepting a regressed block. RPC/Neon errors produce UNAVAILABLE and no memory fallback.

Observed: management endpoints disabled in the local adapter returned HTTP 404. The independent CLI then sent fresh signed requests: Atlas Content/Preview denied at block 642112; Boreal Content allowed at 642113 and Preview updated revision 2 at 642114. This is a management dependency test, not separate-host availability.

## Public deployment

Early public health check at `https://bound-inky.vercel.app/api/control/health` returned HTTP 200 and real Neon connectivity. Further UI/authorization tests are tracked in `docs/demo.md`. Localhost success is not a substitute for a public signed request.

## AI access

The Vercel Hobby AI Gateway screen showed $0.00 enabled credit and an additional card-verification step for free credits. No billing/card configuration was performed. Live AI remains disabled; deterministic test mode is labeled honestly. No artificial model output is reported as a live model call.

## Measurements

Three fresh Content round-trip samples were collected on Node 22.23.3 against the local HTTP adapter with real Arkiv/Neon: 2297, 1330 and 1367 ms. The evidence includes the actual platform, Node version and origin; these are three individual observations, not a p95 or SLA. An elapsed first-write development measurement was not recorded and is not reconstructed retrospectively. No contest score or estimated win probability is reported.
