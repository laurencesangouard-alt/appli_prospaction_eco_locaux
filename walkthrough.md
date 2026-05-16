# Walkthrough - Déploiement Vercel & Partage Public

L'application est maintenant configurée pour être hébergée sur **Vercel**, ce qui permet de partager un lien public permanent.

## Changements effectués pour Vercel

### Architecture Serverless
- **[NOUVEAU] `/api/proxy-n8n.js`** : Migration de la logique du proxy n8n vers une fonction "Serverless". Cela permet de contourner les erreurs CORS même sans serveur local.
- **[NOUVEAU] `vercel.json`** : Configuration du routage pour rediriger `/api/proxy-n8n` correctement.
- **[NOUVEAU] `package.json`** : Définition des métadonnées du projet pour Vercel.

### Frontend (`js/api.js`)
- Mise à jour de l'URL du proxy : l'application utilise désormais `/api/proxy-n8n`, compatible à la fois avec le serveur local et Vercel.

### Serveur Local (`server.js`)
- Le serveur local a été mis à jour pour supporter le nouveau chemin `/api/proxy-n8n`, permettant de continuer à développer localement sans changement.

## Comment finaliser le déploiement

Comme je ne peux pas me connecter à ton compte Vercel à ta place, voici la dernière étape à faire dans ton terminal :

1.  Ouvre un terminal dans le dossier du projet.
2.  Lance la commande suivante :
    ```bash
    npx vercel --prod
    ```
3.  Suis les instructions à l'écran :
    -   Connecte-toi (si demandé).
    -   Confirme le nom du projet (**prospaction-eco-locaux**).
    -   Une fois terminé, Vercel te donnera une URL publique (ex: `prospaction.vercel.app`).

## Vérification
- Une fois le lien Vercel obtenu, teste la recherche de prospects.
- Vérifie dans la console (F12) que les appels passent bien par `/api/proxy-n8n`.
