# ProspAction Eco Locaux — Guide de configuration

## Structure des fichiers

```
ProspAction_eco_locaux/
├── index.html          ← Page de connexion
├── dashboard.html      ← Recherche + prospects + contacts
├── pipeline.html       ← Kanban pipeline commercial
├── styles/
│   ├── main.css        ← Design system (tokens Stitch)
│   ├── login.css       ← Styles page login
│   ├── dashboard.css   ← Styles dashboard
│   └── pipeline.css    ← Styles kanban
└── js/
    ├── config.js       ← ⚠️ À CONFIGURER EN PREMIER
    ├── supabase-client.js  ← Client REST Supabase
    ├── auth.js         ← Authentification
    ├── api.js          ← Appels webhooks n8n
    ├── utils.js        ← Utilitaires partagés
    ├── dashboard.js    ← Logique dashboard
    └── pipeline.js     ← Logique pipeline kanban
```

---

## Étape 1 — Configurer `js/config.js`

Ouvrez `js/config.js` et remplissez :

```js
SUPABASE_URL:   'https://VOTRE_PROJECT_ID.supabase.co',
SUPABASE_ANON:  'VOTRE_ANON_KEY',
N8N_BASE:       'https://votre-instance-n8n.com',
```

Trouvez ces valeurs dans :
- **Supabase** → Settings → API → Project URL + anon key
- **n8n** → URL de votre instance auto-hébergée ou cloud

---

## Étape 2 — Supabase : créer les tables

Exécutez ce SQL dans Supabase → SQL Editor :

```sql
-- Table contacts
CREATE TABLE contacts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  activity      text,
  address       text,
  postal_code   text,
  city          text,
  phone         text,
  email         text,
  website       text,
  google_rating numeric(3,1),
  statut        text DEFAULT 'nouveau_lead',
  date_relance  date,
  created_at    timestamptz DEFAULT now(),
  user_id       uuid REFERENCES auth.users(id)
);

-- Table interactions
CREATE TABLE interactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id  uuid REFERENCES contacts(id) ON DELETE CASCADE,
  type        text,      -- 'email', 'rdv', 'note'
  content     text,
  created_at  timestamptz DEFAULT now()
);

-- Table activities (optionnel — fallback dans config.js si absente)
CREATE TABLE activities (
  id    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name  text UNIQUE NOT NULL
);

-- Peuplement activités
INSERT INTO activities (name) VALUES
  ('Restaurant'), ('Hôtel'), ('Boulangerie'), ('Salon de coiffure'),
  ('Garage automobile'), ('Cabinet médical'), ('Pharmacie'),
  ('Artisan bâtiment'), ('Plombier'), ('Électricien'), ('Menuisier');

-- RLS — chaque user voit uniquement ses contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_contacts" ON contacts
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_interactions" ON interactions
  USING (contact_id IN (SELECT id FROM contacts WHERE user_id = auth.uid()));
```

---

## Étape 3 — n8n : configurer les 4 workflows

### Webhook 1 : `/webhook/search-prospects`
**Trigger :** POST  
**Payload reçu :** `{ activity, location, user_id }`  
**Actions :**
1. Construire requête Google Maps : `{activity} {location}`
2. Scraper les résultats (nom, adresse, CP, ville, tél, site, note)
3. Dédoublonner (nom + adresse vs Supabase)
4. Insérer max 5 contacts dans `contacts` avec `status = "Nouveau lead"`
5. Retourner la liste des contacts créés

### Webhook 2 : `/webhook/enrich-contact`
**Trigger :** POST  
**Payload reçu :** `{ contact_id }`  
**Actions :**
1. Récupérer le contact (URL website) depuis Supabase
2. Fetcher le HTML du site
3. Extraire l'email par regex
4. Mettre à jour `contacts.email` dans Supabase

### Webhook 3 : `/webhook/generate-email`
**Trigger :** POST  
**Payload reçu :** `{ company, activity, location, rating, offer }`  
**Actions :**
1. Appeler OpenAI GPT-4 avec prompt personnalisé
2. Retourner `{ subject, body }` (JSON)

### Webhook 4 : `/webhook/send-email`
**Trigger :** POST  
**Payload reçu :** `{ contact_id, subject, body }`  
**Actions :**
1. Récupérer l'email du contact
2. Envoyer via SMTP / SendGrid / Brevo
3. Confirmer l'envoi

### Cron quotidien : relances automatiques
**Trigger :** Cron `0 8 * * 1-5`  
**Actions :**
1. Requête Supabase : contacts avec `date_relance <= today` et `status = "Email envoyé"`
2. Générer email de relance IA
3. Notifier l'utilisateur (email ou Slack)

---

## Étape 4 — Lancer l'application

Servez les fichiers avec un serveur HTTP local (pas d'ouverture directe en file://) :

```bash
# Python 3
python -m http.server 3000

# Node.js (npx)
npx serve . -p 3000
```

Puis ouvrir : `http://localhost:3000`

---

## Fonctionnalités implémentées

| Feature | Implémenté |
|---|---|
| Authentification Supabase | ✅ |
| Affichage utilisateur connecté | ✅ |
| Recherche activité + ville | ✅ |
| Appel webhook n8n search | ✅ |
| Affichage résultats avec sélection | ✅ |
| Enrichissement email depuis site web | ✅ |
| Génération email IA | ✅ |
| Validation & modification email | ✅ |
| Envoi email + mise à jour statut | ✅ |
| Relance J+5 jours ouvrés | ✅ |
| Pipeline Kanban 7 colonnes | ✅ |
| Drag & drop statuts | ✅ |
| Planification RDV | ✅ |
| Historique interactions | ✅ |
| Filtres statut | ✅ |
| Design system Stitch Eco Locaux | ✅ |
| Mobile-first responsive | ✅ |
