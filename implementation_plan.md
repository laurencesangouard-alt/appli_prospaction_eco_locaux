# Implementation Plan - Connect AI Email Button to n8n Workflow

Connect the "Valider & Envoyer" button in the AI Email modal to the specified n8n webhook test URL with the required payload and response handling.

## User Review Required

> [!IMPORTANT]
> The current implementation uses a local proxy (`/proxy-n8n`) to avoid CORS issues when calling n8n. I will continue using this proxy, but the payload sent *to* the proxy will be formatted so that the proxy sends the exact requested JSON to n8n.

## Proposed Changes

### [Component] API Helper

#### [MODIFY] [js/api.js](file:///c:/Users/Utilisateur/.antigravity/ProspAction_eco_locaux/js/api.js)
- Update `sendEmail` to accept `contactId`, `commercialId`, `subject`, and `emailBody`.
- Use the test URL: `https://lsangouard.app.n8n.cloud/webhook-test/send-email-contact`.
- Format the payload exactly as requested:
  ```json
  {
    "contact_id": contactId,
    "commercial_id": commercialId,
    "subject": subject,
    "email_body": emailBody
  }
  ```
- Implement specific success/error handling based on the `success` field in the response.

### [Component] Call Sites

I will update all pages where the "Email IA" modal is used to pass the logged-in user's ID (commercial ID) to the `API.sendEmail` function.

#### [MODIFY] [js/pipeline.js](file:///c:/Users/Utilisateur/.antigravity/ProspAction_eco_locaux/js/pipeline.js)
- Pass `userId` to `API.sendEmail`.

#### [MODIFY] [js/dashboard.js](file:///c:/Users/Utilisateur/.antigravity/ProspAction_eco_locaux/js/dashboard.js)
- Pass `userId` to `API.sendEmail`.

#### [MODIFY] [contacts.html](file:///c:/Users/Utilisateur/.antigravity/ProspAction_eco_locaux/contacts.html)
- Update inline script to pass `userId` to `API.sendEmail`.

#### [MODIFY] [email-assistant.html](file:///c:/Users/Utilisateur/.antigravity/ProspAction_eco_locaux/email-assistant.html)
- Update inline script to pass `userId` to `API.sendEmail`.

#### [MODIFY] [fiche.html](file:///c:/Users/Utilisateur/.antigravity/ProspAction_eco_locaux/fiche.html)
- Update inline script to pass `userId` to `API.sendEmail`.

## Verification Plan

### Manual Verification
- Open the application.
- Navigate to the "Tableau de suivi" (Kanban).
- Select a contact and click "Email IA".
- Generate an email.
- Click "Valider & Envoyer".
- Check the browser console for:
  - "📦 [API] Payload :" with the correct fields.
  - "📥 [API] Réponse reçue :" from the webhook.
- Verify that a success message is displayed if the webhook returns `success: true`.
- Verify that an error message is displayed if the webhook returns `success: false`.
