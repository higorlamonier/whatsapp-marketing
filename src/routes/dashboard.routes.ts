import { Router } from "express";
import { ContactStatus, RecipientStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/overview", async (_req, res) => {
  const [
    totalContacts,
    optedOut,
    leads,
    activeCampaigns,
    sentMessages,
    deliveredMessages,
    readMessages,
    failedMessages
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { status: ContactStatus.DO_NOT_CONTACT } }),
    prisma.contact.count({ where: { isLead: true } }),
    prisma.campaign.count({ where: { status: { in: ["PROCESSING", "SCHEDULED"] } } }),
    prisma.campaignRecipient.count({ where: { status: RecipientStatus.SENT } }),
    prisma.campaignRecipient.count({ where: { status: RecipientStatus.DELIVERED } }),
    prisma.campaignRecipient.count({ where: { status: RecipientStatus.READ } }),
    prisma.campaignRecipient.count({ where: { status: RecipientStatus.FAILED } })
  ]);

  res.json({
    totalContacts,
    optedOut,
    leads,
    activeCampaigns,
    sentMessages,
    deliveredMessages,
    readMessages,
    failedMessages
  });
});

