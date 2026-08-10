"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthFormState } from "@/app/(auth)/actions";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const EMPTY: AuthFormState = { error: null };

export function AuthForm({
  action,
  mode,
  next,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  mode: "sign-in" | "sign-up";
  next?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const signingUp = mode === "sign-up";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? <ErrorState description={state.error} /> : null}

      <Field label="Email" error={state.fieldErrors?.email} required>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field
        label="Password"
        error={state.fieldErrors?.password}
        description={
          signingUp
            ? "At least 12 characters. This account will hold real client information."
            : undefined
        }
        required
      >
        {(props) => (
          <Input
            {...props}
            name="password"
            type="password"
            autoComplete={signingUp ? "new-password" : "current-password"}
          />
        )}
      </Field>

      <SubmitButton>{signingUp ? "Create account" : "Sign in"}</SubmitButton>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}
