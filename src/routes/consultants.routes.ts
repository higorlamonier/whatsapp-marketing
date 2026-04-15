import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export const consultantsRouter = Router();

consultantsRouter.get("/", async (_req, res) => {
  const consultants = await prisma.consultant.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json(consultants);
});

consultantsRouter.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const consultant = await prisma.consultant.create({
    data: parsed.data
  });

  res.status(201).json(consultant);
});
