import { Router } from "express";
import { ContactStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { normalizePhone } from "../utils/phone.js";

const contactSchema = z.object({
  fullName: z.string().min(2),
  phoneNumber: z.string().min(8),
  email: z.string().email().optional(),
  source: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  assignedToId: z.string().optional()
});

const importSchema = z.object({
  contacts: z.array(contactSchema).min(1)
});

export const contactsRouter = Router();

contactsRouter.get("/", async (req, res) => {
  const category = req.query.category as string | undefined;
  const status = req.query.status as ContactStatus | undefined;

  const contacts = await prisma.contact.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(status ? { status } : {})
    },
    include: {
      assignedTo: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json(contacts);
});

contactsRouter.post("/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let created = 0;
  let duplicates = 0;

  for (const item of parsed.data.contacts) {
    const phone = normalizePhone(item.phoneNumber);
    if (!phone) {
      continue;
    }

    const existing = await prisma.contact.findUnique({
      where: { phoneNumber: phone }
    });

    if (existing) {
      duplicates += 1;
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          isDuplicate: true,
          duplicateGroupKey: phone
        }
      });
      continue;
    }

    await prisma.contact.create({
      data: {
        ...item,
        phoneNumber: phone,
        duplicateGroupKey: phone
      }
    });

    created += 1;
  }

  return res.status(201).json({ created, duplicates });
});

contactsRouter.patch("/:id/optout", async (req, res) => {
  const id = req.params.id;

  const updated = await prisma.contact.update({
    where: { id },
    data: {
      status: ContactStatus.DO_NOT_CONTACT,
      optedOutAt: new Date()
    }
  });

  res.json(updated);
});

contactsRouter.patch("/:id/lead", async (req, res) => {
  const id = req.params.id;

  const schema = z.object({
    isLead: z.boolean(),
    leadStage: z.string().optional(),
    leadScore: z.number().int().min(0).max(100).optional(),
    assignedToId: z.string().optional(),
    changedBy: z.string().default("system")
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) {
    return res.status(404).json({ error: "Contato nao encontrado" });
  }

  const updated = await prisma.contact.update({
    where: { id },
    data: {
      isLead: parsed.data.isLead,
      leadStage: parsed.data.leadStage,
      leadScore: parsed.data.leadScore,
      assignedToId: parsed.data.assignedToId,
      sentToConsultant: Boolean(parsed.data.assignedToId)
    }
  });

  if (parsed.data.assignedToId) {
    await prisma.leadOwnershipHistory.create({
      data: {
        contactId: id,
        consultantId: parsed.data.assignedToId,
        changedBy: parsed.data.changedBy,
        previousOwner: contact.assignedToId ?? null
      }
    });
  }

  res.json(updated);
});
