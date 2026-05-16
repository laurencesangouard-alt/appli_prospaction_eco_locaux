# n8n — 4 Workflows ProspAction Eco Locaux

## Pré-requis
- n8n installé (cloud ou auto-hébergé)
- Clé OpenAI (GPT-4o)
- Clé Supabase **service_role**
- SMTP ou Brevo/SendGrid pour l'envoi email

---

## Workflow 1 — `search-prospects`

**Trigger :** Webhook POST `/webhook/search-prospects`

### Payload entrant
```json
{
  "activity": "Boulangerie",
  "location": "Lyon",
  "user_id": "uuid-de-l-utilisateur"
}
```

### Nœuds à créer

```
[Webhook] → [Code: Build Query] → [HTTP: Google Maps API]
  → [Code: Parse Results] → [Supabase: Check Duplicates]
  → [Code: Filter New] → [Supabase: Insert Contacts]
  → [Respond to Webhook]
```

---

### Nœud 1 — Webhook
- **Method :** POST
- **Path :** `search-prospects`
- **Respond :** Using Respond to Webhook node

---

### Nœud 2 — Code (Build Query)
```js
// Construire la requête Google Maps Places
const { activity, location, user_id } = $input.first().json.body;

return [{
  json: {
    query: `${activity} ${location}`,
    activity,
    location,
    user_id,
  }
}];
```

---

### Nœud 3 — HTTP Request (Google Maps Places API)
- **Method :** GET
- **URL :** `https://maps.googleapis.com/maps/api/place/textsearch/json`
- **Query params :**
  - `query` : `{{ $json.query }}`
  - `language` : `fr`
  - `key` : `VOTRE_GOOGLE_MAPS_API_KEY`

> Alternative sans API payante : utiliser **SerpAPI** avec `engine=google_maps`

---

### Nœud 4 — Code (Parse + Limit 5)
```js
const results  = $input.first().json.results || [];
const activity = $('Build Query').first().json.activity;
const location = $('Build Query').first().json.location;
const user_id  = $('Build Query').first().json.user_id;

// Garder max 5 résultats
const limited = results.slice(0, 5);

return limited.map(place => ({
  json: {
    name:          place.name,
    activity,
    address:       place.formatted_address?.split(',')[0] || '',
    postal_code:   place.formatted_address?.match(/\d{5}/)?.[0] || '',
    city:          location,
    phone:         place.formatted_phone_number || '',
    website:       place.website || '',
    google_rating: place.rating || null,
    status:        'Nouveau lead',
    user_id,
    _place_id:     place.place_id,
  }
}));
```

---

### Nœud 5 — HTTP Request (Supabase: Check duplicates)
- **Method :** GET
- **URL :** `{{ $env.SUPABASE_URL }}/rest/v1/contacts`
- **Headers :**
  - `apikey` : `{{ $env.SUPABASE_SERVICE_KEY }}`
  - `Authorization` : `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
- **Query params :**
  - `user_id` : `eq.{{ $json.user_id }}`
  - `name`    : `eq.{{ $json.name }}`
  - `city`    : `eq.{{ $json.city }}`
  - `select`  : `id,name,city`

Exécuter en mode **"For each item"** (boucle sur les résultats)

---

### Nœud 6 — Code (Filter déjà existants)
```js
// Garder uniquement les nouveaux (pas de doublon trouvé)
const items = $input.all();
return items.filter(item => {
  const existing = item.json; // résultat Supabase (tableau vide = nouveau)
  return Array.isArray(existing) && existing.length === 0;
});
```

---

### Nœud 7 — HTTP Request (Supabase: Insert contacts)
- **Method :** POST
- **URL :** `{{ $env.SUPABASE_URL }}/rest/v1/contacts`
- **Headers :**
  - `apikey` : `{{ $env.SUPABASE_SERVICE_KEY }}`
  - `Authorization` : `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
  - `Content-Type` : `application/json`
  - `Prefer` : `return=representation`
- **Body :**
```json
{
  "name":          "{{ $json.name }}",
  "activity":      "{{ $json.activity }}",
  "address":       "{{ $json.address }}",
  "postal_code":   "{{ $json.postal_code }}",
  "city":          "{{ $json.city }}",
  "phone":         "{{ $json.phone }}",
  "website":       "{{ $json.website }}",
  "google_rating": "{{ $json.google_rating }}",
  "status":        "Nouveau lead",
  "user_id":       "{{ $json.user_id }}"
}
```

---

### Nœud 8 — Respond to Webhook
- **Response Code :** 200
- **Body :**
```js
// Agréger tous les contacts insérés
const contacts = $input.all().map(i => i.json);
return { contacts };
```

---

## Workflow 2 — `enrich-contact`

**Trigger :** Webhook POST `/webhook/enrich-contact`

### Payload entrant
```json
{ "contact_id": "uuid-du-contact" }
```

### Nœuds

```
[Webhook] → [Supabase: Get Contact] → [HTTP: Fetch Website]
  → [Code: Extract Email] → [Supabase: Update Email]
  → [Respond to Webhook]
```

---

### Nœud 2 — HTTP (Supabase: Get contact)
- **URL :** `{{ $env.SUPABASE_URL }}/rest/v1/contacts?id=eq.{{ $json.body.contact_id }}&select=id,name,website`
- **Headers :** service_role

---

### Nœud 3 — HTTP (Fetch website HTML)
- **URL :** `{{ $json[0].website }}`
- **Method :** GET
- **Options :** Ignore SSL errors = true, Timeout = 10s

---

### Nœud 4 — Code (Extract email)
```js
const html = $input.first().json;
const text = typeof html === 'string' ? html : JSON.stringify(html);

// Regex extraction email
const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const matches = text.match(emailRegex) || [];

// Filtrer les emails génériques (no-reply, etc.)
const filtered = matches.filter(e =>
  !e.includes('noreply') &&
  !e.includes('no-reply') &&
  !e.includes('example.com') &&
  !e.includes('sentry') &&
  !e.includes('wix') &&
  !e.includes('wordpress')
);

const email = filtered[0] || null;
const contact_id = $('Get Contact').first().json[0].id;

return [{ json: { email, contact_id } }];
```

---

### Nœud 5 — HTTP (Supabase: Update contact)
- **Method :** PATCH
- **URL :** `{{ $env.SUPABASE_URL }}/rest/v1/contacts?id=eq.{{ $json.contact_id }}`
- **Body :** `{ "email": "{{ $json.email }}" }`
- **Condition :** Exécuter uniquement si `$json.email != null`

---

### Nœud 6 — Respond to Webhook
```json
{ "success": true, "email": "{{ $json.email }}" }
```

---

## Workflow 3 — `generate-email`

**Trigger :** Webhook POST `/webhook/generate-email`

### Payload entrant
```json
{
  "company":  "Boulangerie Dupont",
  "activity": "Boulangerie",
  "location": "Lyon",
  "rating":   "4.5",
  "offer":    "Eco-Locaux efficacité énergétique"
}
```

### Nœuds

```
[Webhook] → [Code: Build Prompt] → [OpenAI: GPT-4o]
  → [Code: Parse Response] → [Respond to Webhook]
```

---

### Nœud 2 — Code (Build prompt)
```js
const { company, activity, location, rating, offer } = $input.first().json.body;

const prompt = `Tu es un expert en prospection commerciale B2B pour ${offer}.

Rédige un email commercial court et personnalisé pour :
- Entreprise : ${company}
- Activité : ${activity}
- Ville : ${location}
- Note Google : ${rating}/5

L'email doit :
1. Commencer par une accroche personnalisée liée à leur activité
2. Présenter brièvement la valeur de ${offer} pour leur secteur
3. Mentionner un bénéfice concret (réduction facture énergie, conformité RE2020...)
4. Terminer par un appel à l'action clair (appel de 15 min)
5. Faire max 150 mots, ton professionnel et chaleureux

Réponds UNIQUEMENT en JSON valide :
{
  "subject": "Objet de l'email",
  "body": "Corps complet de l'email"
}`;

return [{ json: { prompt } }];
```

---

### Nœud 3 — OpenAI (Chat)
- **Model :** gpt-4o
- **Messages :**
  - System : `Tu es un expert en prospection commerciale énergétique. Réponds toujours en JSON valide.`
  - User : `{{ $json.prompt }}`
- **Response Format :** JSON object
- **Temperature :** 0.7
- **Max tokens :** 600

---

### Nœud 4 — Code (Parse response)
```js
const content = $input.first().json.message.content;
let parsed;
try {
  // Nettoyer les balises markdown si présentes
  const clean = content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  parsed = JSON.parse(clean);
} catch {
  parsed = { subject: 'Proposition Eco Locaux', body: content };
}

return [{ json: parsed }];
```

---

### Nœud 5 — Respond to Webhook
```json
{
  "subject": "{{ $json.subject }}",
  "body":    "{{ $json.body }}"
}
```

---

## Workflow 4 — `send-email`

**Trigger :** Webhook POST `/webhook/send-email`

### Payload entrant
```json
{
  "contact_id": "uuid",
  "subject":    "Objet de l'email",
  "body":       "Corps de l'email..."
}
```

### Nœuds

```
[Webhook] → [Supabase: Get Contact] → [Send Email (SMTP)]
  → [Supabase: Update Status] → [Supabase: Insert Interaction]
  → [Respond to Webhook]
```

---

### Nœud 2 — HTTP (Get contact email)
- **URL :** `{{ $env.SUPABASE_URL }}/rest/v1/contacts?id=eq.{{ $json.body.contact_id }}&select=id,name,email`

---

### Nœud 3 — Send Email (SMTP ou Brevo)
**Option A — SMTP natif n8n :**
- **To :** `{{ $json[0].email }}`
- **Subject :** `{{ $('Webhook').first().json.body.subject }}`
- **Text/HTML :** `{{ $('Webhook').first().json.body.body }}`
- **From :** `prospection@ecolocaux.fr`

**Option B — Brevo (SendinBlue) via HTTP :**
```json
POST https://api.brevo.com/v3/smtp/email
{
  "sender": { "name": "Eco Locaux", "email": "contact@ecolocaux.fr" },
  "to": [{ "email": "{{ $json[0].email }}", "name": "{{ $json[0].name }}" }],
  "subject": "{{ $('Webhook').first().json.body.subject }}",
  "htmlContent": "<p>{{ $('Webhook').first().json.body.body }}</p>"
}
```

---

### Nœud 4 — HTTP (Update status Supabase)
- **PATCH** `/rest/v1/contacts?id=eq.{{ $input.params.contact_id }}`
- Body : `{ "status": "Email envoyé", "date_relance": "{{ new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10) }}" }`

---

### Nœud 5 — HTTP (Insert interaction)
- **POST** `/rest/v1/interactions`
- Body :
```json
{
  "contact_id": "{{ $('Webhook').first().json.body.contact_id }}",
  "type":       "email",
  "content":    "{{ $('Webhook').first().json.body.subject }}"
}
```

---

### Nœud 6 — Respond to Webhook
```json
{ "success": true, "message": "Email envoyé" }
```

---

## Workflow 5 — Cron relances automatiques

**Trigger :** Schedule (Cron) — `0 8 * * 1-5` (lun-ven à 8h)

### Nœuds

```
[Schedule] → [Supabase: Get contacts à relancer]
  → [OpenAI: Generate relance] → [Send Email relance]
  → [Supabase: Update status "À relancer"]
```

---

### Nœud 2 — HTTP (Get contacts à relancer)
```
GET /rest/v1/contacts
  ?status=eq.Email envoyé
  &date_relance=lte.{{ new Date().toISOString().slice(0,10) }}
  &select=id,name,email,activity,city,user_id
```

---

### Nœud 3 — OpenAI (Email de relance)
```js
// Pour chaque contact
const prompt = `Écris un court email de relance (80 mots max) pour ${$json.name}, 
${$json.activity} à ${$json.city}. 
Rappelle notre proposition Eco Locaux éco-efficacité, 
demande si notre email précédent a été reçu, 
reste chaleureux et professionnel.
JSON: { "subject": "...", "body": "..." }`;
```

---

## Variables d'environnement n8n

Dans **Settings → Environment Variables** :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `service_role_key` |
| `OPENAI_API_KEY` | `sk-...` |
| `GOOGLE_MAPS_KEY` | `AIza...` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_USER` | `votre@email.com` |
| `SMTP_PASS` | `mot de passe app` |

---

## Test rapide des webhooks

```bash
# Test search-prospects
curl -X POST https://votre-n8n.com/webhook/search-prospects \
  -H "Content-Type: application/json" \
  -d '{"activity":"Restaurant","location":"Paris","user_id":"test-uuid"}'

# Test generate-email
curl -X POST https://votre-n8n.com/webhook/generate-email \
  -H "Content-Type: application/json" \
  -d '{"company":"Le Petit Bistro","activity":"Restaurant","location":"Paris","rating":"4.3","offer":"Eco-Locaux efficacité énergétique"}'
```
