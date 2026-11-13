# Road Rescue Postman collections

Two collections cover every Express route in `backend/src/app.ts` and `backend/src/routes/`.

| File | Target |
|------|--------|
| `Road-Rescue-API.local.postman_collection.json` | `http://localhost:4002` |
| `Road-Rescue-API.prod.postman_collection.json` | `https://api.roadrescue4u.com` |

Matching environments are optional if you import a collection (each collection already has `baseUrl` and credentials as variables):

- `Road-Rescue-API.local.postman_environment.json`
- `Road-Rescue-API.prod.postman_environment.json`

## Import

Postman: **Import** → select the collection JSON (and the environment if you want).

## Auth

1. Start the API (`cd backend && npm run dev`). Local default is port **4002** if `PORT=4002` in `backend/.env`; otherwise change `baseUrl`.
2. Run **2. Auth → Login customer / mechanic / admin**. Test scripts save `accessToken` and role-specific tokens.
3. Use **0. Session helpers** to switch the active Bearer token.
4. Collection auth is `Authorization: Bearer {{accessToken}}`. Public routes send no auth.

Local seed accounts (after `npm run seed`):

- Customer `ama.serwaa@example.com` / `Password123!`
- Mechanic `kwame.mensah@example.com` / `Password123!`
- Admin `admin@roadrescue.gh` / `Admin123!`

Replace production credentials before hitting live. Do not use seed passwords on production.

## IDs

List/create requests capture `vehicleId`, `requestId`, `mechanicId`, `payoutMethodId`, `withdrawalId`, `settlementId`, `notificationId`, and payment references when the response includes them.

## Regenerate

```bash
node postman/generate.mjs
```
