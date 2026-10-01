import { Router } from "express";
import { z } from "zod";
import { loadWriting, saveWritingSubmission } from "../db/progressRepo.js";

export const writingRouter = Router();

writingRouter.get("/writing", async (_req, res) => {
  const file = await loadWriting();
  res.json(file.submissions);
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
