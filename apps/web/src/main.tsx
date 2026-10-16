import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  AppearanceControl,
  Disclosure,
  ProjectSwitcher,
  settle,
} from "./ui.js";
import "./style.css";
import { Icon } from "./icons.js";
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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M6 8h10a8 8 0 0 1 0 16H6V8Z"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path d="M15 8h11v16H15" stroke="currentColor" strokeWidth="3.5" />
        </svg>
      </span>
      {!compact && (
        <span>
          bound<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}

function App() {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(Date.now());
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<Project>("atlas");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [completion, setCompletion] = useState("");
  const [labOpen, setLabOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
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
  useEffect(() => {
    if (!completion) return;
    const timer = window.setTimeout(() => setCompletion(""), 5000);
    return () => window.clearTimeout(timer);
  }, [completion]);
  async function task(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError("");
    setCompletion("");
    try {
      await work();
      setCompletion(`${label} completed`);
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
    if (!usable) return state?.session ? "Session ended" : "Start a session";
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
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <a className="brand-link" href="/" aria-label="BOUND home">
          <Brand />
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">B</span>
          <span>
            Demo workspace<small>Shared test environment</small>
          </span>
          <span className="sandbox-dot" />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          <a className="nav-item current" href="#workspace">
            <Icon name="grid" />
            Task permissions<span className="nav-count">2</span>
          </a>
          <a
            className="nav-item"
            href="#boundary-lab"
            onClick={() => setLabOpen(true)}
          >
            <Icon name="flask" />
            Boundary lab
          </a>
          <a
            className="nav-item"
            href="#evidence"
            onClick={() => setEvidenceOpen(true)}
          >
            <Icon name="layers" />
            On-chain evidence
          </a>
        </nav>
        <div className="sidebar-principle">
          <span className="principle-icon">
            <Icon name="shield" />
          </span>
          <strong>
            Small permissions.
            <br />
            Clear boundaries.
          </strong>
          <p>Give an agent the access it needs. Keep control of each task.</p>
        </div>
        <div className="sidebar-bottom">
          <a
            href="https://github.com/efeberk21/Bound"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="code" />
            Source & docs
            <Icon name="external" />
          </a>
          <span>
            <i />
            Built on Arkiv<span className="version">v0.1</span>
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <a className="mobile-brand" href="/" aria-label="BOUND home">
            <Brand compact />
          </a>
          <div className="breadcrumbs">
            Workspace
            <Icon name="chevron" />
            <span>Task permissions</span>
          </div>
          <span className="network">
            <i />
            Tiramisu testnet
          </span>
          <span className="environment-label">Synthetic demo</span>
          <AppearanceControl />
        </header>
        <main id="workspace">
          <section className="intro">
            <div>
              <p className="eyebrow">
                <span /> ACCESS, WITH INTENTION
              </p>
              <h1>
                Revoke the task. <span>Keep the agent working.</span>
              </h1>
              <p className="lead">
                One agent. Two projects. Stop Atlas without interrupting Boreal.
              </p>
            </div>
          </section>
          <section
            className={`session-box ${usable ? "session-live" : ""}`}
            aria-label="Demo session"
          >
            <div className="agent-avatar">
              <Icon name="agent" />
              <span />
            </div>
            <div className="session-info">
              <div className="session-title">
                <strong>One agent. Your boundaries.</strong>
                <span className="session-badge">
                  {usable ? "Session ready" : "Demo agent"}
                </span>
              </div>
              <p className="session-description">
                {usable && state?.session
                  ? `Session ends ${new Date(state.session.expiresAt).toLocaleTimeString()}`
                  : "Start a five-minute sandbox. No wallet or setup needed."}
              </p>
            </div>
            <div className="session-action">
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
                {usable ? "Resume demo" : "Start demo"} <Icon name="arrow" />
              </button>
              <small>Shared sandbox · busy? Try again within 5 min.</small>
            </div>
          </section>
          <div className="walkthrough" aria-label="How the demo works">
            <span>
              <b>1</b>Grant a task
            </span>
            <Icon name="chevron" />
            <span>
              <b>2</b>Run the agent
            </span>
            <Icon name="chevron" />
            <span>
              <b>3</b>Revoke & compare
            </span>
            <span className="mode-label">
              <Icon name="code" />
              Deterministic mode
            </span>
          </div>
          {error && (
            <div role="alert" className="error">
              <strong>Unable to complete</strong>
              <span>{error.replaceAll("_", " ")}</span>
            </div>
          )}
          <div
            className="feedback-position"
            aria-live="polite"
            aria-atomic="true"
          >
            <AnimatePresence initial={false}>
              {(busy || completion) && (
                <motion.div
                  key={busy ? "progress" : "complete"}
                  className={`working ${busy ? "" : "work-complete"}`}
                  role="status"
                  initial={{
                    opacity: 0,
                    y: reducedMotion ? 0 : 10,
                    scale: reducedMotion ? 1 : 0.98,
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                  transition={reducedMotion ? { duration: 0.12 } : settle}
                >
                  {busy ? <span className="spinner" /> : <Icon name="check" />}
                  <span>{busy ? `${busy}…` : completion}</span>
                  {!busy && (
                    <button
                      onClick={() => setCompletion("")}
                      aria-label="Dismiss notification"
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <section className="workspace">
            <aside className="tasks">
              <div className="section-label">
                <h2>Task permissions</h2>
                <span>2 projects</span>
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
                    className={`task-card project-${project} ${selected === project ? "selected" : ""}`}
                  >
                    <button
                      className="task-select"
                      onClick={() => setSelected(project)}
                      aria-pressed={selected === project}
                      aria-controls={`${project}-controls`}
                    >
                      <span className="project-icon">
                        {index === 0 ? "A" : "B"}
                      </span>
                      <span>
                        <strong>
                          {project === "atlas" ? "Atlas" : "Boreal"}
                        </strong>
                        <small>Project introduction</small>
                      </span>
                      <Icon
                        name={selected === project ? "check" : "chevron"}
                        className="task-arrow"
                      />
                    </button>
                    <span
                      className={`status status-${s.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      <i />
                      {s}
                    </span>
                    <motion.div
                      id={`${project}-controls`}
                      className="task-controls"
                      initial={false}
                      animate={{
                        height: selected === project ? "auto" : 0,
                        opacity: selected === project ? 1 : 0,
                      }}
                      transition={reducedMotion ? { duration: 0 } : settle}
                      inert={selected !== project}
                      aria-hidden={selected !== project}
                    >
                      <dl>
                        <div>
                          <dt>Scope</dt>
                          <dd>
                            <span>Read content</span>
                            <span>Update preview</span>
                          </dd>
                        </div>
                        <div>
                          <dt>Lifetime</dt>
                          <dd>~15 min on chain</dd>
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
                              find(project, "revoke")
                                ? "check"
                                : "deterministic",
                            ),
                          )
                        }
                      >
                        <span>
                          <Icon name="arrow" />
                          Run deterministic test
                        </span>
                        <span>
                          <Icon name="external" />
                        </span>
                      </button>
                      <button
                        className="ai"
                        disabled
                        title="Free AI Gateway access is not enabled for this account."
                      >
                        Run with AI · unavailable
                      </button>
                    </motion.div>
                  </article>
                );
              })}
              <p className="task-footnote">
                <Icon name="agent" />
                <span>
                  Same agent for both projects
                  <br />
                  <code>
                    {state?.agent ? short(state.agent) : "Loading agent…"}
                  </code>
                  <br />
                  15 min policy ceiling per grant
                </span>
              </p>
            </aside>
            <section className="editor">
              <div className="section-label">
                <h2>Work preview</h2>
                <span>Real effect</span>
              </div>
              <ProjectSwitcher selected={selected} onSelect={setSelected} />
              <div className="editor-body">
                <div className="editor-toolbar">
                  <span className={`project-tag tag-${selected}`}>
                    <span />
                    {selected === "atlas" ? "Atlas" : "Boreal"}
                    <span className="toolbar-separator">/</span>Introduction
                  </span>
                  <span>
                    {current ? (
                      <>
                        Preview revision <b>{current.revision}</b>
                      </>
                    ) : (
                      "Not saved yet"
                    )}
                  </span>
                </div>
                <Disclosure
                  className="source"
                  open={sourceOpen}
                  onOpenChange={setSourceOpen}
                  summary={
                    <>
                      <span className="label">
                        <Icon name="read" />
                        ORIGINAL CONTENT
                      </span>
                      <span className="source-toggle">
                        View source
                        <Icon name="chevron" />
                      </span>
                    </>
                  }
                >
                  <div className="source-content">
                    <span className="sample-label">Synthetic source</span>
                    <h3>{source.title}</h3>
                    <p>{source.body}</p>
                  </div>
                </Disclosure>
                <div className="preview-output">
                  <div className="output-label">
                    <span className="label">
                      <Icon name="write" />
                      {current ? "CURRENT PREVIEW" : "PREVIEW"}
                    </span>
                    <span className="muted">
                      {current
                        ? `Saved · revision ${current.revision}`
                        : "Example · not saved"}
                    </span>
                  </div>
                  <motion.div
                    className="preview-paper"
                    key={selected + ":" + (current?.revision ?? "sample")}
                    initial={{ opacity: 0.5, y: reducedMotion ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0.12 } : settle}
                  >
                    <span
                      className={`document-mark mark-${selected}`}
                      aria-hidden="true"
                    >
                      {selected === "atlas" ? "A" : "B"}
                      <span>PROJECT NOTES</span>
                    </span>
                    <h3>{current?.title ?? source.title}</h3>
                    <p>{current?.body ?? source.body}</p>
                  </motion.div>
                </div>
                {lastRun?.before && (
                  <details className="before">
                    <summary>
                      Before the last request · revision{" "}
                      {lastRun.before.revision}
                    </summary>
                    <h4>{lastRun.before.title}</h4>
                    <p>{lastRun.before.body}</p>
                  </details>
                )}
                <p className="editor-note">
                  <Icon name="lock" />A denied write changes nothing. Your last
                  saved preview stays intact.
                </p>
              </div>
            </section>
            <aside className="decisions">
              <div className="section-label">
                <h2>Tool decisions</h2>
                <span>Live checks</span>
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
                    <motion.article
                      className="decision-card"
                      key={`${service}:${selected}:${result?.requestId ?? "idle"}`}
                      initial={{ opacity: 0.55, y: reducedMotion ? 0 : 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reducedMotion ? { duration: 0.12 } : settle}
                    >
                      <div className="decision-title">
                        <span className="tool-icon">
                          <Icon name={index === 0 ? "read" : "write"} />
                        </span>
                        <div>
                          <h3>{index === 0 ? "Content" : "Preview"}</h3>
                          <small>
                            {index === 0 ? "Read access" : "Write access"}
                          </small>
                        </div>
                        <span className="tool-number">0{index + 1}</span>
                      </div>
                      <span
                        className={`decision-value ${result?.decision.toLowerCase() ?? ""}`}
                      >
                        <span className="decision-dot" />
                        {result?.decision ?? "Not checked"}
                      </span>
                      <p>
                        {result?.reasonCode
                          .replaceAll("_", " ")
                          .toLowerCase() ??
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
                    </motion.article>
                  );
                },
              )}
              <div className="boundary">
                <Icon name="shield" />
                <strong>Each tool decides.</strong>
                <p>
                  Each tool reads Arkiv before acting. Two logical executors
                  share one Vercel deployment; neither asks Control for ALLOW.
                </p>
              </div>
            </aside>
          </section>
          <section id="boundary-lab" className="test-panel">
            <Disclosure
              className="lab-disclosure"
              open={labOpen}
              onOpenChange={setLabOpen}
              summary={
                <>
                  <span className="disclosure-icon">
                    <Icon name="flask" />
                  </span>
                  <span>
                    <strong>Test the boundaries</strong>
                    <small>
                      Wrong project. Forged grant. Replayed request. See what
                      gets stopped.
                    </small>
                  </span>
                  <span className="disclosure-hint">
                    {labOpen ? "Close lab" : "Open lab"}
                  </span>
                  <Icon name="chevron" />
                </>
              }
            >
              <div className="lab-content">
                <p className="lab-description">
                  These tests send real requests. Results open on the affected
                  project.
                </p>
                <p className="expiry-notice">
                  <Icon name="clock" />
                  <span>
                    The expiry test creates a separate Atlas grant. It can write
                    even after the main grant is revoked, until the test grant
                    expires.
                  </span>
                </p>
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
                    <Icon name="external" />
                    <span>
                      Wrong project<small>Try Atlas access on Boreal</small>
                    </span>
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
                    <Icon name="shield" />
                    <span>
                      Forged grant<small>Same data, untrusted creator</small>
                    </span>
                  </button>
                  <button
                    disabled={
                      !enabled || find("atlas", "grant")?.status !== "confirmed"
                    }
                    onClick={() =>
                      void task("Testing replay", () => run("atlas", "replay"))
                    }
                  >
                    <Icon name="replay" />
                    <span>
                      Replay request
                      <small>Send the same signed write twice</small>
                    </span>
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
                    <Icon name="clock" />
                    <span>
                      Create 60 s Atlas grant
                      <small>Test a separate short-lived permission</small>
                    </span>
                  </button>
                  <button
                    disabled={
                      !enabled ||
                      find("atlas", "expiry")?.status !== "confirmed"
                    }
                    onClick={() =>
                      void task("Checking chain expiry", () =>
                        run("atlas", "expiry"),
                      )
                    }
                  >
                    <Icon name="clock" />
                    <span>
                      Check expiry
                      <small>Run after approximately 60 seconds</small>
                    </span>
                  </button>
                </div>
              </div>
            </Disclosure>
          </section>
          <section id="evidence" className="evidence">
            <Disclosure
              open={evidenceOpen}
              onOpenChange={setEvidenceOpen}
              summary={
                <>
                  <span className="disclosure-icon">
                    <Icon name="layers" />
                  </span>
                  <span>
                    <strong>Evidence & independent verification</strong>
                    <small>
                      On-chain transactions, observed creators, and a verifier
                      you can run yourself.
                    </small>
                  </span>
                  <span className="disclosure-hint">
                    {evidenceOpen ? "Close" : "Inspect"}
                  </span>
                  <Icon name="chevron" />
                </>
              }
            >
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
                            {op.resource.endsWith("/atlas")
                              ? "Atlas"
                              : "Boreal"}{" "}
                            / {op.operation}
                          </td>
                          <td>
                            {op.txHash ? (
                              <a
                                href={`${explorer}/tx/${op.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {short(op.txHash)} <Icon name="external" />
                              </a>
                            ) : (
                              "Not submitted"
                            )}
                          </td>
                          <td>
                            {op.status} / {op.block ?? "pending"}
                          </td>
                          <td>
                            <code>
                              {op.entityKey ?? "Pending confirmation"}
                            </code>
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
                  npm ci{"\n"}npm run verify -- --grant &lt;entityKey&gt;
                  --resource &lt;resource&gt;{"\n"}npm run demo:independent --
                  --manifest &lt;manifest.json&gt;
                </pre>
                <p>
                  See the repository README for server-only environment setup
                  and the tools-only independence experiment.
                </p>
                <p>
                  <a
                    href="https://github.com/efeberk21/Bound"
                    target="_blank"
                    rel="noreferrer"
                  >
                    MIT source & reproduction guide <Icon name="external" />
                  </a>
                </p>
              </div>
            </Disclosure>
          </section>
          <footer>
            <Brand />
            <p>
              Revocation stops new operations after each executor observes it.
              It does not undo completed work.
              <br />
              Public grant metadata · synthetic resources · shared demo · not a
              security audit.
            </p>
            <div className="footer-links">
              <a
                href="https://docs.arkiv.network/networks/tiramisu/"
                target="_blank"
                rel="noreferrer"
              >
                Built on Arkiv <Icon name="external" />
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user" transition={settle}>
      <App />
    </MotionConfig>
  </StrictMode>,
);
