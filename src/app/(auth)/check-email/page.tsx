import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardBody className="space-y-4 py-8 text-center">
        <MailCheck className="mx-auto size-7 text-primary" aria-hidden />
        <h2 className="text-base font-semibold tracking-tight">Check your email</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          We have sent a confirmation link. Open it to activate your account, then
          come back and sign in.
        </p>
        <p className="text-xs text-subtle-foreground text-pretty">
          Nothing arrived? Check spam, and confirm the redirect URL in your
          Supabase project&apos;s auth settings matches this site.
        </p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </CardBody>
    </Card>
  );
}
