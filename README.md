# BOUND

**Revoke the task. Keep the agent working.**

BOUND grants one EOA agent narrowly scoped access to two synthetic projects. Content and Preview independently read current Arkiv authority. Revoking Atlas stops new Atlas operations while the same agent can keep working on Boreal.

Live demo: https://bound-inky.vercel.app

## Implemented architecture

The controlling plan is [the serverless revision](BOUND_SUNUCUSUZ_UCRETSIZ_PLAN_REVIZYONU.md). The older final plan is retained as historical input; its four-process/Docker design is superseded.

- React/Vite, strict TypeScript, one Vercel Hobby project, Node 22 API functions.
- Arkiv Tiramisu, official SDK **0.8.1**: immutable grants, creator/owner, block-pinned reads, deletion and expiration.
- Neon Free: sessions, nonce challenges, previews, resumable chain operations and shared high-water block observations. No SQL authorization cache.
- EIP-712 via viem; exact raw HTTP body hash. Each executor checks scope, agent, trusted creator/owner, flags, lifecycle and freshness.
- A conditional `DELETE … RETURNING` feeds the preview update in one SQL statement. Replay state survives process restarts and concurrent instances.

The executors are separate logical integrations in one deployment, **not separate operators or security-isolated Vercel environments**. Keys remain in server environment variables.

## Clean setup

Use Node **22.23.3** (see `.nvmrc`). Node 25 is not the target runtime.

```sh
npm ci
# Copy .env.example to .env using your shell, then fill DATABASE_URL.
npm run setup:env
npm run db:migrate
npm run dev
```

1. Create a dedicated **Neon Free** project. Put its pooled PostgreSQL URL in `.env` as `DATABASE_URL`. For migrations also set `DATABASE_URL_UNPOOLED` to the direct connection URL. Neither belongs in Git.
2. `setup:env` generates fresh test owner/attacker/agent keys if missing and prints only public addresses. Never use a real customer's wallet.
3. Fund owner and attacker with Tiramisu faucet test GLM. The agent only signs off-chain requests and needs no gas.
4. Keep a fixed `DEPLOYMENT_ID`, trusted `DEMO_OWNER_ADDRESS`, `AGENT_ADDRESS` and at least 32-character `DEMO_SESSION_SECRET`.
5. Local UI: **http://localhost:5174**; the development adapter is on loopback port 3001. `PUBLIC_ORIGIN` must match the exact browser origin. Port 5173 is not used.
6. Start demo, grant Atlas and Boreal, run Atlas, try wrong-project/forged/replay requests, revoke Atlas, then run Boreal. The shared slot expires after five minutes.

The API's `control/health` verifies DB connectivity. It does not claim Arkiv or model access is healthy. Every tool request makes fresh Arkiv reads and fails closed when dependencies are unavailable.

## Tests

```sh
npm test                  # deterministic policy/signature/RPC fault tests
npm run test:db           # real Neon, independent processes; requires .env + migration
npm run test:live         # real Arkiv + Neon + HTTP; start npm run dev first
npm run arkiv:probe       # real create/read/delete/forged/expiry experiment
npm run build
```

Live tests use test gas, write synthetic records and occupy the five-minute shared demo slot. They are not substituted with a fake chain. Detailed test status and limitations are in [docs/demo.md](docs/demo.md). Runtime test fixtures are scoped to generated IDs. Do not run this prototype's tests against an unrelated database.

Migrations are ordered and recorded with normalized-source checksums. `db:migrate` requires the direct URL; re-running it preserves applied migrations and rejects edited history. Challenge counters have indexed retention cleanup, while pending chain operations and authorization high-water observations are preserved. Node 22 unit/build checks are defined in `.github/workflows/ci.yml`.

## Deploy to Vercel Hobby

Use one project with repository-root build settings from `vercel.json`. No Docker, own server, domain purchase, ORM, Redis or auth platform is needed. Use the default `vercel.app` domain. Configure these **server-only** environment values in Vercel:

`DATABASE_URL`, `ARKIV_RPC_URL`, `DEMO_OWNER_PRIVATE_KEY`, `ATTACKER_PRIVATE_KEY`, `AGENT_PRIVATE_KEY`, `DEMO_OWNER_ADDRESS`, `DEPLOYMENT_ID`, `DEMO_SESSION_SECRET`, and `PUBLIC_ORIGIN` (the exact HTTPS production URL).

`CONTENT_ARKIV_RPC_URL` and `PREVIEW_ARKIV_RPC_URL` are optional independent RPC URLs. Never prefix a secret with `VITE_`. All functions share the project's server trust boundary. Use only free plans. Quota exhaustion must not trigger a paid upgrade or a local authorization fallback.

Vercel environment changes apply on redeployment. Verify public health, session cookies and signed tool calls after publishing. Preview deployment protection is not evidence that production is public; check the production URL without credentials.

## Independent inspection and integration

Read-only verification needs public configuration and RPC, **no private key, Neon connection or web endpoint**:

```sh
npm run verify -- --grant <entityKey> --resource demo://bound/<run-id>/atlas
npm run demo:independent -- --manifest <manifest.json>
```

Set `ARKIV_RPC_URL`, `DEMO_OWNER_ADDRESS`, `AGENT_ADDRESS` and `DEPLOYMENT_ID` in `.env` or the environment. The trusted owner is local configuration, never inferred from the grant. Example manifest:

```json
{"grants":[
  {"grantKey":"<revoked-atlas-key>","resource":"demo://bound/<run-id>/atlas","expected":"DENY"},
  {"grantKey":"<active-boreal-key>","resource":"demo://bound/<run-id>/boreal","expected":"ALLOW"}
]}
```

Use fresh, unexpired keys. Historical evidence keys eventually expire and will correctly deny both projects. A manifest contains public IDs only.

For the isolated **management dependency** experiment, stop the development adapter and start `npm run dev:tools-only`. `/api/control/health` now really returns 404; Content and Preview remain available. Within the active session window run:

```sh
npm run demo:independent -- --manifest <manifest.json> --tools http://localhost:5174
```

This optional mode uses `AGENT_PRIVATE_KEY` from the environment for fresh signed calls. No key is put in arguments or the manifest. It is an integration-dependency demonstration, not hosting-failure resistance. Resume normal development with `npm run dev` afterwards.

`packages/core/src/tools.ts` is the example endpoint integration; `tests/request.test.ts` shows the verifier contract. `@bound/core` is an MIT workspace package, not an npm-published universal security product.

## Evidence and boundaries

`npm run evidence:export` exports allowlisted public observations from local experiments into [docs/evidence.json](docs/evidence.json). It excludes keys, cookies, challenge nonces, signatures, raw signed transactions and credential-bearing endpoints. See [Arkiv schema](arkiv/schema.md), [friction log](arkiv/friction.md), [threat model](docs/threat-model.md) and [prior art](docs/prior-art.md).

Live AI is **disabled**. Account inspection found no enabled free AI Gateway credit; enabling it requires card verification. No card, credits or paid fallback was configured. The UI clearly labels deterministic execution; no AI-generated result is claimed.

The deterministic runner validates the actual Content response, keeps its title and extracts the first sentence within preview length limits. Invalid Content responses stop the write. Replay repeats the same signed Preview request after that read. The expiry experiment creates a separate, short-lived **Atlas grant** and can update Atlas after the main grant is revoked; task status is tied to the main grant's key.

Revocation affects new actions after the executor observes the relevant state. It does not retract prior reads or undo completed writes. RPC correctness and chain consensus are trusted. Arkiv and Neon do not form one distributed transaction. Metadata is public, all resources are synthetic, and this prototype is not audited or production-ready.

MIT licensed. The public video and Devfolio submission remain separate delivery tasks; code/test completion alone is not a submitted entry.
