# BOUND — Devfolio submission draft

Project: **BOUND**

Tagline: **Revoke the task. Keep the agent working.**

Tracks: **Security** and **Open Source**.

Live app: https://bound-inky.vercel.app

Source: https://github.com/efeberk21/Bound

Published entry: https://devfolio.co/projects/bound-d480 — dashboard confirmed **SUBMITTED** on 18 October.

Video: https://youtu.be/byev8oL21Ww — 2m46s, English captions, edited real browser still captures. Backup: https://github.com/efeberk21/Bound/releases/tag/v0.1.0-demo.

## The problem it solves

Small software teams increasingly give an agent access to several projects. Stopping one task should not require disabling the agent or interrupting unrelated work.

BOUND gives one synthetic EOA agent separate, short-lived Arkiv grants for Atlas and Boreal. Content and Preview independently verify the current grant before each signed read or update. Revoke Atlas: both tools reject new Atlas operations, while the same agent can still update Boreal. The preview is a real persisted side effect, and denied writes leave its text and revision unchanged.

The public sandbox needs no wallet. It demonstrates trusted-creator checks, exact resource scope, signed request integrity, replay rejection and expiration on Tiramisu. It runs deterministic content editing; live AI is explicitly disabled. Two logical executors share one deployment, and revocation does not undo completed work.

## Challenges I ran into

Serverless instances cannot share replay state in memory. We used an atomic PostgreSQL conditional DELETE/RETURNING to consume a challenge and gate the preview update, and tested concurrent requests in independent Node processes, rollback and response loss followed by restart.

The SDK mutation helper signs, sends and waits in one flow. To recover safely across function interruptions, we intercept its documented transport send boundary, persist the selected signed bytes before broadcasting and resume by transaction hash. Repeated attempts reuse the same transaction.

We also found host/database clock differences and an incorrectly reused timeout signal during integration. Database time now drives operational expiry and each DB fetch gets a new timeout. The friction report contains expected versus actual behavior, versions and reproduction steps.

## Why Arkiv?

Arkiv is the shared source of current task authority. Each executor queries the exact grant at a pinned block and checks its actual creator, owner, immutable scope and active lifetime. A third party can independently inspect the same authority using a public RPC and the documented schema, without our web backend, database credentials or private keys.

Replacing Arkiv with our own Postgres authorization API would put current authority behind an operator-controlled service. Signed tokens can be checked locally, but sharing current revocation state requires another mechanism. IPFS provides content addressing, but needs an additional way to determine which mutable authority state is current. Other chains could support a similar design; Arkiv supplies the queryable entity lifecycle used here.

Neon deliberately stores sessions, replay challenges, previews, operation recovery and high-water observations. It does not store ALLOW decisions. Text transformation, signatures, secrets and model execution also stay off Arkiv.

## How do you use Arkiv?

- Official SDK 0.8.1 creates readonly grants with typed attributes and strict JSON payloads. Attributes identify the synthetic run, resource and agent; payload defines exact service/action pairs, deployment, policy ceiling and no delegation. [Contract](https://github.com/efeberk21/Bound/blob/main/packages/core/src/contracts.ts), [creation](https://github.com/efeberk21/Bound/blob/main/packages/core/src/chain.ts).
- Exact-key queries are pinned to the checked block. Chain ID, timestamps, snapshot consistency and bounded head retry prevent accepting an unverifiable view. [Authority reader](https://github.com/efeberk21/Bound/blob/main/packages/core/src/authority.ts), [query](https://github.com/efeberk21/Bound/blob/main/packages/core/src/arkiv.ts).
- Actual creator and current owner must match the executor's trusted owner. Payload impersonation and unexpected ownership changes deny. [Policy](https://github.com/efeberk21/Bound/blob/main/packages/core/src/policy.ts).
- Entity deletion revokes the selected task. Expiration ends a separate short-lived grant; an immutable wall-clock policy ceiling prevents entity lifetime extension from extending authority indefinitely. [Live scenarios](https://github.com/efeberk21/Bound/blob/main/tests/live.test.ts).
- Each logical tool reads Arkiv for its own signed request. [Tool integration](https://github.com/efeberk21/Bound/blob/main/packages/core/src/tools.ts), [independent CLI](https://github.com/efeberk21/Bound/blob/main/scripts/verify.ts).

The optional compound listing helper is not used by the current app. We do not claim demonstrated pagination, WebSockets, batch writes or lifetime renewal.

## Friction report

https://github.com/efeberk21/Bound/blob/main/arkiv/friction.md

## Wallet addresses that create entities

- `0x388908396B857F27cAea668aaAD4428614cf34Ec`: test demo owner; creates legitimate normal/expiry grants and deletes the main grant for revocation.
- `0xAd0c9f02854752f65Ed995e37944790CF4CDfdD3`: test attacker; creates a forged namespace/payload grant to prove actual-creator rejection.
- `0x0048a9cB28f213d759090bbb937E682B5dc8eeBD`: agent; signs off-chain tool requests and does not create Arkiv entities.

## Schema

https://github.com/efeberk21/Bound/blob/main/arkiv/schema.md

## How can judges reproduce your Arkiv usage?

1. Open the public app and Start demo. The shared slot lasts five minutes; if occupied, retry after it expires.
2. Grant Atlas, select Boreal and grant Boreal. Inspect confirmed transactions in Evidence.
3. Run Atlas's deterministic test: Content and Preview allow, source text is shortened and the stored revision increases.
4. In Boundary lab, try wrong project, forged grant and replay. Inspect each tool's reason, checked block and observed creator. Rejected writes preserve the stored state; replay permits only the first write.
5. Revoke Atlas. Fresh checks in both tools deny. Select Boreal and run it with the same agent: both tools still allow.
6. Create the separate 60-second Atlas test grant. It initially allows; check again after approximately 60 seconds and both tools deny. This additional grant can authorize Atlas after the main grant's revocation, and is labeled accordingly.
7. Follow README for the independent read-only CLI and the tools-only Control-404 experiment. The exact executed SDK query is `client.select().where(eq('$key', key(entityKey))).atBlock(head.number).limit(1)`.
8. Historical short-lived entities expire. Use creation/deletion transaction hashes in the public evidence and the demo video, or create fresh grants. [Evidence](https://github.com/efeberk21/Bound/blob/main/docs/evidence.json), [setup](https://github.com/efeberk21/Bound#clean-setup).

## Which Arkiv surfaces did you use?

Confirmed by implementation/development records: TypeScript SDK, Docs, Faucet and Block Explorer. SDK calls use HTTP JSON-RPC; mark Direct JSON-RPC only if the form intends SDK transport usage, rather than a separate hand-written application integration. Hub was used during setup according to local development artifacts. Do not select WebSocket events, Arkiv MCP, Arkiv Plugin or Access keys without actual usage evidence.

## What should Arkiv improve first?

A documented prepared-mutation API that returns the signed transaction bytes and hash before broadcasting would make serverless recovery easier. Our integration had to intercept the transport's `eth_sendRawTransaction` boundary to persist those bytes before send. An official prepare/sign/send separation would reduce custom integration code while preserving idempotent recovery.

## Final preparation notes

- Whether any team member holds Indian nationality; no India-track eligibility is assumed.
- Pre-existing work before 9 October, if any, with baseline SHA and reused components. Repo history begins 16 October, but that alone cannot establish all work's provenance.
- First-write bucket: **2 hours or less**, supported by the implementation chat starting 16 October 06:14:29 UTC and first recorded grant block 641823 at 06:50:12 UTC. This is a record comparison, not an original stopwatch measurement.
- Development assistant: **OpenAI Codex**. Disabled runtime AI does not mean no development LLM use. No unverified model names are added.
- Feedback-call preference: **No**, explicitly selected by the builder. Optional Devcon attendance remains unselected, matching registration.
- Required work/disclosure and public MIT/link-access declarations were completed after final review.
- Registration contact and payout information, completed privately by the builder.

The form limits short answers to 100 characters. Submitted pre-existing-work answer: `No pre-existing app code. Planning document only; third-party work: docs/prior-art.md and notices.` Submitted LLM answer: `OpenAI Codex (implementation, tests, review, docs). Runtime AI disabled; deterministic demo.` Longer explanations above retain the review context.

Do not publish personal registration information or any credential in this file.
