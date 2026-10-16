import { z } from "zod";
import { previewSchema, type Preview } from "./contracts.js";

import { sourceContentSchema } from "./api-contracts.js";

const contentReplySchema = z.object({
  decision: z.literal("ALLOW"),
  serviceId: z.literal("bound.content.v1"),
  content: sourceContentSchema,
});

function excerpt(text: string, limit: number) {
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit - 1);
  const boundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, boundary > limit / 2 ? boundary : prefix.length).trimEnd()}…`;
}

// Extractive editing: keep the source title and first sentence, with explicit
// length bounds. No prewritten fixture output or model call is used.
export function transformContentReply(reply: unknown): Preview {
  const { content } = contentReplySchema.parse(reply);
  const title = content.title.replace(/\s+/g, " ");
  const body = content.body.replace(/\s+/g, " ");
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0]!;
  return previewSchema.parse({
    title: excerpt(title, 80),
    body: excerpt(firstSentence, 240),
  });
}
