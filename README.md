# Road Rescue Ghana

Road Rescue Ghana is a roadside-assistance marketplace that connects stranded drivers with nearby mechanics across Ghana. Currency is Ghana Cedis (₵).

## Stack

- Frontend: React 18, Vite, TypeScript, TailwindCSS, React Router
- Backend: Node.js, Express, TypeScript, MongoDB, Mongoose
- Auth: JWT access + refresh tokens, bcrypt

## Prerequisites

- Node.js 20+
- MongoDB Atlas cluster (or local MongoDB)

## Quick start

```bash
# Backend — set MONGODB_URI in backend/.env to your Atlas connection string
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev

# Frontend (new terminal)
cd ..
cp .env.example .env
npm install
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:4000

Vite proxies `/api` to the backend, so keep both servers running.

## Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Customer | ama.serwaa@example.com | Password123! |
| Mechanic | kwame.mensah@example.com | Password123! |
| Admin | admin@roadrescue.gh | Admin123! |

## Scripts

Frontend:

```bash
npm run check
```

Backend:

```bash
cd backend
npm run check
npm run seed
```

## Environment

Frontend `.env`:

```
VITE_API_URL=/api
VITE_API_PROXY_TARGET=http://localhost:4000
```

Backend `.env` — see `backend/.env.example`.

## API logs

Every `/api` request receives an `x-request-id` header. API logs include the same request ID,
HTTP method, URL, response status, duration, IP address, and authenticated user context.

```bash
cd backend
npm run logs           # all successful API requests
npm run logs:warnings  # validation, authentication, authorization, and other 4xx responses
npm run logs:errors    # unhandled errors and 5xx responses
```

Logs are written as structured JSON under `backend/logs/`. Do not log passwords, tokens, or
authorization headers.

## Phase status

- Phase 0: routing, docs, CI — done
- Phase 1: MongoDB Atlas backend, auth, live API screens, Ghana seed data — done
- Later: Google Maps, Socket.IO tracking, Paystack, FCM
