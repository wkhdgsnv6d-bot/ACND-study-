import { describe, expect, it } from "vitest";

import {
  isChoiceQuestion,
  lessonFrontmatter,
  lessonRef,
  moduleFrontmatter,
  question,
  skillXpMap,
} from "@/lib/content/schema";

function lesson(overrides: Record<string, unknown> = {}) {
  return {
    title: "REST and HTTP Methods",
    summary:
      "Which method to use for which operation, and why picking the wrong one causes silent data loss.",
    duration: 35,
    difficulty: "foundation",
    objectives: ["Choose the correct HTTP method for an operation"],
    ...overrides,
  };
}

describe("lesson frontmatter", () => {
  it("accepts a minimal valid lesson and applies defaults", () => {
    const parsed = lessonFrontmatter.parse(lesson());

    expect(parsed.status).toBe("draft");
    expect(parsed.xp).toBe(15);
    expect(parsed.prerequisites).toEqual([]);
    expect(parsed.quiz).toEqual([]);
    expect(parsed.skillXp).toEqual({});
  });

  it("rejects a lesson with no stated objective", () => {
    expect(() => lessonFrontmatter.parse(lesson({ objectives: [] }))).toThrow();
  });

  it("rejects a summary too short to be useful in search results", () => {
    expect(() => lessonFrontmatter.parse(lesson({ summary: "APIs." }))).toThrow();
  });

  it("rejects an unknown skill key rather than silently dropping it", () => {
    const result = lessonFrontmatter.safeParse(
      lesson({ skillXp: { api: 30, blockchain: 50 } }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("blockchain");
    }
  });

  it("caps the XP a lesson can award for being read", () => {
    expect(() => lessonFrontmatter.parse(lesson({ xp: 500 }))).toThrow();
  });
});

describe("lesson references", () => {
  it("accepts a fully-qualified path", () => {
    expect(lessonRef.parse("term-1/apis-and-webhooks/what-is-an-api")).toBeTruthy();
  });

  it("rejects a bare slug, which would be ambiguous across terms", () => {
    expect(lessonRef.safeParse("what-is-an-api").success).toBe(false);
  });

  it("rejects a term outside 1–4", () => {
    expect(lessonRef.safeParse("term-9/module/lesson").success).toBe(false);
  });
});

describe("skillXpMap", () => {
  it("accepts a partial map — a lesson need not touch every branch", () => {
    expect(skillXpMap.parse({ api: 40 })).toEqual({ api: 40 });
  });

  it("rejects a negative award", () => {
    expect(skillXpMap.safeParse({ api: -10 }).success).toBe(false);
  });
});

describe("quiz questions", () => {
  const base = {
    id: "http-method-choice",
    type: "multiple-choice",
    prompt: "Which method replaces an entire resource?",
    reviewConcept: "http-methods",
  };

  it("requires an explanation on every option, correct or not", () => {
    const result = question.safeParse({
      ...base,
      options: [
        { text: "PUT", correct: true, why: "Replaces the whole representation of the resource." },
        { text: "PATCH", correct: false, why: "Too short" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a well-formed question", () => {
    const result = question.safeParse({
      ...base,
      options: [
        {
          text: "PUT",
          correct: true,
          why: "PUT replaces the entire resource with the representation you send.",
        },
        {
          text: "PATCH",
          correct: false,
          why: "PATCH applies a partial update, leaving unmentioned fields untouched.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a question with no correct option", () => {
    const result = question.safeParse({
      ...base,
      options: [
        { text: "PUT", correct: false, why: "PUT replaces the entire resource, so this is wrong." },
        { text: "PATCH", correct: false, why: "PATCH applies a partial update, so this is wrong." },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects multiple correct options unless the question is multi-select", () => {
    const options = [
      { text: "PUT", correct: true, why: "PUT replaces the entire resource representation." },
      { text: "POST", correct: true, why: "POST creates a subordinate resource, also plausible." },
    ];

    expect(question.safeParse({ ...base, options }).success).toBe(false);
    expect(
      question.safeParse({ ...base, type: "multi-select", options }).success,
    ).toBe(true);
  });

  it("rejects a multi-select with only one correct option", () => {
    const result = question.safeParse({
      ...base,
      type: "multi-select",
      options: [
        { text: "PUT", correct: true, why: "PUT replaces the entire resource representation." },
        { text: "PATCH", correct: false, why: "PATCH applies a partial update instead." },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires a rubric and model answer on open questions", () => {
    const result = question.safeParse({
      id: "explain-apis",
      type: "short-answer",
      prompt: "Explain what an API is to a café owner.",
      reviewConcept: "api-definition",
      rubric: [],
      modelAnswer: "…",
    });

    expect(result.success).toBe(false);
  });

  it("distinguishes choice questions from open ones at the type level", () => {
    const choice = question.parse({
      ...base,
      options: [
        { text: "PUT", correct: true, why: "PUT replaces the entire resource representation." },
        { text: "PATCH", correct: false, why: "PATCH applies a partial update instead." },
      ],
    });
    const open = question.parse({
      id: "explain-apis",
      type: "short-answer",
      prompt: "Explain what an API is to a café owner.",
      reviewConcept: "api-definition",
      rubric: ["Uses plain language"],
      modelAnswer: "A menu of things a system will do for you.",
    });

    expect(isChoiceQuestion(choice)).toBe(true);
    expect(isChoiceQuestion(open)).toBe(false);
  });
});

describe("practical tasks", () => {
  it("requires at least two rubric criteria and one evidence kind", () => {
    const withoutEvidence = lessonFrontmatter.safeParse(
      lesson({
        practicalTask: {
          title: "Make your first API call",
          brief:
            "Pick a public API, read its documentation, and make one successful request to a real endpoint.",
          estimatedMinutes: 25,
          rubric: ["I received a 200", "I can point to the method and URL"],
          evidence: [],
        },
      }),
    );

    expect(withoutEvidence.success).toBe(false);
  });

  it("rejects a brief too thin to act on", () => {
    const result = lessonFrontmatter.safeParse(
      lesson({
        practicalTask: {
          title: "Do the thing",
          brief: "Build it.",
          estimatedMinutes: 25,
          rubric: ["a", "b"],
          evidence: ["written"],
        },
      }),
    );

    expect(result.success).toBe(false);
  });
});

describe("module frontmatter", () => {
  it("requires at least one skill so the module maps onto the skill tree", () => {
    const result = moduleFrontmatter.safeParse({
      title: "APIs & Webhooks",
      summary: "The module everything else in the program depends on.",
      objectives: ["Explain what an API is"],
      skills: [],
    });

    expect(result.success).toBe(false);
  });

  it("defaults the exam pass mark to 80", () => {
    const parsed = moduleFrontmatter.parse({
      title: "APIs & Webhooks",
      summary: "The module everything else in the program depends on.",
      objectives: ["Explain what an API is"],
      skills: ["api"],
      exam: { title: "Module Exam" },
    });

    expect(parsed.exam?.passMark).toBe(80);
    expect(parsed.exam?.questionCount).toBe(15);
  });
});
