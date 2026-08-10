"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Authentication server actions.
 *
 * Credentials are handled server-side only — they are never held in client
 * component state beyond the moment of submission, and no auth logic ships to
 * the browser.
 *
 * Error messages are deliberately non-committal about *which* half of a
 * credential pair was wrong. Telling an attacker that an email exists but the
 * password is wrong is free reconnaissance.
 */

export interface AuthFormState {
  error: string | null;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
}

const credentials = z.object({
  email: z.string().min(1, "Enter your email address").email("That does not look like an email address"),
  password: z.string().min(1, "Enter your password"),
});

const signupCredentials = credentials.extend({
  password: z
    .string()
    .min(12, "Use at least 12 characters — this protects real client data")
    .max(200),
});

function fieldErrorsFrom(error: z.ZodError): AuthFormState["fieldErrors"] {
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "email" || key === "password") {
      fieldErrors[key] ??= issue.message;
    }
  }
  return fieldErrors;
}

/** Only allow same-site relative paths, so `?next=` cannot become an open redirect. */
function safeRedirect(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase is not configured yet. See /setup." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "That email and password combination did not work." };
  }

  redirect(safeRedirect(formData.get("next")));
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupCredentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase is not configured yet. See /setup." };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation enabled, no session is returned yet.
  if (data.session) redirect("/dashboard");
  redirect("/check-email");
}
