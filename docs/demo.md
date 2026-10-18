# Demo and delivery record

Current product: one agent, two synthetic tasks, two logical tools, real Tiramisu grants, Neon-backed atomic operational state, one Vercel Hobby deployment. AI is disabled because free credit access was not enabled; use **Run deterministic test**.

## Browser walkthrough

1. Open https://bound-inky.vercel.app in a clean browser. Start demo. If busy, try again within five minutes.
2. Grant Atlas and Boreal separately. A confirmed transaction is labeled separately from the last tool observations; pending operations expose Resume and unsigned failed preparations expose Retry.
3. Run Atlas. Observe separate Content/Preview decisions and a higher stored preview revision.
4. Try wrong project and forged grant. Target text/revision must stay unchanged.
5. Replay: first update may succeed once; duplicate must deny and not increment again.
6. Revoke Atlas. Wait for receipt and separate fresh denials from both tools. Run Boreal successfully.
7. Create the 60-second Atlas grant; check again after roughly 60 seconds. This separate grant can authorize new Atlas writes after the main Atlas grant is revoked. A missing grant means inactive, not automatically human-revoked.
8. Open evidence for public creator, keys, hashes and checked blocks. Use fresh grants with the independent CLI.

## Test matrix

| Test | Evidence so far |
|---|---|
| T01 permitted read/update | Real Tiramisu + Neon + local HTTP passed |
| T02 wrong project | Real local HTTP: both deny, unchanged preview |
| T03 forged creator | Real attacker-created grant: both deny, unchanged preview |
| T04 wrong agent | Live HTTP request signed by a different agent denies; stored preview unchanged |
| T05 signed body mutation | Exact bytes unit coverage and live body/resource/action mutation matrix; no write |
| T06 sequential replay | Real HTTP: one revision increment only |
| T07 concurrent replay | Real Neon, two independent Node processes; one update |
| T08 restart replay | Real Neon, process restart and deliberate socket response loss; one committed effect, retry denies. Unused nonce remains usable |
| T09 Atlas revoke | Real chain + fresh HTTP: both tools deny |
| T10 Boreal continues | Same signer, real read/update succeeds after Atlas revoke |
| T11 expiry | Real Tiramisu + local HTTP: both tools ALLOW before expiry and DENY afterward, unchanged preview on denial |
| T12 extension ceiling | Unit test: later chain expiry cannot extend notAfter |
| T13 RPC/DB failures | Wrong chain/snapshot/head/final freshness guards, HTTP DB-error boundary, real DB rollback and response-loss/restart coverage |
| T14 owner/flags | Table-driven unit tests |
| T15 revoke between read/update | Real read, revoke, then Preview DENY; exact preview state equality asserted around the rejected write |
| T16 service/deployment | Real EIP-712 unit tests plus live deployment-domain tampering denial |
| T17 corrupt payload/type/version | Table-driven unit tests |
| T18 management unavailable | Automated tools-only process: Control 404, Atlas Content/Preview deny and Boreal Content/Preview allow |
| T19 session isolation | Real cookie sealing + HTTP forgery/run injection checks; 240/299/300-second clock tests and actual five-minute browser expiry/restart walkthrough |
| T20 public clean browser | Public Start/Atlas+Boreal grants/Atlas write/revoke/two denials/Boreal continuation passed; real session expiry disabled actions. Public HTML/JS/CSS contained no configured secret values |

Do not present pending checks as passing. Unit, actual database, local HTTP, live chain and manual layers are distinct.

## Video outline (maximum three minutes)

0:00 two tasks and one agent; 0:15 real grant creation; 0:40 deterministic read/update; 1:05 wrong-project/forged creator; 1:25 Atlas revoke/Boreal continues; 1:55 management-unavailable CLI experiment; 2:25 real expiry evidence; 2:45 MIT source and reproduction instructions.

Public video: https://youtu.be/byev8oL21Ww — **2m46s**, 1920×1080, English captions, no narration. It uses edited still captures from the final public interface and Arkiv Explorer. Removed waits and separate creator/expiry supplements are disclosed. The central Atlas revoke/Boreal continuation uses one run and one agent. A downloadable backup is at https://github.com/efeberk21/Bound/releases/tag/v0.1.0-demo.

## Delivery status

- Keep the public-browser verification current after deployment; three individual timing samples are in evidence (no SLA claim).
- The MIT repository and schema/friction links are public. Keep the submitted commit and deployed version synchronized.
- The <=3-minute video is uploaded as an unlisted YouTube video, embedded in Devfolio, and backed up as a public GitHub release download.
- Registration is complete. The Devfolio dashboard confirmed **SUBMITTED** for https://devfolio.co/projects/bound-d480 on 18 October.
- Keep the deployment available through the competition's required period; no availability guarantee is claimed.

Source checklist: https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/submission-checklist.md

## 18 October final release

Implementation `1795095b13ac6f42cb8caef4bc07ae64b49dc533` is deployed at the public alias with the black/lime UI. All 11 public live scenarios passed in 140.95 seconds; the new results exporter also created its nested directory successfully. Fresh no-credential CLI inspection independently returned revoked Atlas DENY and active Boreal ALLOW. The 68 deterministic tests and build passed after the final small fixes; the 20 real DB tests passed during the review with unchanged runtime/migration implementation. See `final-review-2026-10-18.md` for boundaries and evidence.
