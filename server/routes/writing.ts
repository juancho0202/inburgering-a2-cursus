import { Router } from "express";
import { z } from "zod";
import { loadWriting, saveWritingSubmission } from "../db/progressRepo.js";
import { buildExerciseIndex, getContent } from "../db/contentRepo.js";
import { examExercises } from "../../shared/logic/exam.js";

export const writingRouter = Router();

/** All submissions (newest first) with the task they belong to, for the history screen. */
writingRouter.get("/writing", async (_req, res) => {
  const file = await loadWriting();
  const content = await getContent();
  const index = buildExerciseIndex(content);
  const examTasks = new Map([...content.exams.values()].flatMap((e) => examExercises(e)).map((x) => [x.id, x] as const));
  res.json(
    [...file.submissions].reverse().map((s) => {
      const ex = index.byId.get(s.exerciseId)?.exercise ?? examTasks.get(s.exerciseId);
      const writing = ex?.type === "writing" ? ex : null;
      const taskType = writing?.tags.find((t) => t.startsWith("schrijven:"))?.slice("schrijven:".length) ?? "overig";
      return {
        ...s,
        task: writing
          ? { prompt: writing.prompt, scenario: writing.task.scenario, register: writing.register, type: taskType, minWords: writing.minWords, maxWords: writing.maxWords }
          : null,
      };
    }),
  );
});

const NewSubmissionSchema = z.object({ exerciseId: z.string(), text: z.string() });

writingRouter.post("/writing", async (req, res) => {
  const parsed = NewSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "De tekst kon niet worden opgeslagen." } });
    return;
  }
  const submission = {
    id: `w-${Date.now()}`,
    exerciseId: parsed.data.exerciseId,
    text: parsed.data.text,
    submittedAt: new Date().toISOString(),
    feedback: null,
  };
  await saveWritingSubmission(submission);
  res.json(submission);
});
