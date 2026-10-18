# Arkiv grant schema — BOUND v1

Network: Tiramisu, chain ID `7738577`. Installed official TypeScript SDK: `@arkiv-network/sdk@0.8.1` (lockfile included). Code: `packages/core/src/contracts.ts`, `chain.ts`, `arkiv.ts`, `policy.ts`.

Only one entity kind exists: `grant`. Preview text, sessions, replay protection and chain submission tracking are not Arkiv entities.

| Attribute | SDK constructor | Value |
|---|---|---|
| app | str | bound_v1 |
| kind | str | grant |
| run_id | str | server-created UUID v4 |
| resource | str | demo://bound/UUID/atlas or /boreal |
| agent | addr | designated EOA agent |
| version | i32 | 1 |

Payload MIME type: `application/json`. Strict fields: `schemaVersion:1`, `chainId:7738577`, fixed `deploymentId`, exact `resource`, `agent`, `permissions`, positive integer `notAfterUnix`, `delegation:false`. Supported permission pairs: `bound.content.v1/content.read` and `bound.preview.v1/preview.update`. Unknown fields, types, actions and conflicting attributes are rejected.

System fields selected by `client.select()`: `key`, `creator`, `owner`, `createdAt`, `updatedAt`, `expiresAt`, `creationFlags`, `contentType`, `payload`, `attributeSchema`, `attributes`. Creator and owner are checked against the executor's trusted owner configuration. `expiresAt` is a **block height**, not a Unix timestamp. Flags must decode to readonly=true, permissionlessExtension=false, raw=1.

Normal lifetime: `ExpirationTime.fromSeconds(900)` (~450 nominal blocks), with payload policy ceiling creation-time +900 wall-clock seconds. Expiry experiment: 60 seconds (~30 blocks), payload ceiling +300 seconds. Entity lifetime extension cannot extend the policy ceiling. New authorization needs a new entity, not an extension of the policy ceiling.

## Actual SDK query construction

```ts
client.select()
  .where(eq('$key', key(entityKey)))
  .atBlock(head.number)
  .limit(1)
```

Real output from the first lifecycle experiment:

```text
$key = key(0xed759566d417583ff7fe0f8caffef528962f05cd484f5ff4aa8f8bb8fa60e82f)
selected snapshot: 641823
creator / owner: 0x388908396B857F27cAea668aaAD4428614cf34Ec
creationFlags: {readonly:true, permissionlessExtension:false, raw:1}
expiresAt: 642273
```

The entity above was deleted. Its later absence is expected; use the transaction evidence for historical reproduction and create a fresh demo for active-grant inspection.

The repository also provides an optional `listQuery` integration helper with `app`, `kind`, `run_id`, `.createdBy(trustedCreator)`, and optional exact `agent`/`resource`. The current application, scripts and tests do not call this helper. Compound listing and cursor pagination are therefore not claimed as demonstrated features. Execution uses the exact-key, block-pinned query above and checks the returned entity's actual creator and owner.

The UI's session operation list comes from Neon transaction tracking and is labeled as such; it is not a cached ALLOW list. Forged records are separate labeled operations and are never accepted because their namespace matches.

## Observed lifecycle evidence

- Create: `0x0a2528b55dcdf421da1414d83e39f7c269a7b04476bbb6ab783a76d975507ce8`, block 641823.
- Delete: `0xe48ed201da6d1ff2046e2a230fd6e1e67e5e3bc9dc684fcf5b49e46e0ead5fe5`, block 641825; later exact-key query returned no entity.
- Forged creator: `0xAd0c9f02854752f65Ed995e37944790CF4CDfdD3`; create tx `0x07e11ec8059bec0ef8d8adfa27ddabed12da0c90ca68d0f66a76c57f57f7c1b0`.
- Expiry create: `0x366a61787ffdd040200a602186bef89c41f2a001a0815559482555bdd7080ce1`, block 641829. The entity was present at 641858 and absent at 641860.

Full credential-free payloads and observations are in `docs/evidence.json`. Explorer URL pattern: `https://tiramisu.explorer.arkiv.network/tx/<hash>`.
