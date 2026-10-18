# BOUND final product review — 18 October 2026

Decision: the narrow authorization product is ready and submitted. No new feature is required to substantiate its central claim. The current interface is deployed, the 2m46s video is linked, and the Devfolio dashboard confirmed **SUBMITTED** on 18 October.

Reviewed implementation baseline: `456cf0bae5a7c6445204325776b8a6ba3cfc9700`. The serverless revision controls architecture; superseded Docker, process-local state and separate-key-boundary requirements from the original plan were not treated as current promises.

## Product promise against implementation

| Promise | Finding |
| --- | --- |
| One agent, Atlas and Boreal permissions | Implemented with separate real Tiramisu entities and the same EOA signer. |
| Read content and shorten the preview | Actual Content response is validated; its title and first sentence determine the stored Neon preview. Browser run increased Atlas revision 0 to 1. |
| Revoke Atlas while Boreal continues | Browser: after confirmed Atlas deletion both tools denied; Atlas revision stayed 1. Boreal then allowed both tools and increased revision 0 to 1. |
| Independent executor decisions | Content and Preview read Arkiv directly, using the shared verifier. A tools-only worker returns Control 404 while enforcing the current grants. Both tools remain in one deployment and trust boundary. |
| Creator authenticity, scope and signature | Implemented and covered by policy tests, real signatures and actual attacker-created entities. Payload claims do not establish the trusted owner. |
| Replay and process restart protection | Conditional SQL challenge consumption gates the preview update; independent-process, rollback and lost-response checks passed. |
| Expiration | A separate real 60-second Atlas grant allows before expiration and denies afterward. It is an additional grant and may authorize Atlas after the main grant is revoked. |
| Dependency failure | RPC freshness, snapshot, chain and shared high-water checks fail closed. SQL error paths do not use a memory authorization fallback. |
| Serverless recovery | Durable transaction identity, signed bytes before broadcast, signer serialization and reconciliation across sessions are implemented. |
| UI and evidence | New black/lime interface works locally. Grant, read/update, revoke, two denials, Boreal continuation and five-minute session closure were exercised in the browser. At 390px the evidence panel did not cause document-level horizontal overflow. |
| Reusable open source integration | MIT repo, schema, policy functions, example endpoints and CLI exist. The optional compound listing helper is not called by the product and is not a demonstrated feature. |
| Live AI | Disabled and visibly labeled. This follows the plan's free-access fallback. It must not be described as a live model demonstration. |

## Verification performed in this review

Node 22.23.3 on Windows; actual configured Neon and Tiramisu dependencies.

| Check | Result and boundary |
| --- | --- |
| Deterministic/HTTP tests | 68 passed. Mocked failure paths and real cryptographic signatures are distinct from live-chain evidence. |
| Real database tests | 20 passed. Includes isolated-schema migrations and cleanup, rollback, independent processes and recovery with mocked chain transport. |
| Live local HTTP + Tiramisu + Neon | 11 scenarios passed in 151.47 seconds. Run `85f8f39f-79fc-4de1-90b3-16eae2fc8965`. Includes forged creator, tampering, replay, lost response, selective revoke, management absence and expiry. |
| TypeScript and production frontend build | Passed, including after the final small fixes. A bundle-size warning remains; it is not a functional failure. |
| Baseline GitHub CI | Successful for `456cf0b`: https://github.com/efeberk21/Bound/actions/runs/38944722846 |
| Dependency advisory check | `npm audit --omit=dev`: zero reported runtime advisories at inspection time. |
| Configured secret matching | No configured secret values matched the built local HTML/JS/CSS or inspected production assets. This is not a comprehensive historical secret audit. |
| Public version before final deployment | Public HTML/JS/CSS returned 200 and security headers were present, but assets served the older UI. Local assets and public assets differed. |

Credential-free raw review observations and screenshots are kept in the git-excluded `.local/audit/final-review-2026-10-18-*` files. Historical public lifecycle evidence remains in `docs/evidence.json`; its export commit is not represented as the current release.

## Small issues closed before delivery

- The probe now creates `.local` before writing evidence. A clean clone previously lacked this git-excluded directory.
- The live suite creates the parent directory of its selected results file, including nested custom output paths.
- The appearance selector restores `system` as well as `light` and `dark` after reload.
- The schema explicitly separates the unused listing helper from the exact-key query actually executed.
- The demo checklist no longer says the already-public MIT repo still needs initial publication.

## Contest readiness

The official gates require a working public product, reproducible queries, public MIT source, schema, friction, creator addresses, a video and completed project questions. The first technical items are supported by implementation and evidence; the final deployment, video and Devfolio state must be checked at delivery. The user confirmed that no video or submission existed when this review began.

Security is the strongest track match: the actual on-chain creator is checked against a locally trusted owner. Open Source is supported by the documented data contract and runnable verifier. The Arkiv argument is shared, publicly inspectable current authority without an operator's private ALLOW API. SQL retains operational state. A conventional database can implement similar UI behavior; BOUND does not claim Arkiv is the only possible technology.

No feature expansion is recommended before the deadline. Prioritize synchronized deployment, a clear real-operation video, concise specific answers and anonymous link checks. Do not claim production audit, separate operators, instantaneous global revoke, live AI, pagination usage or hosting-failure resistance.

Registration, eligibility and personal declarations require the builder's actual information. The application must stay up through 23 October. Submission closes **19 October 2026 01:59 Europe/Istanbul**; deadline source records London 18 October 23:59 BST.

## Final release acceptance

Implementation commit `1795095b13ac6f42cb8caef4bc07ae64b49dc533` was published and deployed on 18 October. The production alias serves the same JS/CSS asset names as the local final build. All **11 public live scenarios passed in 140.95 seconds**, with real Arkiv/Neon and public HTTP for the main API scenarios. Independent-process/response-loss/Control-404 scenarios use local HTTP workers against those same real dependencies. The nested results directory was created successfully by the repaired test exporter.

The independent CLI was then run from an empty working directory with only public configuration and RPC. No private key, database URL, session secret or app HTTP endpoint was supplied. It returned Atlas DENY at block 744105 and Boreal ALLOW at 744106. Detailed public observations were exported to `docs/evidence.json`; they name the tested implementation revision.

The development record was examined for the previously unknown first-write bucket. The initial implementation chat started **16 October 06:14:29 UTC**; block **641823**, containing the first recorded successful grant, has timestamp **06:50:12 UTC**. This supports the form's **2 hours or less** category (35m43s from that implementation-chat start), not a stopwatch performance benchmark or a claim about earlier idea research. The previous friction note accurately describes the absence of an original stopwatch measurement.

Current-release CI: https://github.com/efeberk21/Bound/actions/runs/39141112902

The final 2m46s demo was uploaded with the builder's approval: https://youtu.be/byev8oL21Ww. It is an unlisted video of real browser still captures with English captions. Wait removal and separate creator/expiry supplements are disclosed. Actual Atlas CREATE/DELETE history is shown in Arkiv Explorer; source captures and edit manifest are local review artifacts. A public downloadable backup is attached to the `v0.1.0-demo` GitHub release. The backup returned HTTP 200 without account credentials. YouTube Studio confirmed unlisted publication; its browser playback was checked in a signed-in session, not represented as an anonymous playback test.

Devfolio confirmed **SUBMITTED** and explicitly stated that BOUND was published and submitted to **Arkiv: Global Tour Stop** on 18 October. Public project: https://devfolio.co/projects/bound-d480. Security and Open Source tracks, required project answers, two factual declarations, three screenshots and the YouTube media embed were saved. Screenshot proof is retained locally at `.local/audit/devfolio-submitted-2026-10-18.png`. The builder completed registration and its legal acceptance personally; registration contact and payout data are not included in this repo. Documentation/evidence updates after implementation `1795095` do not change the deployed executable source.

## Canonical sources

- [Rules](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/RULES.md)
- [Scoring rubric](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/scoring-rubric.md)
- [Submission checklist](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/submission-checklist.md)

Sources were read online on 18 October 2026. The organizer makes the final eligibility and scoring decision.
