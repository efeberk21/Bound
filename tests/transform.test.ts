import { describe, expect, it } from "vitest";
import { transformContentReply } from "../packages/core/src/transform.js";

const reply = (title: string, body: string) => ({
  decision: "ALLOW",
  serviceId: "bound.content.v1",
  content: { title, body },
});
describe("Content response to deterministic preview", () => {
  it("uses the returned source and changes its output when the source changes", () => {
    const first = transformContentReply(
      reply("Live title", "Returned first sentence. More detail follows."),
    );
    const next = transformContentReply(
      reply("Changed title", "Changed source sentence. Other detail."),
    );
    expect(first).toEqual({
      title: "Live title",
      body: "Returned first sentence.",
    });
    expect(next).toEqual({
      title: "Changed title",
      body: "Changed source sentence.",
    });
    expect(next).not.toEqual(first);
  });
  it("bounds long content and is deterministic", () => {
    const input = reply("Long ".repeat(30), "Source ".repeat(200));
    const result = transformContentReply(input);
    expect(result.title.length).toBeLessThanOrEqual(80);
    expect(result.body.length).toBeLessThanOrEqual(240);
    expect(transformContentReply(input)).toEqual(result);
  });
  it.each([
    {},
    { decision: "ALLOW" },
    reply("", ""),
    reply("Title", "  "),
    {
      decision: "DENY",
      serviceId: "bound.content.v1",
      content: { title: "x", body: "y" },
    },
  ])("rejects malformed or denied content without a fallback: %j", (input) => {
    expect(() => transformContentReply(input)).toThrow();
  });
});
