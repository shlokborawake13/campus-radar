# 🛰️ Campus Radar

Campus Radar is a privacy-first, verified anonymous college social network designed for college communities.

---

## 📁 Repository Structure

```text
campus-radar/
├── frontend/             # Vite + Vanilla JS Single Page Application (Deploy to Vercel)
│   ├── src/              # UI components, pages, services, router
│   ├── index.html        # Main HTML shell
│   ├── vite.config.js    # Vite configuration & dev proxy
│   ├── vercel.json       # Vercel SPA route rewrite rules
│   └── package.json      # Frontend scripts & dependencies
│
├── backend/              # Node.js + Express + TypeScript API (Deploy to Render)
│   ├── src/              # Controllers, routes, services, middleware, security
│   │   ├── db/           # PostgreSQL migrations & connection pool
│   │   ├── security/     # Argon2id, JWT, TOTP, HMAC OTP, sanitization
│   │   └── services/     # Posts, confessions, moderation, uploads
│   ├── render.yaml       # Render blueprint deployment file
│   ├── tsconfig.json     # TypeScript build configuration
│   └── package.json      # Backend scripts & dependencies
│
└── README.md
```

---

## 🚀 Local Development Setup

### 1. Start the Backend API
```bash
cd backend
npm install
npm run migrate      # Run database migrations
npm run dev          # Starts backend on http://localhost:5000
```

### 2. Start the Frontend App
```bash
cd frontend
npm install
npm run dev          # Starts Vite dev server on http://localhost:3000
```

---

## ☁️ Production Deployment Guide

### Deploying Backend to Render
1. Go to [Render Dashboard](https://dashboard.render.com/) -> **New Web Service**.
2. Connect your GitHub repository: `https://github.com/shlokborawake13/campus-radar.git`.
3. Set:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Add your Environment Variables in Render:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `JWT_ACCESS_SECRET` (At least 32 characters)
   - `JWT_REFRESH_SECRET` (At least 32 characters)
   - `OTP_SALT` (At least 16 characters)
   - `ALLOWED_EMAIL_DOMAIN` = `sanjivani.edu.in`
   - `ALLOWED_ORIGINS` = `https://your-frontend.vercel.app`
   - `NODE_ENV` = `production`
   - `PORT` = `5000`

### Deploying Frontend to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) -> **Add New Project**.
2. Select your repository: `campus-radar`.
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_URL` = `https://your-backend.onrender.com/api`
   - `VITE_ADMIN_GATEWAY` = `/sec-admin-gateway-7x9q`
5. Deploy!
