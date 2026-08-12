import type { Metadata } from "next";
import Link from "next/link";

import { signUp } from "@/app/(auth)/actions";
import { AuthForm } from "@/app/(auth)/auth-form";
import { Card, CardBody } from "@/components/common/card";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Card>
      <CardBody className="space-y-6 py-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Create your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is a private platform. It is built for one operator, and every
            row of data is scoped to your account.
          </p>
        </div>

        <AuthForm action={signUp} mode="sign-up" />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
