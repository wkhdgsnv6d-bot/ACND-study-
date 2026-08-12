import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { isAssistantConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Study assistant" };

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Study assistant"
        description="A tutor, not an answer service. Open it from inside a lesson and it knows what you are reading."
      />

      <div className="mt-8">
        <AssistantPanel configured={isAssistantConfigured()} />
      </div>

      <Card className="mt-8">
        <CardHeader
          title="What it will not do"
          description="These are deliberate, and they are the point."
        />
        <CardBody>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              Answer a knowledge check. It will teach the concept and send you
              back to try again.
            </li>
            <li>
              Write a practical task, project submission or assignment. It will
              review what you wrote and tell you where it is weak.
            </li>
            <li>
              Hand you a lab solution. It will give you the next diagnostic step.
            </li>
          </ul>
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
            Every certification here is earned against evidence. An assistant
            that completed the work for you would raise the numbers and teach you
            nothing — and the gap would show up in front of a paying client.
          </p>
        </CardBody>
      </Card>

      <p className="mt-6 text-xs text-subtle-foreground">
        Conversations are not saved. Anything worth keeping belongs in Notes, in
        your own words — which is better for remembering it anyway. Your client
        records, revenue figures and pipeline are never sent.
      </p>
    </div>
  );
}
