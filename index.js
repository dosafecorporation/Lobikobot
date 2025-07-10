const usersState = {}; // état temporaire en RAM

// 📩 Réception des messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    const content = message?.text?.body;

    if (message && from && content) {
      console.log(`📨 Message reçu de ${from} : "${content}"`);

      const now = Date.now();
      const userState = usersState[from];

      // 🔁 Si le compte est dans la mémoire et a expiré (4h = 4*60*60*1000)
      if (userState && now - userState.lastUpdated > 4 * 60 * 60 * 1000) {
        delete usersState[from];
        await sendReply(from, "⏳ Votre session a expiré après 4h d'inactivité. Recommençons !");
      }

      try {
        // Étape 1 : Vérifier si le compte WhatsApp est déjà inscrit
        const compteRes = await axios.get(`https://lobiko.onrender.com/api/whatsapp-accounts/?whatsapp_id=${from}`);
        const compteExiste = compteRes.data.length > 0;

        if (compteExiste) {
          const user = compteRes.data[0];
          await sendReply(from, `👋 Bonjour ${user.nom_utilisateur}, ravi de vous revoir !`);
          return res.sendStatus(200);
        }

        // Si le user est en cours de création (en attente du nom)
        if (usersState[from] && usersState[from].step === 'awaiting_name') {
          const nom = content.trim();

          // Appel API pour créer le compte
          await axios.post("https://lobiko.onrender.com/api/whatsapp-accounts/", {
            whatsapp_id: from,
            nom_utilisateur: nom
          });

          delete usersState[from];
          await sendReply(from, `✅ Merci ${nom}, votre compte a été créé avec succès. Bienvenue sur Lobiko 👨‍⚕️ !`);
          return res.sendStatus(200);
        }

        // Démarrage de la création si pas encore dans l'état
        usersState[from] = {
          step: 'awaiting_name',
          lastUpdated: now,
          tempData: {}
        };
        await sendReply(from, "👋 Bienvenue ! Quel est votre nom complet ?");
        return res.sendStatus(200);

      } catch (err) {
        console.error("❌ Erreur API :", err.response?.data || err.message);
        await sendReply(from, "Désolé, une erreur est survenue. Réessayez plus tard.");
      }
    }
  }

  res.sendStatus(200);
});
