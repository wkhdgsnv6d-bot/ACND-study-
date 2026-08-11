/**
 * Pipeline stages.
 *
 * Pure domain constants, deliberately separate from the query layer so client
 * components can import them without dragging a database client into the
 * browser bundle. See `src/lib/client-boundary.test.ts`.
 *
 * A stage represents a change in the *prospect's* commitment, not a task on
 * your to-do list. Activity-based stages ("followed up", "sent email") make
 * forecasting impossible, because nothing tells you whether a deal advanced.
 */

export const PROSPECT_STAGES = [
  "lead",
  "contacted",
  "replied",
  "discovery_booked",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "onboarding",
  "delivery",
  "completed",
  "recurring",
] as const;

export type ProspectStage = (typeof PROSPECT_STAGES)[number];

export const STAGE_LABELS: Record<ProspectStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  replied: "Replied",
  discovery_booked: "Discovery booked",
  qualified: "Qualified",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  onboarding: "Onboarding",
  delivery: "Delivery",
  completed: "Completed",
  recurring: "Recurring",
};

/** Stages representing live opportunities, in funnel order. */
export const FUNNEL_STAGES: ProspectStage[] = [
  "lead",
  "contacted",
  "replied",
  "discovery_booked",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
];

/** Stages at or beyond which a deal counts as won. */
export const WON_STAGES: ProspectStage[] = [
  "won",
  "onboarding",
  "delivery",
  "completed",
  "recurring",
];

/** Stages at or beyond which the prospect has engaged back. */
export const ENGAGED_STAGES: ProspectStage[] = [
  "replied",
  "discovery_booked",
  "qualified",
  "proposal_sent",
  "negotiation",
  ...WON_STAGES,
];
