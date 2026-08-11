"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SKILL_KEYS } from "@/lib/domain/skills";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Portfolio projects.
 *
 * A project is the strongest evidence the platform accepts, and the only kind
 * that can lift a skill to Mastered — so `clientReady` is a claim with weight.
 * The lessons-learned and problems fields are required rather than optional:
 * a portfolio entry that records only what you built, and not what went wrong,
 * is a screenshot rather than evidence.
 */

export interface ProjectActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: Record<string, string>;
}

export const PROJECT_IDLE: ProjectActionState = { status: "idle", message: null };

const optionalUrl = z
  .string()
  .trim()
  .url("Must be a full URL including https://")
  .optional()
  .or(z.literal(""));

const projectSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Give the project a name").max(120),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["planning", "in_progress", "complete", "archived"]),
  skills: z.array(z.enum(SKILL_KEYS)).max(12),
  tech: z.string().trim().max(400).optional(),
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
  screenshot: optionalUrl,
  lessonsLearned: z.string().trim().max(8000).optional(),
  problemsEncountered: z.string().trim().max(8000).optional(),
  howISolvedThem: z.string().trim().max(8000).optional(),
  clientReady: z.boolean(),
  portfolioReady: z.boolean(),
});

export async function saveProject(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = projectSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
    skills: formData.getAll("skills"),
    tech: formData.get("tech") ?? undefined,
    repoUrl: formData.get("repoUrl") ?? "",
    liveUrl: formData.get("liveUrl") ?? "",
    screenshot: formData.get("screenshot") ?? "",
    lessonsLearned: formData.get("lessonsLearned") ?? undefined,
    problemsEncountered: formData.get("problemsEncountered") ?? undefined,
    howISolvedThem: formData.get("howISolvedThem") ?? undefined,
    clientReady: formData.get("clientReady") === "on",
    portfolioReady: formData.get("portfolioReady") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: null, fieldErrors };
  }

  const d = parsed.data;

  // Claiming a project is client-ready without recording what went wrong is
  // the portfolio equivalent of a testimonial you wrote yourself.
  if (d.clientReady && (d.lessonsLearned ?? "").length < 80) {
    return {
      status: "error",
      message: null,
      fieldErrors: {
        lessonsLearned:
          "A client-ready project needs a real account of what you learned — at least a paragraph.",
      },
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Database not configured." };

  const payload = {
    user_id: user.id,
    name: d.name,
    description: d.description || null,
    status: d.status,
    skills: d.skills,
    tech: (d.tech ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    repo_url: d.repoUrl || null,
    live_url: d.liveUrl || null,
    screenshots: d.screenshot ? [d.screenshot] : [],
    lessons_learned: d.lessonsLearned || null,
    problems_encountered: d.problemsEncountered || null,
    how_i_solved_them: d.howISolvedThem || null,
    client_ready: d.clientReady,
    portfolio_ready: d.portfolioReady,
    updated_at: new Date().toISOString(),
  };

  const { error } = d.id
    ? await supabase
        .from("projects")
        .update(payload)
        .eq("id", d.id)
        .eq("user_id", user.id)
    : await supabase.from("projects").insert(payload);

  if (error) return { status: "error", message: error.message };

  if (!d.id) {
    await supabase.from("xp_events").upsert(
      {
        user_id: user.id,
        source_type: "project_submitted",
        source_id: d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        amount: 400,
        skill_xp: Object.fromEntries(d.skills.map((s) => [s, 60])),
      },
      { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true },
    );

    await supabase.from("activity_log").insert({
      user_id: user.id,
      kind: "project_added",
      summary: `Added project “${d.name}”`,
    });
  }

  revalidatePath("/projects");
  revalidatePath("/skills");
  revalidatePath("/dashboard");
  return { status: "success", message: d.id ? "Project updated." : "Project added." };
}

export async function deleteProject(id: string): Promise<ProjectActionState> {
  if (!z.string().uuid().safeParse(id).success) {
    return { status: "error", message: "Invalid project." };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Database not configured." };

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/projects");
  revalidatePath("/skills");
  return { status: "success", message: "Deleted." };
}
