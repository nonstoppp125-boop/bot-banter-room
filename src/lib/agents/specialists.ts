import { generateText } from "ai";

import { groqModel } from "./groq";
import type { AgentDefinition, SpecialistInput } from "./types";

// Ported from PR #1 (feat/base-multi-agent-orchestration): Problem Solver + Quality Reviewer.
const SOLVER_SYSTEM =
  "You are the Problem Solver specialist. Work out a correct, complete, practical answer to the user's latest message. Be concrete and step-by-step where useful. Your notes go to a final writer, not the user.";

const REVIEWER_SYSTEM =
  "You are the Quality Reviewer specialist. Identify what a good answer to the user's latest message must include, likely mistakes, missing caveats, and safety or accuracy issues. Output concise review notes for a final writer, not the user.";

function specialist(id: string, name: string, description: string, system: string): AgentDefinition {
  return {
    id,
    name,
    description,
    role: "specialist",
    generate: async ({ apiKey, messages, signal }: SpecialistInput) => {
      const { text } = await generateText({
        model: groqModel(apiKey),
        instructions: system,
        messages,
        abortSignal: signal,
      });
      return text;
    },
  };
}

export const problemSolverAgent = specialist(
  "problem-solver",
  "Problem Solver",
  "Drafts a correct, practical solution.",
  SOLVER_SYSTEM,
);

export const qualityReviewerAgent = specialist(
  "quality-reviewer",
  "Quality Reviewer",
  "Reviews for gaps, mistakes and caveats.",
  REVIEWER_SYSTEM,
);
