import { Router } from "express";
import { ContactStatus, RecipientStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

export const dashboardRouter = Router();

function isSentLikeStatus(status: RecipientStatus): boolean {
  return status === RecipientStatus.SENT || status === RecipientStatus.DELIVERED || status === RecipientStatus.READ;
}

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

dashboardRouter.get("/insights", async (_req, res) => {
  const [campaigns, recipients, totalContacts, totalLeads] = await Promise.all([
    prisma.campaign.findMany({
      include: { recipients: true },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.campaignRecipient.findMany({
      where: {
        sentAt: { not: null }
      }
    }),
    prisma.contact.count(),
    prisma.contact.count({ where: { isLead: true } })
  ]);

  const sentBase = recipients.filter((item) => isSentLikeStatus(item.status)).length;
  const delivered = recipients.filter((item) => item.status === RecipientStatus.DELIVERED).length;
  const read = recipients.filter((item) => item.status === RecipientStatus.READ).length;
  const failed = recipients.filter((item) => item.status === RecipientStatus.FAILED).length;
  const replied = recipients.filter((item) => item.repliedAt).length;

  const rates = {
    successRate: sentBase > 0 ? Number((((sentBase - failed) / sentBase) * 100).toFixed(2)) : 0,
    deliveryRate: sentBase > 0 ? Number(((delivered / sentBase) * 100).toFixed(2)) : 0,
    readRate: delivered > 0 ? Number(((read / delivered) * 100).toFixed(2)) : 0,
    replyRate: sentBase > 0 ? Number(((replied / sentBase) * 100).toFixed(2)) : 0,
    leadConversionRate: totalContacts > 0 ? Number(((totalLeads / totalContacts) * 100).toFixed(2)) : 0
  };

  const recentCampaigns = campaigns.map((campaign) => {
    const total = campaign.recipients.length;
    const replies = campaign.recipients.filter((item) => item.repliedAt).length;
    const done = campaign.recipients.filter((item) => isSentLikeStatus(item.status)).length;
    const errors = campaign.recipients.filter((item) => item.status === RecipientStatus.FAILED).length;
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      category: campaign.category,
      createdAt: campaign.createdAt,
      metrics: {
        totalRecipients: total,
        completionRate: total > 0 ? Number(((done / total) * 100).toFixed(2)) : 0,
        failRate: done > 0 ? Number(((errors / done) * 100).toFixed(2)) : 0,
        replyRate: done > 0 ? Number(((replies / done) * 100).toFixed(2)) : 0
      }
    };
  });

  res.json({
    rates,
    recentCampaigns,
    integrations: {
      n8nEnabled: Boolean(env.N8N_WEBHOOK_URL)
    }
  });
});

dashboardRouter.get("/timeline", async (req, res) => {
  const daysRaw = Number(req.query.days ?? 7);
  const days = Number.isFinite(daysRaw) ? Math.max(3, Math.min(30, daysRaw)) : 7;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      OR: [{ sentAt: { gte: startDate } }, { repliedAt: { gte: startDate } }]
    },
    select: {
      sentAt: true,
      repliedAt: true,
      status: true
    }
  });

  const bucket = new Map<
    string,
    { date: string; sent: number; delivered: number; read: number; failed: number; replies: number }
  >();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    bucket.set(key, { date: key, sent: 0, delivered: 0, read: 0, failed: 0, replies: 0 });
  }

  for (const item of recipients) {
    if (item.sentAt) {
      const key = item.sentAt.toISOString().slice(0, 10);
      const daily = bucket.get(key);
      if (daily) {
        daily.sent += 1;
        if (item.status === RecipientStatus.DELIVERED) {
          daily.delivered += 1;
        }
        if (item.status === RecipientStatus.READ) {
          daily.read += 1;
        }
        if (item.status === RecipientStatus.FAILED) {
          daily.failed += 1;
        }
      }
    }
    if (item.repliedAt) {
      const key = item.repliedAt.toISOString().slice(0, 10);
      const daily = bucket.get(key);
      if (daily) {
        daily.replies += 1;
      }
    }
  }

  res.json(Array.from(bucket.values()));
});
