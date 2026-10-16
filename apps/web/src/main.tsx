import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import {
  operationAction,
  projectStatus,
  sessionUsable,
  type Operation,
} from "./view-state.js";
import atlas from "../../../fixtures/atlas.json" with { type: "json" };
import boreal from "../../../fixtures/boreal.json" with { type: "json" };

import { api } from "./client.js";
import {
  stateResponseSchema,
  publicOperationSchema,
  runResponseSchema,
  sessionResponseSchema,
  type StateResponse as State,
  type RunResponse as Run,
} from "../../../packages/core/src/api-contracts.js";
import type { Project } from "../../../packages/core/src/contracts.js";
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-5)}`;
const explorer = "https://tiramisu.explorer.arkiv.network";

function App() {
  const [now, setNow] = useState(Date.now());
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<Project>("atlas");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<Partial<Record<Project, Run>>>({});
  const [pending, setPending] = useState<Partial<Record<Project, string>>>({});
  const refresh = async () => {
    const next = await api("/api/control/state", stateResponseSchema);
    setState(next);
    return next;
  };
  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      void refresh().catch((e) => setError(e.message));
    };
    update();
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  useEffect(() => {
    if (!state?.session) return;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
        setRuns({});
      },
      Math.max(0, Date.parse(state.session.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state?.session?.expiresAt]);
  useEffect(() => {
    setRuns({});
  }, [state?.session?.runId]);
  async function task(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to verify.");
    } finally {
      await refresh().catch(() => {});
      setNow(Date.now());
      setBusy("");
      setPending({});
    }
  }
  const find = (project: Project, kind: string) =>
    state?.operations?.find(
      (op) => op.resource.endsWith(`/${project}`) && op.operation === kind,
    );
  async function chain(project: Project, operation: Operation["operation"]) {
    setPending((p) => ({
      ...p,
      [project]: operation === "revoke" ? "Revocation pending" : "Creating",
    }));
    const existing = find(project, operation);
    let result =
      existing &&
      ["preparing", "prepared", "submitted"].includes(existing.status)
        ? await api("/api/control/status", publicOperationSchema, {
            id: existing.id,
          })
        : await api(`/api/control/${operation}`, publicOperationSchema, {
            project,
          });
    for (
      let attempt = 0;
      attempt < 20 && !["confirmed", "failed"].includes(result.status);
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      result = await api("/api/control/status", publicOperationSchema, {
        id: result.id,
      });
    }
    await refresh();
    setPending((p) => ({ ...p, [project]: "" }));
    if (result.status !== "confirmed")
      throw new Error(
        result.status === "failed"
          ? result.retryable
            ? "Preparation failed. Use Retry to prepare this operation again."
            : "The chain transaction failed. Inspect its receipt in the evidence panel."
          : "Confirmation is still pending. Use Resume to continue checking the same transaction.",
      );
    return result;
  }
  async function run(project: Project, mode: Run["mode"]) {
    const result = await api("/api/run", runResponseSchema, { project, mode });
    setSelected(result.project);
    setRuns((previous) => ({ ...previous, [result.project]: result }));
    await refresh();
  }
  const source = selected === "atlas" ? atlas : boreal;
  const current = state?.previews?.find((p) => p.project === selected);
  const lastRun = runs[selected];
  const usable = sessionUsable(state?.session, now);
  function status(project: Project) {
    if (!usable) return "Session unavailable";
    if (pending[project]) return pending[project]!;
    return projectStatus({
      usable,
      grant: find(project, "grant"),
      revoke: find(project, "revoke"),
      results: runs[project]?.results ?? [],
    });
  }
  const enabled = usable && !busy;
  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="/">
          BOUND
          <span className="wordmark-dot" />
        </a>
        <span className="network">
          <i /> Tiramisu testnet · Synthetic demo
        </span>
        <a className="text-link" href="#evidence">
          Inspect the evidence ↗
        </a>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">TASK-SCOPED AGENT ACCESS</p>
          <h1>
            Revoke the task.
            <br />
            <span>Keep the agent working.</span>
          </h1>
          <p className="lead">
            One agent. Two projects. Give each task its own permission.
            <br />
            Stop Atlas without interrupting Boreal.
          </p>
        </div>
        <div className="session-box">
          <span className="label">SHARED TEST ENVIRONMENT</span>
          <p>Demo owner — synthetic resources</p>
          <p className="muted">
            {usable && state?.session
              ? `Session ends ${new Date(state.session.expiresAt).toLocaleTimeString()}`
              : "Start a five-minute session. No wallet required."}
          </p>
          <button
            className="primary"
            disabled={!!busy}
            onClick={() =>
              void task("Starting demo", async () => {
                await api("/api/control/start", sessionResponseSchema, {});
                setRuns({});
                await refresh();
              })
            }
          >
            {usable ? "Resume demo" : "Start demo"} <span>→</span>
          </button>
          <small>Shared demo busy? Try again within five minutes.</small>
        </div>
      </section>
      <div className="notice">
        <span>↳</span>
        <p>
          These are synthetic projects controlled by a demo owner. Each tool
          reads its grant directly from Arkiv before it acts.
        </p>
        <span className="mode-label">Deterministic test mode</span>
      </div>
      {error && (
        <div role="alert" className="error">
          <strong>Unable to complete</strong>
          <span>{error.replaceAll("_", " ")}</span>
        </div>
      )}
      {busy && (
        <div className="working" role="status">
          <span className="spinner" />
          {busy}…
        </div>
      )}
      <section className="workspace">
        <aside className="tasks">
          <div className="section-label">
            <h2>Your tasks</h2>
            <span>01 / PERMISSION</span>
          </div>
          {(["atlas", "boreal"] as const).map((project, index) => {
            const grant = find(project, "grant");
            const revoke = find(project, "revoke");
            const grantAction = operationAction(grant, "Grant access");
            const revokeAction = operationAction(revoke, "Revoke");
            const s = status(project);
            return (
              <article
                key={project}
                className={`task-card ${selected === project ? "selected" : ""}`}
              >
                <button
                  className="task-select"
                  onClick={() => setSelected(project)}
                  aria-pressed={selected === project}
                >
                  <span className="project-icon">
                    {index === 0 ? "A" : "B"}
                  </span>
                  <span>
                    <strong>{project === "atlas" ? "Atlas" : "Boreal"}</strong>
                    <small>Shorten project introduction</small>
                  </span>
                  <span className="task-arrow">↗</span>
                </button>
                <span
                  className={`status status-${s.toLowerCase().replaceAll(" ", "-")}`}
                >
                  <i />
                  {s}
                </span>
                <dl>
                  <div>
                    <dt>Agent</dt>
                    <dd>{state?.agent ? short(state.agent) : "Loading…"}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>
                      content.read
                      <br />
                      preview.update
                    </dd>
                  </div>
                  <div>
                    <dt>Lifetime</dt>
                    <dd>
                      ~15 min on chain
                      <br />
                      15 min policy ceiling
                    </dd>
                  </div>
                </dl>
                <div className="task-actions">
                  <button
                    disabled={!enabled || grantAction.disabled}
                    onClick={() =>
                      void task(`Granting ${project}`, async () => {
                        await chain(project, "grant");
                      })
                    }
                  >
                    {grantAction.label}
                  </button>
                  <button
                    className="danger"
                    disabled={
                      !enabled ||
                      grant?.status !== "confirmed" ||
                      revokeAction.disabled
                    }
                    onClick={() =>
                      void task(`Revoking ${project}`, async () => {
                        await chain(project, "revoke");
                        await run(project, "check");
                      })
                    }
                  >
                    {revokeAction.label}
                  </button>
                </div>
                <button
                  className="run"
                  disabled={!enabled || grant?.status !== "confirmed"}
                  onClick={() =>
                    void task(`Running ${project}`, () =>
                      run(
                        project,
                        find(project, "revoke") ? "check" : "deterministic",
                      ),
                    )
                  }
                >
                  Run deterministic test <span>→</span>
                </button>
                <button
                  className="ai"
                  disabled
                  title="Free AI Gateway access is not enabled for this account."
                >
                  Run with AI · unavailable
                </button>
              </article>
            );
          })}
        </aside>
        <section className="editor">
          <div className="section-label">
            <h2>Work preview</h2>
            <span>02 / REAL EFFECT</span>
          </div>
          <div className="editor-body">
            <div className="editor-toolbar">
              <span className="project-tag">{selected.toUpperCase()}</span>
              <span>
                {current ? (
                  <>
                    Preview revision <b>{current.revision}</b>
                  </>
                ) : (
                  "No stored preview"
                )}
              </span>
            </div>
            <div className="source">
              <span className="label">EXAMPLE SOURCE</span>
              <h3>{source.title}</h3>
              <p>{source.body}</p>
            </div>
            <div className="preview-output">
              <div className="output-label">
                <span className="label">
                  {current ? "CURRENT PREVIEW" : "EXAMPLE PREVIEW"}
                </span>
                <span className="muted">
                  {current
                    ? "Loaded from Neon"
                    : "Local sample  -  start a session to store"}
                </span>
              </div>
              <h3>{current?.title ?? source.title}</h3>
              <p>{current?.body ?? source.body}</p>
            </div>
            {lastRun?.before && (
              <details className="before">
                <summary>
                  Before the last request · revision {lastRun.before.revision}
                </summary>
                <h4>{lastRun.before.title}</h4>
                <p>{lastRun.before.body}</p>
              </details>
            )}
            <p className="editor-note">
              A rejected write leaves the text and revision unchanged. Content
              is rendered as text.
            </p>
          </div>
        </section>
        <aside className="decisions">
          <div className="section-label">
            <h2>Tool decisions</h2>
            <span>03 / ENFORCEMENT</span>
          </div>
          {lastRun && (
            <p className="run-context">
              Last request: {lastRun.mode} - {selected}
            </p>
          )}
          {(["bound.content.v1", "bound.preview.v1"] as const).map(
            (service, index) => {
              const result = lastRun?.results
                .slice()
                .reverse()
                .find((r) => r.serviceId === service);
              return (
                <article className="decision-card" key={service}>
                  <div className="decision-title">
                    <span className="tool-icon">
                      {index === 0 ? "↙" : "↗"}
                    </span>
                    <h3>{index === 0 ? "Content" : "Preview"}</h3>
                    <span className="tool-number">0{index + 1}</span>
                  </div>
                  <span
                    className={`decision-value ${result?.decision.toLowerCase() ?? ""}`}
                  >
                    {result?.decision ?? "Not checked"}
                  </span>
                  <p>
                    {result?.reasonCode.replaceAll("_", " ").toLowerCase() ??
                      "Waiting for a signed tool request."}
                  </p>
                  <div className="decision-meta">
                    {result ? (
                      <>
                        Block <b>{result.checkedBlock ?? "unavailable"}</b>
                        <br />
                        {new Date(result.checkedAt).toLocaleTimeString()}
                      </>
                    ) : (
                      "Own Arkiv query · own decision"
                    )}
                  </div>
                  {result && (
                    <details>
                      <summary>Request evidence</summary>
                      <dl>
                        <dt>Grant</dt>
                        <dd>{result.grantKey}</dd>
                        <dt>Observed creator</dt>
                        <dd>{result.observedCreator ?? "Not available"}</dd>
                        <dt>Request</dt>
                        <dd>{result.requestId}</dd>
                      </dl>
                    </details>
                  )}
                </article>
              );
            },
          )}
          <div className="boundary">
            <strong>One open permission contract.</strong>
            <p>
              Two logical executors, in one Vercel deployment. Neither asks
              Control for an ALLOW decision.
            </p>
          </div>
        </aside>
      </section>
      <section className="test-panel">
        <div>
          <p className="eyebrow">TRY THE BOUNDARIES</p>
          <h2>Good permissions say no, too.</h2>
          <p>
            Requests run against the real endpoints. Inspect the results above.
          </p>
          <p>
            The expiry test creates another owner grant for Atlas. It can write
            to Atlas even after the main grant is revoked, until the test grant
            expires.
          </p>
        </div>
        <div className="test-buttons">
          <button
            disabled={
              !enabled || find("atlas", "grant")?.status !== "confirmed"
            }
            onClick={() =>
              void task("Testing wrong project", () =>
                run("atlas", "wrong-project"),
              )
            }
          >
            ↗ Wrong project
          </button>
          <button
            disabled={!enabled}
            onClick={() =>
              void task("Testing forged creator", async () => {
                await chain("atlas", "forged");
                await run("atlas", "forged");
              })
            }
          >
            ◇ Forged grant
          </button>
          <button
            disabled={
              !enabled || find("atlas", "grant")?.status !== "confirmed"
            }
            onClick={() =>
              void task("Testing replay", () => run("atlas", "replay"))
            }
          >
            ↻ Replay request
          </button>
          <button
            disabled={!enabled}
            onClick={() =>
              void task("Creating expiry test", async () => {
                await chain("atlas", "expiry");
                await run("atlas", "expiry");
              })
            }
          >
            ◷ Create 60 s Atlas grant
          </button>
          <button
            disabled={
              !enabled || find("atlas", "expiry")?.status !== "confirmed"
            }
            onClick={() =>
              void task("Checking chain expiry", () => run("atlas", "expiry"))
            }
          >
            Check expiry after ~60 s
          </button>
        </div>
      </section>
      <section id="evidence" className="evidence">
        <details>
          <summary>
            <span>Evidence & independent verification</span>
            <span>+</span>
          </summary>
          <div className="evidence-content">
            <p>
              Demo owner: <code>{state?.owner ?? "Loading"}</code>
              <br />
              Agent: <code>{state?.agent ?? "Loading"}</code>
            </p>
            {state?.operations?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Project / operation</th>
                    <th>Transaction</th>
                    <th>Status / block</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {state.operations.map((op) => (
                    <tr key={op.id}>
                      <td>
                        {op.resource.endsWith("/atlas") ? "Atlas" : "Boreal"} /{" "}
                        {op.operation}
                      </td>
                      <td>
                        {op.txHash ? (
                          <a
                            href={`${explorer}/tx/${op.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {short(op.txHash)} ↗
                          </a>
                        ) : (
                          "Not submitted"
                        )}
                      </td>
                      <td>
                        {op.status} / {op.block ?? "pending"}
                      </td>
                      <td>
                        <code>{op.entityKey ?? "Pending confirmation"}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>
                Start a demo and create a grant to see transaction evidence.
              </p>
            )}
            <p>
              The CLI uses its own RPC connection and trusted owner
              configuration:
            </p>
            <pre>
              npm ci{"\n"}npm run verify -- --grant &lt;entityKey&gt; --resource
              &lt;resource&gt;{"\n"}npm run demo:independent -- --manifest
              &lt;manifest.json&gt;
            </pre>
            <p>
              See the repository README for server-only environment setup and
              the tools-only independence experiment.
            </p>
            <p>
              <a
                href="https://github.com/efeberk21/Bound"
                target="_blank"
                rel="noreferrer"
              >
                MIT source & reproduction guide ↗
              </a>
            </p>
          </div>
        </details>
      </section>
      <footer>
        <span className="wordmark">BOUND</span>
        <p>
          Revocation stops new operations after each executor observes it. It
          does not undo completed work.
          <br />
          Public grant metadata · shared demo · single deployment trust boundary
          · not a security audit.
        </p>
        <a
          href="https://docs.arkiv.network/networks/tiramisu/"
          target="_blank"
          rel="noreferrer"
        >
          Built on Arkiv ↗
        </a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
