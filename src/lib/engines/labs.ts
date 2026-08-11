import type { LabDefinition } from "@/lib/domain/labs";

/**
 * Lab grading.
 *
 * Pure, so the same function decides whether a lab is solved on the client (to
 * show feedback) and on the server (to award XP). Answers are compared after
 * trimming and case-folding, because a lab is testing whether you know that a
 * root domain needs an A record — not whether you typed it in capitals.
 */

export type LabAnswers = Record<string, string | string[]>;

export interface LabItemResult {
  id: string;
  correct: boolean;
  /** What the learner supplied. */
  given: string | string[];
  explanation: string;
  label: string;
}

export interface LabResult {
  solved: boolean;
  correctCount: number;
  totalCount: number;
  results: LabItemResult[];
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matches(given: string, accept: readonly string[]): boolean {
  const g = normalise(given);
  if (g.length === 0) return false;
  return accept.some((candidate) => {
    const a = normalise(candidate);
    // Short answers must match exactly; longer ones may be contained, so
    // "attachments[0].url" also accepts "$.attachments[0].url".
    return a.length <= 4 ? g === a : g === a || g.endsWith(a);
  });
}

export function gradeLab(lab: LabDefinition, answers: LabAnswers): LabResult {
  switch (lab.kind) {
    case "fix-config":
    case "mapping": {
      const results = lab.fields.map((field) => {
        const given = answers[field.id];
        const value = typeof given === "string" ? given : "";
        return {
          id: field.id,
          label: field.label,
          correct: matches(value, field.accept),
          given: value,
          explanation: field.explanation,
        };
      });
      return summarise(results);
    }

    case "classify": {
      const results = lab.items.map((item) => {
        const given = answers[item.id];
        const value = typeof given === "string" ? given : "";
        return {
          id: item.id,
          label: item.label,
          correct: value === item.correctCategory,
          given: value,
          explanation: item.explanation,
        };
      });
      return summarise(results);
    }

    case "ordering": {
      const results = lab.steps.map((step) => {
        const given = answers[step.id];
        const value = typeof given === "string" ? given : "";
        return {
          id: step.id,
          label: step.label,
          correct: Number(value) === step.position,
          given: value,
          explanation: step.explanation,
        };
      });
      return summarise(results);
    }

    case "spot-the-flaw": {
      const selected = new Set(
        Array.isArray(answers.selected) ? answers.selected.map(Number) : [],
      );

      const results = lab.flaws.map((flaw) => ({
        id: flaw.id,
        label: `Line ${flaw.line}: ${flaw.label}`,
        correct: selected.has(flaw.line),
        given: selected.has(flaw.line) ? String(flaw.line) : "",
        explanation: flaw.explanation,
      }));

      // Selecting clean lines counts against you. Otherwise the winning
      // strategy is to select every line, which teaches nothing.
      const flawLines = new Set(lab.flaws.map((f) => f.line));
      const falsePositives = [...selected].filter((line) => !flawLines.has(line));

      const summary = summarise(results);
      return {
        ...summary,
        solved: summary.solved && falsePositives.length === 0,
        results: [
          ...summary.results,
          ...falsePositives.map((line) => ({
            id: `false-positive-${line}`,
            label: `Line ${line} is not a flaw`,
            correct: false,
            given: String(line),
            explanation:
              "Selecting clean lines counts against you. Flagging everything is not review; it is noise that trains the next reader to ignore you.",
          })),
        ],
      };
    }
  }
}

function summarise(results: LabItemResult[]): LabResult {
  const correctCount = results.filter((r) => r.correct).length;
  return {
    solved: correctCount === results.length && results.length > 0,
    correctCount,
    totalCount: results.length,
    results,
  };
}

/** Total items a lab asks for, used for progress display before grading. */
export function labItemCount(lab: LabDefinition): number {
  switch (lab.kind) {
    case "fix-config":
    case "mapping":
      return lab.fields.length;
    case "classify":
      return lab.items.length;
    case "ordering":
      return lab.steps.length;
    case "spot-the-flaw":
      return lab.flaws.length;
  }
}
