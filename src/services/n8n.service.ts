import { env } from "../config/env.js";

type LeadRoutePayload = {
  contact: {
    id: string;
    fullName: string;
    phoneNumber: string;
    category: string | null;
    leadStage: string | null;
  };
  consultant: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  campaign: {
    id: string;
    name: string;
    category: string;
    templateName: string;
  } | null;
  incomingMessage: {
    id: string;
    text: string;
    timestamp: string;
  };
};

export async function forwardLeadToN8n(payload: LeadRoutePayload): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  if (!env.N8N_WEBHOOK_URL) {
    return { success: false, error: "N8N webhook nao configurado" };
  }

  try {
    const response = await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.N8N_WEBHOOK_AUTH_TOKEN ? { Authorization: `Bearer ${env.N8N_WEBHOOK_AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, statusCode: response.status, error: text || "Erro de resposta do n8n" };
    }

    return { success: true, statusCode: response.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha desconhecida no envio ao n8n"
    };
  }
}
