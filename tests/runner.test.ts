import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { generatePrivateKey } from "viem/accounts";
import run from "../api/run.js";

const state = vi.hoisted(() => ({
  runId: "",
  reply: {} as Record<string, unknown>,
  writes: [] as unknown[],
  calls: 0,
}));
vi.mock("../packages/core/src/session.js", () => ({
  browserOriginAllowed: () => true,
  activeSession: async () => ({ runId: state.runId }),
}));
vi.mock("../packages/core/src/config.js", () => ({
  configuration: () => ({
    origin: "http://executors.invalid",
    deploymentId: "runner-test",
  }),
}));
vi.mock("../packages/core/src/db.js", () => ({
  database: () => async (strings: TemplateStringsArray) =>
    strings.join("").includes("chain_operations")
      ? [{ entity_key: `0x${"11".repeat(32)}` }]
      : [{ title: "Before", body: "Initial preview", revision: 0 }],
}));
vi.mock("../packages/core/src/runner.js", () => ({
  signedCall: async (input: { serviceId: string; preview?: unknown }) => ({
    call: async () => {
      if (input.serviceId === "bound.content.v1") return state.reply;
      state.writes.push(input.preview);
      state.calls++;
      return { decision: "ALLOW", serviceId: "bound.preview.v1" };
    },
  }),
}));
let server: Server,
  origin = "";
const previous = { ...process.env };
async function request(mode = "deterministic") {
  return fetch(origin, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project: "atlas", mode }),
  });
}
describe("runner Content -> transform -> separately authorized Preview flow", () => {
  beforeAll(async () => {
    state.runId = randomUUID();
    process.env.AGENT_PRIVATE_KEY = generatePrivateKey();
    server = createServer((req, res) => {
      void run(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test server");
    origin = `http://127.0.0.1:${address.port}`;
  });
  beforeEach(() => {
    state.writes = [];
    state.calls = 0;
    state.reply = {
      decision: "ALLOW",
      serviceId: "bound.content.v1",
      content: {
        title: "Returned title",
        body: "Returned sentence. Extra sentence.",
      },
    };
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
  });
  it("sends the returned source to Preview and responds to source changes", async () => {
    expect((await request()).status).toBe(200);
    expect(state.writes[0]).toEqual({
      title: "Returned title",
      body: "Returned sentence.",
    });
    state.reply.content = {
      title: "Different title",
      body: "Different sentence. More context.",
    };
    expect((await request()).status).toBe(200);
    expect(state.writes[1]).toEqual({
      title: "Different title",
      body: "Different sentence.",
    });
  });
  it("never attempts Preview if an ALLOW response contains malformed source", async () => {
    state.reply.content = { title: "", body: null };
    const response = await request();
    expect(response.status).toBe(502);
    expect(state.writes).toHaveLength(0);
  });
  it("stops on a Content denial", async () => {
    state.reply = { decision: "DENY", serviceId: "bound.content.v1" };
    expect((await request()).status).toBe(200);
    expect(state.writes).toHaveLength(0);
  });
  it("replays the same transformed write request", async () => {
    expect((await request("replay")).status).toBe(200);
    expect(state.calls).toBe(2);
    expect(state.writes[0]).toEqual(state.writes[1]);
  });
});
