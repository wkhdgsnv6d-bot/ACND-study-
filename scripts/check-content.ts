/**
 * Validates every MDX file under `content/` against the frontmatter schema and
 * the cross-file rules (prerequisite resolution, cycles, duplicate question
 * ids), then prints a coverage report.
 *
 * Runs in CI and as a `prebuild` step, so broken content fails the build rather
 * than rendering as an empty panel mid-study-session.
 *
 *   npm run content:check
 *   npm run content:check -- --strict   # treat warnings as failures
 */

import { relative } from "node:path";

import { loadCurriculumUncached } from "@/lib/content/loader";

const RESET = "[0m";
const RED = "[31m";
const YELLOW = "[33m";
const GREEN = "[32m";
const DIM = "[2m";
const BOLD = "[1m";

function main(): void {
  const strict = process.argv.includes("--strict");
  const { curriculum, issues } = loadCurriculumUncached();

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  for (const issue of [...errors, ...warnings]) {
    const colour = issue.severity === "error" ? RED : YELLOW;
    const label = issue.severity === "error" ? "error" : "warn ";
    const file = relative(process.cwd(), issue.file);
    console.log(`${colour}${label}${RESET} ${DIM}${file}${RESET}\n      ${issue.message}`);
  }

  printCoverage(curriculum);

  console.log("");
  if (errors.length > 0) {
    console.log(`${RED}${BOLD}✗ ${errors.length} error(s)${RESET}, ${warnings.length} warning(s)`);
    process.exit(1);
  }
  if (strict && warnings.length > 0) {
    console.log(`${YELLOW}${BOLD}✗ ${warnings.length} warning(s) with --strict${RESET}`);
    process.exit(1);
  }
  console.log(
    `${GREEN}${BOLD}✓ content valid${RESET}${warnings.length > 0 ? ` ${DIM}(${warnings.length} warning(s))${RESET}` : ""}`,
  );
}

function printCoverage(curriculum: ReturnType<typeof loadCurriculumUncached>["curriculum"]): void {
  if (curriculum.terms.length === 0) {
    console.log(`\n${DIM}No curriculum content yet.${RESET}`);
    return;
  }

  console.log(`\n${BOLD}Content coverage${RESET}`);
  console.log(
    `${DIM}Only lessons marked \`status: complete\` count toward certifications.${RESET}\n`,
  );

  let grandComplete = 0;
  let grandTotal = 0;
  let grandWords = 0;

  for (const term of curriculum.terms) {
    let termComplete = 0;
    let termTotal = 0;
    let termWords = 0;

    for (const mod of term.modules) {
      const complete = mod.lessons.filter((l) => l.frontmatter.status === "complete");
      termComplete += complete.length;
      termTotal += mod.lessons.length;
      termWords += mod.lessons.reduce((sum, l) => sum + l.wordCount, 0);
    }

    grandComplete += termComplete;
    grandTotal += termTotal;
    grandWords += termWords;

    const pct = termTotal === 0 ? 0 : Math.round((termComplete / termTotal) * 100);
    console.log(
      `  ${BOLD}${term.frontmatter.title}${RESET} ${DIM}·${RESET} ${term.modules.length} modules ${DIM}·${RESET} ` +
        `${termComplete}/${termTotal} lessons complete (${pct}%) ${DIM}·${RESET} ${termWords.toLocaleString()} words`,
    );

    for (const mod of term.modules) {
      const complete = mod.lessons.filter((l) => l.frontmatter.status === "complete").length;
      const bar = progressBar(mod.lessons.length === 0 ? 0 : complete / mod.lessons.length);
      console.log(
        `    ${bar} ${DIM}${complete}/${mod.lessons.length}${RESET} ${mod.frontmatter.title}`,
      );
    }
    console.log("");
  }

  const overall = grandTotal === 0 ? 0 : Math.round((grandComplete / grandTotal) * 100);
  console.log(
    `  ${BOLD}Overall${RESET} ${grandComplete}/${grandTotal} lessons complete (${overall}%) ${DIM}·${RESET} ${grandWords.toLocaleString()} words`,
  );
}

function progressBar(fraction: number, width = 12): string {
  const filled = Math.round(fraction * width);
  const colour = fraction === 1 ? GREEN : fraction > 0 ? YELLOW : DIM;
  return `${colour}${"█".repeat(filled)}${DIM}${"░".repeat(width - filled)}${RESET}`;
}

main();
