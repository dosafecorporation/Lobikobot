// bot.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Vérification du webhook (nécessaire pour Meta)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "3f5G7h9JkLqR8tXzA1bC2vW4eY"; // À définir dans Meta
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

// Réception des messages
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;

    if (messages && messages[0]) {
      const from = messages[0].from; // numéro de l'utilisateur
      console.log(`📩 Message reçu de ${from}`);

      // Appel à l'API WhatsApp pour répondre
      sendReply(from, "Okay");
    }
  }

  res.sendStatus(200);
});

const axios = require('axios');

// Fonction pour envoyer la réponse
function sendReply(to, message) {
  const token = "EAFX0upka73gBPLjGJDnVs7Uj9Rt2zzM5TOGsd4ZA64YKTZACKSPtfAZCoxIEz0hbFWZCvZCTMius5B4KuLRE4cA2MbNMuKqSodjmE8jnspZCvxC1DKWDfsiVMbdsEmUk5Nk2bpwAodqtzBpylXYqscRodeuOP95F1fARZAeGY50yPGPiH5vhaewYTp7QAymjaB3sGXPAOvV3jUt9ZBKJZCmZCj5UYrF9FmFAShKignVQLiIegOfvMZD";
  const phoneNumberId = "748948674961299"; // fourni dans Meta

  axios.post(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  ).then(() => {
    console.log(`✅ Réponse "Okay" envoyée à ${to}`);
  }).catch(err => {
    console.error("❌ Erreur lors de l'envoi du message :", err.response?.data || err.message);
  });
}

// Lancer le serveur
app.listen(port, () => {
  console.log(`🚀 Serveur en écoute sur le port ${port}`);
});
