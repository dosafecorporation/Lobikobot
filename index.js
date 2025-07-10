// bot.js
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ⚙️ Configuration Meta
const VERIFY_TOKEN = "3f5G7h9JkLqR8tXzA1bC2vW4eY"; // Même que celui renseigné dans Meta
const ACCESS_TOKEN = "EAFX0upka73gBPDUUddYBgqighFHTlrYdWB0sMoEeZCLp40vBcLSfXiczNhLnmLDVnuZCLNLBI8EqqswTOOTw4gCuKMc4GN8qnOq96jFqufVZBgiBcz2BZBDOxG3ANgLYhtXQHZBg0XyJUfdxEFhWZCOwE6KO45g2V07yHbp3UkbzkmqmWfGUlKiOBrCj04HOyHPgZDZD"; // Ton token WhatsApp Cloud API
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

      try {
        // Étape 1 : Vérifier si le compte WhatsApp existe
        const compteRes = await axios.get(`https://lobiko.onrender.com/api/whatsapp-accounts/?whatsapp_id=${from}`);
        const compteExiste = compteRes.data.length > 0;

        if (!compteExiste) {
            await sendReply(from, "Bienvenue ! Quel est votre nom complet ?");
            // ici tu pourrais garder ce numéro dans un stockage temporaire pour attendre la réponse
        } else {
            const user = compteRes.data[0];
            await sendReply(from, `Ravi de vous revoir, ${user.nom_utilisateur} !`);
            // Poursuis avec la logique : créer patient, poser les questions, etc.
        }

        // (facultatif) Tu peux aussi ici créer un Message dans Django :
        await axios.post("https://lobiko.onrender.com/api//messages/", {
            session: 12, // (à récupérer dynamiquement selon la logique de session)
            emetteur: "patient",
            contenu: content
        });

        } catch (error) {
        console.error("❌ Erreur lors de la communication avec l'API :", error.response?.data || error.message);
        await sendReply(from, "Désolé, une erreur est survenue.");
        }

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
