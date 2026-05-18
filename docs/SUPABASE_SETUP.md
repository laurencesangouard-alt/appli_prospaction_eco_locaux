# Supabase — Setup complet ProspAction Eco Locaux

## 1. Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → New Project
2. Nom : `prosp-action-eco-locaux`
3. Mot de passe DB : notez-le
4. Région : `eu-west-1` (Frankfurt — plus proche)
5. Récupérer dans **Settings → API** :
   - `Project URL` → `SUPABASE_URL` dans config.js
   - `anon public` key → `SUPABASE_ANON` dans config.js

---

## 2. SQL — Créer toutes les tables

Aller dans **SQL Editor** → New Query → coller et exécuter :

```sql
-- ============================================================
-- TABLES PRINCIPALES
-- ============================================================

-- Table utilisateurs étendue (en plus de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id        uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name      text,
  role      text DEFAULT 'commercial',
  email     text,
  created_at timestamptz DEFAULT now()
);

-- Table activités (pour le dropdown)
CREATE TABLE IF NOT EXISTS public.activities (
  id   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL
);

-- Table contacts (prospects)
CREATE TABLE IF NOT EXISTS public.contacts (
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
  statut        text NOT NULL DEFAULT 'nouveau_lead',
  date_relance  date,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT contacts_statut_check CHECK (statut IN (
    'nouveau_lead', 'email_envoye', 'a_relancer',
    'rdv_planifie', 'client', 'en_attente', 'perdu',
    'ne_pas_relancer'
  ))
);

-- Table interactions (historique)
CREATE TABLE IF NOT EXISTS public.interactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id  uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  type        text CHECK (type IN ('email', 'rdv', 'appel', 'note', 'relance')),
  content     text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- INDEX DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_user_id  ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status   ON public.contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_relance  ON public.contacts(date_relance);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON public.interactions(contact_id);

-- ============================================================
-- MISE À JOUR AUTOMATIQUE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PROFIL AUTOMATIQUE À L'INSCRIPTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- activities (lecture publique pour tous les authentifiés)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_select_auth" ON public.activities
  FOR SELECT TO authenticated USING (true);

-- contacts (chaque user voit uniquement les siens)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select_own" ON public.contacts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "contacts_insert_own" ON public.contacts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "contacts_update_own" ON public.contacts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "contacts_delete_own" ON public.contacts
  FOR DELETE USING (user_id = auth.uid());

-- interactions
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions_own" ON public.interactions
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "interactions_insert" ON public.interactions
  FOR INSERT WITH CHECK (
    contact_id IN (
      SELECT id FROM public.contacts WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- DONNÉES INITIALES — ACTIVITÉS
-- ============================================================
INSERT INTO public.activities (name) VALUES
  ('Restaurant'),
  ('Hôtel'),
  ('Boulangerie / Pâtisserie'),
  ('Salon de coiffure'),
  ('Garage automobile'),
  ('Cabinet médical'),
  ('Pharmacie'),
  ('Supermarché / Épicerie'),
  ('Bar / Café'),
  ('Fleuriste'),
  ('Librairie'),
  ('Agence immobilière'),
  ('Bureau d''avocats'),
  ('Cabinet comptable'),
  ('Centre sportif / Salle de sport'),
  ('École privée'),
  ('Crèche / Garderie'),
  ('Plombier'),
  ('Électricien'),
  ('Peintre en bâtiment'),
  ('Menuisier'),
  ('Couvreur'),
  ('Charpentier'),
  ('Maçon'),
  ('Installateur de panneaux solaires'),
  ('Entreprise de nettoyage'),
  ('Pressing / Laverie'),
  ('Clinique vétérinaire'),
  ('Studio de photographie'),
  ('Agence de communication')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ACCÈS SERVICE ROLE POUR N8N (bypass RLS)
-- ============================================================
-- ⚠️ Dans n8n, utiliser la clé "service_role" (Settings → API)
-- jamais la clé anon — cela permet à n8n d'insérer pour tous users
```

---

## 3. Créer un utilisateur de test

**Authentication → Users → Invite user** :
- Email : votre email
- Ou via SQL :

```sql
-- Via la fonction Supabase Auth (préféré)
-- Utiliser le formulaire Authentication > Users > Add user
-- Email : laurence.sangouard@gmail.com
-- Password : (votre choix)
```

---

## 4. Mettre à jour config.js

```js
const CONFIG = {
  SUPABASE_URL:  'https://XXXXXXXXXXXX.supabase.co',  // ← votre URL
  SUPABASE_ANON: 'eyJhbGc...',                         // ← anon key
  N8N_BASE:      'https://n8n.votre-domaine.com',
  ...
};
```

---

## 5. Vérifier le schema

```sql
-- Vérifier les tables créées
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Vérifier les politiques RLS
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public';

-- Tester un contact de démo
INSERT INTO public.contacts (name, activity, city, status, user_id)
VALUES (
  'Boulangerie Centrale',
  'Boulangerie / Pâtisserie',
  'Paris',
  'Nouveau lead',
  auth.uid()  -- ne fonctionne qu'en contexte authentifié
);
```

---

## 6. Clé service_role pour n8n

Dans **Settings → API → service_role key** (secret) :
- À utiliser **uniquement dans n8n** (jamais côté client)
- Permet à n8n d'insérer des contacts au nom de n'importe quel utilisateur
- Header n8n : `Authorization: Bearer SERVICE_ROLE_KEY`
