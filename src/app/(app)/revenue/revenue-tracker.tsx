"use client";

import { saveClient, saveRevenueEntry } from "@/app/(app)/business-actions";
import { RecordForm, Select } from "@/components/business/record-form";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { Field, Input } from "@/components/ui/field";
import { formatCurrency } from "@/lib/engines/finance";
import type { ClientRow, RevenueRow } from "@/lib/queries/business";

export function RevenueTracker({
  entries,
  clients,
  currency,
}: {
  entries: RevenueRow[];
  clients: ClientRow[];
  currency: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <RecordForm title="Record revenue" addLabel="Record revenue" action={saveRevenueEntry}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              name="type"
              label="Type"
              defaultValue="project"
              required
              options={[
                { value: "setup", label: "Setup fee" },
                { value: "project", label: "Project" },
                { value: "recurring", label: "Recurring" },
                { value: "other", label: "Other" },
              ]}
            />
            <Field label={`Amount (${currency})`} required>
              {(props) => <Input {...props} name="amount" type="number" step="0.01" min={0} />}
            </Field>
            <Field label="Date incurred" required>
              {(props) => <Input {...props} name="incurredOn" type="date" defaultValue={today} />}
            </Field>
            <Field label="Date paid" description="Leave blank until the money arrives.">
              {(props) => <Input {...props} name="paidOn" type="date" />}
            </Field>
            <Select
              name="clientId"
              label="Client"
              options={[
                { value: "", label: "—" },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Field label="Description">
              {(props) => <Input {...props} name="description" />}
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="invoiced"
              className="size-4 rounded border-border accent-[var(--primary)]"
            />
            Invoiced
          </label>
        </RecordForm>

        <RecordForm title="Add client" addLabel="Add client" action={saveClient}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              {(props) => <Input {...props} name="name" />}
            </Field>
            <Field label="Industry">
              {(props) => <Input {...props} name="industry" />}
            </Field>
            <Select
              name="status"
              label="Status"
              defaultValue="active"
              required
              options={[
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "completed", label: "Completed" },
                { value: "churned", label: "Churned" },
              ]}
            />
            <Field label={`Contract value (${currency})`}>
              {(props) => <Input {...props} name="contractValue" type="number" min={0} defaultValue={0} />}
            </Field>
            <Field label={`MRR (${currency})`}>
              {(props) => <Input {...props} name="mrr" type="number" min={0} defaultValue={0} />}
            </Field>
            <Field label="Start date">
              {(props) => <Input {...props} name="startDate" type="date" />}
            </Field>
          </div>
          <Field label="Handover documentation URL">
            {(props) => <Input {...props} name="docsUrl" placeholder="https://…" />}
          </Field>
        </RecordForm>
      </div>

      <Card>
        <CardHeader title="Clients" description={`${clients.length} on the books`} />
        <CardBody>
          {clients.length === 0 ? (
            <EmptyState title="No clients yet" description="The first one changes everything else on this platform." />
          ) : (
            <ul className="space-y-2">
              {clients.map((client) => (
                <li
                  key={client.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{client.name}</span>
                      <StatusPill tone={client.status === "active" ? "success" : "neutral"}>
                        {client.status}
                      </StatusPill>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-subtle-foreground">
                      {client.industry ? <span>{client.industry}</span> : null}
                      {client.startDate ? <span>since {client.startDate}</span> : null}
                      {client.docsUrl ? (
                        <a
                          href={client.docsUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-primary hover:underline"
                        >
                          Handover docs
                        </a>
                      ) : (
                        <span className="text-warning">No handover docs</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {client.mrrCents > 0 ? (
                      <div className="font-mono text-sm text-success tabular-nums">
                        {formatCurrency(client.mrrCents, { currency })}/mo
                      </div>
                    ) : null}
                    {client.contractValueCents > 0 ? (
                      <div className="font-mono text-xs text-subtle-foreground tabular-nums">
                        {formatCurrency(client.contractValueCents, { currency })} contract
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Revenue" description={`${entries.length} entries`} />
        <CardBody>
          {entries.length === 0 ? (
            <EmptyState title="No revenue recorded" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                    <th className="px-2 py-2 text-right font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        {entry.incurredOn}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground capitalize">
                        {entry.type}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {entry.description ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatCurrency(entry.amountCents, { currency })}
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        {entry.paidOn ? (
                          <span className="text-success">{entry.paidOn}</span>
                        ) : (
                          <span className="text-warning">
                            {entry.invoiced ? "invoiced" : "unbilled"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
