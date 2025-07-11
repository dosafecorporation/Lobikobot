const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ⚙️ Configuration Meta
const VERIFY_TOKEN = "3f5G7h9JkLqR8tXzA1bC2vW4eY";
const ACCESS_TOKEN = "EAFX0upka73gBPDUUddYBgqighFHTlrYdWB0sMoEeZCLp40vBcLSfXiczNhLnmLDVnuZCLNLBI8EqqswTOOTw4gCuKMc4GN8qnOq96jFqufVZBgiBcz2BZBDOxG3ANgLYhtXQHZBg0XyJUfdxEFhWZCOwE6KO45g2V07yHbp3UkbzkmqmWfGUlKiOBrCj04HOyHPgZDZD";
const PHONE_NUMBER_ID = "748948674961299";

// États utilisateurs en mémoire (RAM)
const usersState = {};

// Valeurs autorisées pour certains champs
const validSexes = ['Homme', 'Femme'];
const validLangues = ['Français', 'Anglais', 'Lingala', 'Swahili', 'Kikongo', 'Tshiluba'];

// Fonction qui valide format + existence date
function isValidDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const d = new Date(dateString);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateString;
}

// Webhook validation GET
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

// Réception message POST
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    const content = message?.text?.body;

    if (message && from && content) {
      const text = content.trim();
      console.log(`📨 Message reçu de ${from} : "${text}"`);

      const now = Date.now();

      // Expire la session si +1h d’inactivité
      if (usersState[from] && (now - usersState[from].lastUpdated > 1 * 60 * 60 * 1000)) {
        delete usersState[from];
        await sendReply(from, "⏳ Votre session a expiré après 1h d'inactivité. Recommençons !");
        return res.sendStatus(200);
      }

      // Si message = "annuler", stoppe la session
      if (text.toLowerCase() === "annuler") {
        delete usersState[from];
        await sendReply(from, "🛑 Votre session a été annulée. Vous pouvez recommencer à tout moment.");
        return res.sendStatus(200);
      }

      // Vérifier si patient déjà inscrit
      try {
        const resCompte = await axios.get(`https://lobiko.onrender.com/api/patients/?telephone=${from}`);
        if (resCompte.data.length > 0) {
          const patient = resCompte.data[0];

          if (usersState[from] && usersState[from].step === 'awaiting_medecin_confirmation') {
            const reponse = text.toLowerCase();
            if (reponse === 'oui') {
              await sendReply(from, "✅ Parfait. Un médecin va bientôt vous répondre, merci de patienter.");
              delete usersState[from];
            } else if (reponse === 'non') {
              await sendReply(from, "🛑 Pas de souci. N'hésitez pas à revenir quand vous le souhaitez.");
              delete usersState[from];
            } else {
              await sendReply(from, "❓ Merci de répondre par 'oui' ou 'non'. Souhaitez-vous parler à un médecin maintenant ?");
            }
            return res.sendStatus(200);
          }

          // Première fois qu'on retrouve ce patient dans usersState
          usersState[from] = {
            step: 'awaiting_medecin_confirmation',
            lastUpdated: now
          };
          await sendReply(from, `👋 Bonjour ${patient.nom}, ravi de vous revoir !\nSouhaitez-vous parler à un médecin maintenant ? (oui / non)`);
          return res.sendStatus(200);
        }
      } catch (err) {
        console.error("❌ Erreur lors de la vérification patient :", err.response?.data || err.message);
        await sendReply(from, "Désolé, une erreur est survenue lors de la vérification du compte.");
        return res.sendStatus(200);
      }

      // Début inscription
      if (!usersState[from]) {
        usersState[from] = {
          step: 'awaiting_nom',
          lastUpdated: now,
          tempData: {}
        };
        await sendReply(from, "👋 Bienvenue ! Quel est votre nom ?");
        return res.sendStatus(200);
      }

      // Processus d’inscription pas à pas
      const state = usersState[from];
      state.lastUpdated = now;

      try {
        switch (state.step) {
          case 'awaiting_nom':
            state.tempData.nom = text;
            state.step = 'awaiting_postnom';
            await sendReply(from, "Merci ! Veuillez entrer votre postnom :");
            break;

          case 'awaiting_postnom':
            state.tempData.postnom = text;
            state.step = 'awaiting_prenom';
            await sendReply(from, "Merci ! Veuillez entrer votre prénom :");
            break;

          case 'awaiting_prenom':
            state.tempData.prenom = text;
            state.step = 'awaiting_sexe';
            await sendReply(from, `Merci ! Veuillez entrer votre sexe (${validSexes.join(', ')}) :`);
            break;

          case 'awaiting_sexe':
            const sexeFormatted = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            if (!validSexes.includes(sexeFormatted)) {
              await sendReply(from, `❌ Sexe invalide. Choisissez parmi : ${validSexes.join(', ')}`);
              return res.sendStatus(200);
            }
            state.tempData.sexe = sexeFormatted;
            state.step = 'awaiting_date_naissance';
            await sendReply(from, "Merci ! Veuillez entrer votre date de naissance (YYYY-MM-DD) :");
            break;

          case 'awaiting_date_naissance':
            if (!isValidDate(text)) {
              await sendReply(from, "❌ Format ou date invalide. Utilisez le format YYYY-MM-DD, ex: 1995-08-22");
              return res.sendStatus(200);
            }
            state.tempData.date_naissance = text;
            state.step = 'awaiting_etat_civil';
            await sendReply(from, "Merci ! Veuillez entrer votre état civil :");
            break;

          case 'awaiting_etat_civil':
            state.tempData.etat_civil = text;
            state.step = 'awaiting_adresse';
            await sendReply(from, "Merci ! Veuillez entrer votre adresse :");
            break;

          case 'awaiting_adresse':
            state.tempData.adresse = text;
            state.step = 'awaiting_langue_preferee';
            await sendReply(from, `Merci ! Veuillez entrer votre langue préférée (${validLangues.join(', ')}) :`);
            break;

          case 'awaiting_langue_preferee':
            const langueFormatted = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            if (!validLangues.includes(langueFormatted)) {
              await sendReply(from, `❌ Langue invalide. Choisissez parmi : ${validLangues.join(', ')}`);
              return res.sendStatus(200);
            }
            state.tempData.langue_preferee = langueFormatted;

            // Création dans la base
            await axios.post("https://lobiko.onrender.com/api/patients/", {
              whatsapp_id: from,
              nom: state.tempData.nom,
              postnom: state.tempData.postnom,
              prenom: state.tempData.prenom,
              sexe: state.tempData.sexe,
              date_naissance: state.tempData.date_naissance,
              etat_civil: state.tempData.etat_civil,
              telephone: from,
              adresse: state.tempData.adresse,
              langue_preferee: state.tempData.langue_preferee
            });

            await sendReply(from, `✅ Merci ${state.tempData.nom}, votre compte a été créé avec succès. Bienvenue sur Lobiko 👨‍⚕️ !`);
            delete usersState[from];
            break;

          default:
            await sendReply(from, "Désolé, une erreur est survenue. On recommence.");
            delete usersState[from];
            break;
        }
      } catch (err) {
        console.error("❌ Erreur création patient :", err.response?.data || err.message);
        await sendReply(from, "Désolé, une erreur est survenue lors de la création du compte. Recommençons !");
        delete usersState[from];
      }
    }
  }

  res.sendStatus(200);
});

// Fonction d'envoi de réponse WhatsApp
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

// Lancer serveur
app.listen(port, () => {
  console.log(`🚀 Serveur bot WhatsApp en écoute sur le port ${port}`);
});
