import { Router } from "express";
import { z } from "zod";
import { ContactStatus, CampaignStatus, RecipientStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { sendTemplateMessage } from "../services/whatsapp.service.js";

const createCampaignSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  templateName: z.string().min(2),
  templateLanguage: z.string().default("pt_BR")
});

export const campaignsRouter = Router();

campaignsRouter.get("/", async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    include: {
      _count: {
        select: { recipients: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json(campaigns);
});

campaignsRouter.post("/", async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await prisma.campaign.create({
    data: parsed.data
  });

  res.status(201).json(campaign);
});

campaignsRouter.post("/:id/prepare", async (req, res) => {
  const id = req.params.id;
  const campaign = await prisma.campaign.findUnique({ where: { id } });

  if (!campaign) {
    return res.status(404).json({ error: "Campanha nao encontrada" });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      category: campaign.category,
      status: ContactStatus.ACTIVE,
      optedOutAt: null
    }
  });

  const existing = await prisma.campaignRecipient.findMany({
    where: { campaignId: id },
    select: { contactId: true }
  });

  const existingSet = new Set(existing.map((item) => item.contactId));
  const toCreate = contacts
    .filter((contact) => !existingSet.has(contact.id))
    .map((contact) => ({
      campaignId: id,
      contactId: contact.id
    }));

  if (toCreate.length > 0) {
    await prisma.campaignRecipient.createMany({
      data: toCreate
    });
  }

  await prisma.campaign.update({
    where: { id },
    data: {
      status: CampaignStatus.SCHEDULED
    }
  });

  res.json({ recipientsCreated: toCreate.length });
});

campaignsRouter.post("/:id/send", async (req, res) => {
  const id = req.params.id;
  const batchSchema = z.object({
    limit: z.number().int().positive().max(500).default(100)
  });
  const parsed = batchSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return res.status(404).json({ error: "Campanha nao encontrada" });
  }

  await prisma.campaign.update({
    where: { id },
    data: {
      status: CampaignStatus.PROCESSING,
      startedAt: campaign.startedAt ?? new Date()
    }
  });

  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      campaignId: id,
      status: RecipientStatus.PENDING,
      contact: {
        status: ContactStatus.ACTIVE,
        optedOutAt: null
      }
    },
    include: { contact: true },
    take: parsed.data.limit,
    orderBy: {
      createdAt: "asc"
    }
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const result = await sendTemplateMessage({
        to: recipient.contact.phoneNumber,
        templateName: campaign.templateName,
        languageCode: campaign.templateLanguage
      });

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: RecipientStatus.SENT,
          sentAt: new Date(),
          whatsappMessageId: result.messageId
        }
      });

      await prisma.contact.update({
        where: { id: recipient.contactId },
        data: {
          lastMessageAt: new Date()
        }
      });

      await prisma.messageLog.create({
        data: {
          contactId: recipient.contactId,
          campaignRecipientId: recipient.id,
          direction: "OUTBOUND",
          eventType: "TEMPLATE_SENT",
          payload: { messageId: result.messageId }
        }
      });

      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: RecipientStatus.FAILED,
          errorReason: message
        }
      });

      await prisma.messageLog.create({
        data: {
          contactId: recipient.contactId,
          campaignRecipientId: recipient.id,
          direction: "SYSTEM",
          eventType: "SEND_FAILED",
          payload: { error: message }
        }
      });

      failed += 1;
    }
  }

  const pending = await prisma.campaignRecipient.count({
    where: {
      campaignId: id,
      status: RecipientStatus.PENDING
    }
  });

  if (pending === 0) {
    await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.FINISHED,
        finishedAt: new Date()
      }
    });
  }

  res.json({ sent, failed, remaining: pending });
});
