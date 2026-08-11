import { isChoiceQuestion, type Question } from "@/lib/content/schema";

/**
 * The shape of a question once it is safe to send to the browser.
 *
 * `correct` and `why` are stripped. Without this, the answers would sit in the
 * page source, which makes cheating a matter of opening devtools rather than a
 * deliberate act — and the whole platform is built on the idea that shortcuts
 * should be deliberate.
 *
 * Explanations come back from the server *after* grading, which is also when
 * they teach the most.
 */
export interface ClientQuestion {
  id: string;
  type: Question["type"];
  prompt: string;
  code?: string;
  codeLang?: string;
  /** Option text only. Absent for open questions. */
  options?: string[];
  multiple: boolean;
  open: boolean;
  points: number;
}

export function toClientQuestions(questions: readonly Question[]): ClientQuestion[] {
  return questions.map((question) => {
    if (isChoiceQuestion(question)) {
      return {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        code: question.code,
        codeLang: question.codeLang,
        options: question.options.map((option) => option.text),
        multiple: question.type === "multi-select",
        open: false,
        points: question.points,
      };
    }
    return {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      multiple: false,
      open: true,
      points: question.points,
    };
  });
}

/** Total marks available from machine-gradable questions only. */
export function gradablePoints(questions: readonly Question[]): number {
  return questions
    .filter(isChoiceQuestion)
    .reduce((sum, question) => sum + question.points, 0);
}
