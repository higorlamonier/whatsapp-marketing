const statsEl = document.getElementById("stats");
const contactsListEl = document.getElementById("contactsList");
const campaignsListEl = document.getElementById("campaignsList");

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
const sendCampaignId = document.getElementById("sendCampaignId");
const sendLimit = document.getElementById("sendLimit");
const prepareBtn = document.getElementById("prepareBtn");

function showNotice(el, text, isError = false) {
  el.textContent = text;
  el.className = `notice ${isError ? "error" : "ok"}`;
}

function statCard(label, value) {
  return `<article class="card"><small>${label}</small><strong>${value}</strong></article>`;
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

async function loadContacts() {
  const contacts = await fetch("/api/contacts").then((r) => r.json());
  contactsListEl.innerHTML = contacts.slice(0, 15).map((contact) => {
    return `<div class="list-item"><strong>${contact.fullName}</strong><br>${contact.phoneNumber}<br><span class="badge">${contact.category ?? "sem categoria"}</span></div>`;
  }).join("");
}

async function loadCampaigns() {
  const campaigns = await fetch("/api/campaigns").then((r) => r.json());
  campaignsListEl.innerHTML = campaigns.slice(0, 15).map((campaign) => {
    return `<div class="list-item"><strong>${campaign.name}</strong><br>ID: ${campaign.id}<br><span class="badge">${campaign.status}</span> <span class="badge">${campaign.category}</span></div>`;
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
    await Promise.all([loadContacts(), loadStats()]);
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
        templateName: templateName.value
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
    await Promise.all([loadCampaigns(), loadStats()]);
  } catch (error) {
    showNotice(sendNotice, error.message || "Erro no disparo", true);
  }
});

await Promise.all([loadStats(), loadContacts(), loadCampaigns()]);
