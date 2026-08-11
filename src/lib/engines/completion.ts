/**
 * Lesson completion criteria.
 *
 * Pure, so both the client (to enable a button) and the server (to decide
 * whether to accept) evaluate exactly the same rule. Living in `engines/`
 * rather than alongside the queries also keeps it out of the client bundle's
 * dependency graph — importing it must never drag in a database client.
 *
 * Reading is the weakest form of evidence the platform accepts, so the bar is
 * low but not zero: you must have reached the end and spent a plausible amount
 * of time there. The dwell requirement is proportional to the lesson's
 * estimated duration but capped, so a 60-minute lesson does not demand an
 * unbroken hour of presence.
 */

export const REQUIRED_SCROLL_COMPLETION = 0.85;
const DWELL_FRACTION = 0.4;
const DWELL_CAP_SECONDS = 10 * 60;

export function requiredDwellSeconds(durationMinutes: number): number {
  return Math.min(
    Math.round(durationMinutes * 60 * DWELL_FRACTION),
    DWELL_CAP_SECONDS,
  );
}

export interface CompletionEligibility {
  eligible: boolean;
  scrollMet: boolean;
  dwellMet: boolean;
  requiredSeconds: number;
  secondsSpent: number;
  scrollCompletion: number;
  /** Null when eligible. Otherwise the single most useful thing to say. */
  reason: string | null;
}

export function completionEligibility(options: {
  durationMinutes: number;
  secondsSpent: number;
  scrollCompletion: number;
}): CompletionEligibility {
  const requiredSeconds = requiredDwellSeconds(options.durationMinutes);
  const scrollMet = options.scrollCompletion >= REQUIRED_SCROLL_COMPLETION;
  const dwellMet = options.secondsSpent >= requiredSeconds;

  let reason: string | null = null;
  if (!scrollMet && !dwellMet) {
    reason = "Read to the end of the lesson first.";
  } else if (!scrollMet) {
    reason = "You have not reached the end of the lesson yet.";
  } else if (!dwellMet) {
    const remaining = Math.ceil((requiredSeconds - options.secondsSpent) / 60);
    reason = `About ${remaining} more minute${remaining === 1 ? "" : "s"} of reading time.`;
  }

  return {
    eligible: scrollMet && dwellMet,
    scrollMet,
    dwellMet,
    requiredSeconds,
    secondsSpent: options.secondsSpent,
    scrollCompletion: options.scrollCompletion,
    reason,
  };
}
