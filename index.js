// bot.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Vérification du webhook (nécessaire pour Meta)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "3f5G7h9JkLqR8tXzA1bC2vW4eY"; // à définir dans Meta
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
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const contact = value.contacts?.[0];

      // Affichage dans la console des infos reçues
      console.log("📥 Nouveau message WhatsApp reçu !");
      console.log("🔹 De      :", message.from);
      console.log("🔹 Nom     :", contact?.profile?.name || "Inconnu");
      console.log("🔹 Type    :", message.type);
      console.log("🔹 Contenu :", message.text?.body || "(pas de texte)");
      console.log("🔹 ID Msg  :", message.id);
      console.log("🔹 Timestamp :", message.timestamp);

      // Si tu veux afficher l'objet brut entier :
      // console.dir(message, { depth: null });
    }
  }

  res.sendStatus(200);
});

// Lancer le serveur
app.listen(port, () => {
  console.log(`🚀 Serveur en écoute sur le port ${port}`);
});
