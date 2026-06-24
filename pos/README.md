# Simple POS System with Supabase

A real-time Point of Sale system built with React, TypeScript, and Supabase. All transactions sync in real-time across devices and are stored in your Supabase database.

## Setup Instructions

### 1. Create Supabase Table

1. Go to your [Supabase dashboard](https://supabase.co)
2. Open SQL Editor and run the SQL from `SUPABASE_SETUP.sql`
3. This creates the `transactions` table and enables real-time updates

### 2. Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will use the environment variables from `.env.local`.

### 3. GitHub Actions Deployment (Auto-deploy on Push)

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `VITE_SUPABASE_URL`: `https://cgudfsynurrrlkfzebgh.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: Your anon key from `.env.local`

3. Push to main branch → GitHub Actions automatically builds and deploys to:
   - `https://nailur.github.io/pos/`

## Features

✅ **Real-time Sync** — All transactions sync across devices instantly  
✅ **Product Catalog** — Browse items by category  
✅ **Shopping Cart** — Add/remove items, adjust quantities  
✅ **Automatic Tax** — 8% tax calculated on checkout  
✅ **Sales History** — View all transactions with totals  
✅ **Cloud Storage** — No server needed, runs on GitHub Pages  

## Environment Variables

Create `.env.local` (or use `.env.example` as template):

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Build for Production

```bash
npm run build
```

Output: `dist/` folder (ready for GitHub Pages)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Database**: Supabase (PostgreSQL)
- **Hosting**: GitHub Pages (free)
- **Real-time**: Supabase RealtimeAPI

## Notes

- Anon key is public-safe (client-side only)
- Real-time updates work across browser tabs and devices
