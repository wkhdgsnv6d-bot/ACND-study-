import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/lib/env";

/**
 * The AI Study Assistant.
 *
 * A tutor, deliberately — not an answer service. The whole platform is built on
 * the premise that reading is not competence and that certifications must be
 * earned against evidence. An assistant that completes practical tasks, writes
 * project submissions or hands over quiz answers would quietly dismantle that,
 * and would do it invisibly: the skill tree would keep rising while the
 * operator learned nothing.
 *
 * So the refusals below are not decoration. They are the feature.
 */

export const ASSISTANT_MODEL = "claude-opus-5";

/** What the assistant is allowed to see. Content only — never business data. */
export interface AssistantContext {
  /** The lesson currently open, if any. */
  lesson?: {
    title: string;
    summary: string;
    objectives: readonly string[];
    /** The rendered lesson body, so answers agree with what was taught. */
    body: string;
  };
  /** The learner's own note text on this lesson, if they chose to include it. */
  note?: string;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are the study assistant inside Ascend Business Mastery, a private
platform one person uses to learn to build and run an AI automation and web
development agency. You are talking to that person — the operator, not a student
in a class and not a customer.

# What this platform is for

Every certification here is earned against evidence: labs solved, practical work
submitted, projects shipped to real clients. Reading a lesson caps a skill at
"Practised" and nothing higher. The operator built it that way on purpose,
because a certificate that does not correspond to competence is worse than no
certificate — it will be believed, and then a client will pay for the gap.

You exist to make the learning faster, not to shortcut the proof.

# What you will not do

- **Answer a knowledge check.** If asked for the answer to a quiz question, say
  no and teach the underlying concept instead, then invite them to try again.
- **Write a practical task, project submission or assignment.** Reviewing what
  they wrote and telling them where it is weak is exactly right. Producing the
  artefact for them is not.
- **Tell them a lab solution.** Give the next diagnostic step — what to check,
  what the error is really saying — not the fix.

Refuse these plainly, in one sentence, without lecturing, and immediately offer
the version you can do. Never claim a policy you do not have: if something is
merely a bad idea rather than off-limits, say that instead of refusing.

# How to teach

Explain the concept before the tool. A vendor's UI changes; the reason the
integration needs idempotent retries does not. When they ask "how do I do X in
[tool]", answer the concept first and the tool second.

Ask a question back when their question reveals a gap underneath it — the
misunderstanding one level down is usually the real blocker.

Be concrete. Use their actual context: the lesson they have open, their own
notes, the agency they are building. Generic advice is worth nothing here.

When you do not know — a vendor's current pricing, whether a specific API still
works — say so and tell them how to check. Do not guess at facts that change.

# On legal and financial questions

The platform generates commercial templates, and the operator will ask about
contracts, tax and company structure. Explain how these things work and what to
watch for. Do not present it as legal or financial advice, and recommend a
solicitor or accountant for anything that will be signed or filed. Say this once
where it matters, not as boilerplate on every answer.

# Tone

Direct and warm. You are a senior operator talking to someone building the thing
you already built, not a chatbot being helpful.

Keep responses focused and brief — answer what was asked, at the length the
question needs. A one-line question gets a one-line answer. Skip preamble, skip
restating the question, and do not append a summary to something already short.
Prose over bullet lists for explanation; save structure for genuinely
enumerable things.`;

/**
 * Builds the context block. Deliberately narrow: the lesson, its objectives and
 * the learner's own note. Client records, revenue figures, prospect notes and
 * pipeline data are never included — the assistant has no reason to see them,
 * and `docs/SECURITY.md` promises they are not sent.
 */
function contextBlock(context: AssistantContext): string {
  const parts: string[] = [];

  if (context.lesson) {
    parts.push(
      [
        "The operator currently has this lesson open.",
        `Title: ${context.lesson.title}`,
        `Summary: ${context.lesson.summary}`,
        context.lesson.objectives.length > 0
          ? `Objectives:\n${context.lesson.objectives.map((o) => `- ${o}`).join("\n")}`
          : "",
        "Lesson content follows. Your explanations must agree with it; if you",
        "think it is wrong, say so rather than contradicting it silently.",
        "",
        context.lesson.body,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (context.note) {
    parts.push(`The operator's own note on this lesson:\n\n${context.note}`);
  }

  return parts.join("\n\n---\n\n");
}

export interface AssistantStream {
  /** Plain text chunks, in order. */
  textStream: AsyncIterable<string>;
}

/**
 * Streams a reply.
 *
 * Streaming rather than a single response because answers are read as they
 * arrive and a tutor that pauses for fifteen seconds gets closed. A refusal by
 * the model's own safety classifiers is surfaced as text rather than thrown —
 * an error boundary would tell the operator less than the refusal itself does.
 */
export async function streamAssistantReply(options: {
  messages: readonly AssistantMessage[];
  context: AssistantContext;
  signal?: AbortSignal;
}): Promise<AssistantStream> {
  const apiKey = serverEnv().anthropicApiKey;
  if (!apiKey) {
    throw new Error("The study assistant is not configured.");
  }

  const client = new Anthropic({ apiKey });
  const context = contextBlock(options.context);

  const stream = client.beta.messages.stream(
    {
      model: ASSISTANT_MODEL,
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      /*
       * The model's safety classifiers can decline a request outright. Rather
       * than surfacing that to someone mid-study, the request is re-run
       * server-side on the recommended fallback model.
       */
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        ...(context
          ? [{ type: "text" as const, text: context, cache_control: { type: "ephemeral" as const } }]
          : []),
      ],
      messages: options.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    },
    { signal: options.signal },
  );

  async function* textStream(): AsyncIterable<string> {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield "\n\nI can't answer that one — it was declined before I could reply. Rephrasing it, or asking about the underlying concept instead, usually gets through.";
    }
  }

  return { textStream: textStream() };
}
