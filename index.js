// bot.js
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ⚙️ Configuration Meta
const VERIFY_TOKEN = "3f5G7h9JkLqR8tXzA1bC2vW4eY"; // Même que celui renseigné dans Meta
const ACCESS_TOKEN = "EAFX0upka73gBPLjGJDnVs7Uj9Rt2zzM5TOGsd4ZA64YKTZACKSPtfAZCoxIEz0hbFWZCvZCTMius5B4KuLRE4cA2MbNMuKqSodjmE8jnspZCvxC1DKWDfsiVMbdsEmUk5Nk2bpwAodqtzBpylXYqscRodeuOP95F1fARZAeGY50yPGPiH5vhaewYTp7QAymjaB3sGXPAOvV3jUt9ZBKJZCmZCj5UYrF9FmFAShKignVQLiIegOfvMZD"; // Ton token WhatsApp Cloud API
const PHONE_NUMBER_ID = "748948674961299"; // ID de ton numéro dans Meta

// ✅ Vérification Webhook (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("🟢 Webhook validé par Meta");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 📩 Réception de message (POST)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;

    if (message && from) {
      const content = message.text?.body || "(message non texte)";
      console.log(`📨 Message reçu de ${from} : "${content}"`);

      // 🔁 Envoi de réponse par défaut
      await sendReply(from, "Bonjour mon ami");
    }
  }

  res.sendStatus(200);
});

// 🚀 Fonction d'envoi de message
async function sendReply(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Réponse envoyée à ${to} : "${message}"`);
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi :", err.response?.data || err.message);
  }
}

// ▶️ Lancer le serveur
app.listen(port, () => {
  console.log(`🚀 Serveur bot WhatsApp en écoute sur le port ${port}`);
});
