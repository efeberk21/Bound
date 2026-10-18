# BOUND demo — recording script

Target length: 2:40–2:55. Record the deployed final interface. Keep a visible cursor and show actual tool responses and revision numbers. Cut transaction waits if necessary and label them as edited waits. Live AI is disabled; say “deterministic agent workflow.”

| Time | Screen/action | English narration |
| --- | --- | --- |
| 0:00–0:15 | Product header, Atlas and Boreal | “An agent should be able to work on two projects without sharing one all-or-nothing permission. BOUND lets you revoke a task while keeping the agent working.” |
| 0:15–0:35 | Start demo, grant Atlas and Boreal, show a confirmed transaction | “This public sandbox uses synthetic projects and real Arkiv Tiramisu grants. The same agent gets a separate permission for each task. No visitor wallet is required.” |
| 0:35–0:55 | Run Atlas, show source, shortened preview and revision | “The deterministic workflow reads actual Content output, shortens it and updates a persisted preview. Content and Preview each query Arkiv before acting. Both allow, and the revision increases.” |
| 0:55–1:20 | Wrong project and forged grant results | “An Atlas permission cannot authorize Boreal. Copying the grant payload from another wallet also fails: the verifier checks Arkiv's actual creator against its trusted owner. These denied writes leave the preview unchanged.” |
| 1:20–1:50 | Revoke Atlas; show both DENY; run Boreal | “Now revoke Atlas. The deletion is confirmed on chain. Fresh checks from both tools deny new Atlas operations, while the last preview remains. The same agent still reads and updates Boreal. That is selective revocation.” |
| 1:50–2:10 | Replay, showing request evidence / revision | “Requests bind the exact body, service, resource, grant and one-use challenge in an EIP-712 signature. Replaying an accepted write is denied. Shared database state preserves replay protection across function restarts.” |
| 2:10–2:30 | Separate expiry experiment; label edited wait | “This separate Atlas test grant allows before expiry and denies afterward. It is additional permission, not the revoked main grant. Transaction evidence survives the entity's short active lifetime.” |
| 2:30–2:50 | README/schema/friction/CLI and source link | “Arkiv holds current authority; Neon holds operational state. The MIT repo documents the schema, verifier and independent CLI. Two tools share one deployment. Revocation stops new observed-authorized work; it does not undo completed operations.” |

Use a separate prepared run for the expiry segment if necessary and visibly label its different run. Keep the public video link accessible without approval. Do not include browser accounts, environment files, cookies, nonces, signatures or private keys. The Control-unavailable experiment may be shown as an additional short recorded CLI segment if time permits; do not portray it as separate-host availability.
