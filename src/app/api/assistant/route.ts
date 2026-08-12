import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { streamAssistantReply } from "@/lib/ai/assistant";
import { getLessonSource } from "@/lib/content/loader";
import { isAssistantConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * The study assistant endpoint.
 *
 * Streams plain text so the client can render as it arrives. Lesson context is
 * resolved **here, from a path** rather than accepted as content from the
 * browser — a client that could post arbitrary text as "the lesson" could use
 * this route as a general-purpose proxy to the operator's Anthropic account.
 */

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
  /** A curriculum path. The lesson body is loaded server-side from it. */
  lessonPath: z.string().max(300).optional(),
  /** The learner's own note, included only when they ask for it. */
  note: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isAssistantConfigured()) {
    return NextResponse.json(
      { error: "The study assistant is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const source = parsed.data.lessonPath
    ? getLessonSource(parsed.data.lessonPath)
    : null;

  try {
    const { textStream } = await streamAssistantReply({
      messages: parsed.data.messages,
      context: {
        ...(source
          ? {
              lesson: {
                title: source.lesson.frontmatter.title,
                summary: source.lesson.frontmatter.summary,
                objectives: source.lesson.frontmatter.objectives,
                body: source.body,
              },
            }
          : {}),
        ...(parsed.data.note ? { note: parsed.data.note } : {}),
      },
      signal: request.signal,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          /*
           * The response has already begun, so the status code is spent. Write
           * the failure into the text the operator is reading rather than
           * cutting the stream and leaving a half-sentence on screen.
           */
          if (!(error instanceof Error && error.name === "AbortError")) {
            controller.enqueue(
              encoder.encode("\n\n[The reply stopped early. Try asking again.]"),
            );
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The assistant is unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
