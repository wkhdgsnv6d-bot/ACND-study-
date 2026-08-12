import type { Metadata } from "next";
import Link from "next/link";

import { signIn } from "@/app/(auth)/actions";
import { AuthForm } from "@/app/(auth)/auth-form";
import { Card, CardBody } from "@/components/common/card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <Card>
      <CardBody className="space-y-6 py-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue building Ascend.
          </p>
        </div>

        <AuthForm action={signIn} mode="sign-in" next={next} />

        <p className="text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href="/signup" className="text-primary underline underline-offset-2">
            Create one
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
