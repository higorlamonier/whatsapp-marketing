const statsEl = document.getElementById("stats");
const insightsRatesEl = document.getElementById("insightsRates");
const timelineEl = document.getElementById("timeline");
const contactsListEl = document.getElementById("contactsList");
const campaignsListEl = document.getElementById("campaignsList");
const n8nStatusEl = document.getElementById("n8nStatus");

const importForm = document.getElementById("importForm");
const campaignForm = document.getElementById("campaignForm");
const sendForm = document.getElementById("sendForm");

const importNotice = document.getElementById("importNotice");
const campaignNotice = document.getElementById("campaignNotice");
const sendNotice = document.getElementById("sendNotice");

const contactsJson = document.getElementById("contactsJson");
const campaignName = document.getElementById("campaignName");
const campaignCategory = document.getElementById("campaignCategory");
const templateName = document.getElementById("templateName");
const headerImageUrl = document.getElementById("headerImageUrl");
const ctaUrl = document.getElementById("ctaUrl");
const messagePreview = document.getElementById("messagePreview");
const sendCampaignId = document.getElementById("sendCampaignId");
const sendLimit = document.getElementById("sendLimit");
const prepareBtn = document.getElementById("prepareBtn");

function showNotice(el, text, isError = false) {
  el.textContent = text;
  el.className = `notice ${isError ? "error" : "ok"}`;
}

function statCard(label, value) {
  return `<article class="stat"><small>${label}</small><strong>${value}</strong></article>`;
}

function metricCard(label, value, suffix = "%") {
  return `<article class="metric"><span>${label}</span><strong>${Number(value).toFixed(2)}${suffix}</strong></article>`;
}

async function loadStats() {
  const overview = await fetch("/api/dashboard/overview").then((r) => r.json());
  statsEl.innerHTML = [
    statCard("Total Contatos", overview.totalContacts),
    statCard("Descadastrados", overview.optedOut),
    statCard("Leads", overview.leads),
    statCard("Campanhas Ativas", overview.activeCampaigns),
    statCard("Mensagens Enviadas", overview.sentMessages),
    statCard("Entregues", overview.deliveredMessages),
    statCard("Lidas", overview.readMessages),
    statCard("Falhas", overview.failedMessages)
  ].join("");
}

async function loadInsights() {
  const insights = await fetch("/api/dashboard/insights").then((r) => r.json());
  const rates = insights.rates;

  insightsRatesEl.innerHTML = [
    metricCard("Taxa de sucesso", rates.successRate),
    metricCard("Taxa de entrega", rates.deliveryRate),
    metricCard("Taxa de leitura", rates.readRate),
    metricCard("Taxa de retorno", rates.replyRate),
    metricCard("Conversao em lead", rates.leadConversionRate)
  ].join("");

  n8nStatusEl.textContent = insights.integrations.n8nEnabled ? "N8N: conectado" : "N8N: nao configurado";
}

async function loadTimeline() {
  const rows = await fetch("/api/dashboard/timeline?days=7").then((r) => r.json());
  const maxSent = Math.max(1, ...rows.map((row) => row.sent));

  timelineEl.innerHTML = rows.map((row) => {
    const ratio = Math.round((row.sent / maxSent) * 100);
    return `
      <div class="timeline-row">
        <div>${row.date.slice(5)}</div>
        <div>
          <div class="timeline-bar"><div class="timeline-fill" style="width:${ratio}%"></div></div>
          <small>enviadas: ${row.sent} | retorno: ${row.replies} | falhas: ${row.failed}</small>
        </div>
      </div>
    `;
  }).join("");
}

async function loadContacts() {
  const contacts = await fetch("/api/contacts").then((r) => r.json());
  contactsListEl.innerHTML = contacts.slice(0, 15).map((contact) => {
    return `<div class="list-item"><strong>${contact.fullName}</strong><br>${contact.phoneNumber}<br><span class="badge">${contact.category ?? "sem categoria"}</span> <span class="badge">lead: ${contact.isLead ? "sim" : "nao"}</span></div>`;
  }).join("");
}

async function loadCampaigns() {
  const campaigns = await fetch("/api/campaigns").then((r) => r.json());
  campaignsListEl.innerHTML = campaigns.slice(0, 15).map((campaign) => {
    return `<div class="list-item"><strong>${campaign.name}</strong><br>ID: ${campaign.id}<br><span class="badge">${campaign.status}</span> <span class="badge">cat: ${campaign.category}</span><br><small>sucesso: ${campaign.metrics.successRate}% | retorno: ${campaign.metrics.replyRate}%</small></div>`;
  }).join("");
}

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const contacts = JSON.parse(contactsJson.value);
    const response = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts })
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(json.error));
    }

    showNotice(importNotice, `Importado com sucesso. Novos: ${json.created}, duplicados: ${json.duplicates}`);
    await Promise.all([loadContacts(), loadStats(), loadInsights()]);
  } catch (error) {
    showNotice(importNotice, error.message || "Erro ao importar", true);
  }
});

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaignName.value,
        category: campaignCategory.value,
        templateName: templateName.value,
        headerImageUrl: headerImageUrl.value || undefined,
        callToActionUrl: ctaUrl.value || undefined,
        messagePreview: messagePreview.value || undefined
      })
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(json.error));
    }

    showNotice(campaignNotice, `Campanha criada. ID: ${json.id}`);
    sendCampaignId.value = json.id;
    await loadCampaigns();
  } catch (error) {
    showNotice(campaignNotice, error.message || "Erro ao criar campanha", true);
  }
});

prepareBtn.addEventListener("click", async () => {
  try {
    const response = await fetch(`/api/campaigns/${sendCampaignId.value}/prepare`, {
      method: "POST"
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(json.error));
    }

    showNotice(sendNotice, `Lista preparada. Destinatarios adicionados: ${json.recipientsCreated}`);
    await loadCampaigns();
  } catch (error) {
    showNotice(sendNotice, error.message || "Erro ao preparar", true);
  }
});

sendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const response = await fetch(`/api/campaigns/${sendCampaignId.value}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: Number(sendLimit.value || 100) })
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(json.error));
    }

    showNotice(sendNotice, `Lote enviado. Sucesso: ${json.sent}, falhas: ${json.failed}, pendentes: ${json.remaining}`);
    await Promise.all([loadCampaigns(), loadStats(), loadInsights(), loadTimeline()]);
  } catch (error) {
    showNotice(sendNotice, error.message || "Erro no disparo", true);
  }
});

await Promise.all([loadStats(), loadInsights(), loadTimeline(), loadContacts(), loadCampaigns()]);
