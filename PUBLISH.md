# Guide de Publication sur Vercel - ProspAction Eco-Locaux

Ce document explique comment mettre en ligne votre application **ProspAction** en utilisant Vercel. L'application est déjà configurée pour fonctionner sur Vercel grâce au fichier `vercel.json` et à la fonction proxy située dans `api/proxy-n8n.js`.

## Méthode 1 : Via l'interface web (Recommandée)

Cette méthode est la plus simple si votre code est sur GitHub, GitLab ou Bitbucket.

1.  **Poussez votre code** sur un dépôt (ex: GitHub).
2.  Allez sur [vercel.com](https://vercel.com) et connectez-vous.
3.  Cliquez sur **"Add New"** puis **"Project"**.
4.  Sélectionnez votre dépôt.
5.  Vercel détectera automatiquement la configuration.
    *   **Framework Preset** : Laissez sur "Other" ou "Vanilla".
    *   **Build & Development Settings** : Pas besoin de les modifier.
6.  Cliquez sur **"Deploy"**.

## Méthode 2 : Via le Terminal (CLI)

Si vous préférez utiliser la ligne de commande directement depuis votre ordinateur :

1.  **Installez l'outil Vercel** (si ce n'est pas déjà fait) :
    ```bash
    npm i -g vercel
    ```
2.  **Connectez-vous** :
    ```bash
    vercel login
    ```
3.  **Lancez le déploiement** depuis le dossier racine du projet (`ProspAction_eco_locaux`) :
    ```bash
    vercel
    ```
4.  Suivez les instructions à l'écran (répondez "Y" aux questions par défaut).
5.  Une fois terminé, vous recevrez une URL de production (ex: `prospaction-eco-locaux.vercel.app`).

## Points Importants

### 1. Proxy n8n
L'application utilise un proxy pour éviter les erreurs de sécurité (CORS) lors de l'appel à vos workflows n8n. Sur Vercel, ce proxy est automatiquement géré par la fonction dans le dossier `/api`. Vous n'avez rien à configurer de plus.

### 2. Variables de Configuration
Toutes les URL de vos webhooks n8n et vos clés Supabase sont actuellement dans `js/config.js`. 
*   **En production** : Assurez-vous que les URL dans `js/config.js` pointent vers vos webhooks "Production" sur n8n (ceux qui ne contiennent pas `/test/`).

### 3. Base de données
N'oubliez pas que votre base de données Supabase doit être accessible publiquement (ou via les clés API fournies dans `js/config.js`).

---
*Guide généré par Antigravity pour ProspAction.*
