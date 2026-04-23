# 🌱 Gartenapp

**Shared plant & seed tracker for gardening enthusiasts**

A digital plant companion inspired by Kim's physical plant card album. Mobile-first app for tracking and customizing botanical information for anyone who loves gardening - women, men, and families alike.

## 📱 Project Overview

**What it is**: Digital plant tracker with kawaii botanical illustrations
**For whom**: Gardening enthusiasts of all genders - women, men, families, and anyone who loves plants
**Purpose**: Inspired by Kim's physical plant card collection - a digital tool for organizing and exploring botanical knowledge
**Tone**: Nimble, humble, simple and beautiful. No overkill.
**Philosophy**: Demo first, polish later

## 🏗️ Technical Stack

- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage)
- **Auth**: Simple password gate (`Garten2026`)
- **Deployment**: Vercel (planned)
- **Domain**: `garten.philia-aletheia.art` (to be configured)

## 🎯 Current State

### ✅ Features Complete
- **Plant List**: 2-column mobile grid with plant cards
- **Plant Details**: Full botanical info with inline editing
- **Authentication**: Password-protected access
- **Mobile Optimized**: Touch-friendly scrolling and interactions
- **Personal Customization**: Individual field overrides saved separately
- **Error Handling**: Robust loading states and error messages
- **Image Management**: Kawaii generation script with German character support

### 🔧 Technical Features
- Mobile-first responsive design (max-width 480px)
- 8 plants with 16 German botanical fields each
- React.use(params) for Next.js 16 compatibility
- Filename sanitization for German special characters (ü→u, ö→o, ä→a, ß→ss)
- Supabase Storage integration for custom illustrations

## 🗄️ Database Schema

### Supabase Project
- **Project ID**: `bbscvofuqucsxvamkwnx`
- **URL**: `https://bbscvofuqucsxvamkwnx.supabase.co`

### Tables
```sql
-- Core plant data (shared)
plants: id, name, latin_name, category, illustration_url, [16 botanical fields]

-- Garden ownership
gardens: id, owner_name (customizable for any user)

-- Personal field overrides
garden_plants: id, garden_id, plant_id, [16 override fields], notes
```

### Storage Buckets
- **illustrations**: Public bucket for kawaii plant images (`kawaii/` folder)

## 🌱 Plants Database

**Growing catalog of Western European garden plants** with authentic German cultivation data. Source of truth: `data/plants.json` (committed). Seed via `npm run seed-plants` (upserts by `(name, latin_name)`, preserves any existing `illustration_url`).

Categories: **Gemüse, Kraut, Blume, Obst.** Goal coverage: ~150-200 plants.

**16 German Botanical Fields per plant:**
Sorte, Saatzeit, Saattiefe, Nachbarn, Erde, Witterung, Bodenmilieu, Dünger, Vorzucht, Schneiden, Einwintern, Ernte, Einjährig/Mehrjährig, Pflanzort, Wirkung auf den Körper, Stark-/Schwachzehrer

**Per-garden overrides**: each user (garden) can customize any of the 16 fields locally — stored in `garden_plants` rows scoped by `garden_id`. The login flow upserts a `gardens` row by name and sets `garten_id` cookie.

## 🛠️ Scripts & Tools

### Environment Variables
```bash
# .env.local (configured locally)
NEXT_PUBLIC_SUPABASE_URL=https://bbscvofuqucsxvamkwnx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_[key]
SUPABASE_SECRET_KEY=sb_secret_[key]
GOOGLE_AI_API_KEY=[your_google_ai_key]
```

## 🚀 Deployment

### Live
- **Production**: `https://gartenapp-git-main-mikeio.vercel.app`
- **Release**: v1.0 (demo release — frozen as git tag `v1.0`)
- **Custom domain**: `garten.philia-aletheia.art` (planned)

### Local
- **Dev server**: `http://localhost:3001` (or `:3000`)
- **Network**: `http://192.168.1.100:3001` (mobile testing)

### Repository
- **GitHub**: `https://github.com/michaelwartmann/gartenapp.git`

### Vercel Environment Variables
All four vars from `.env.example` must be set in the Vercel project:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY
GOOGLE_AI_API_KEY
```

## 🎨 Design System

### Colors
- Background: `#FAFAF7`
- Card background: `#FFFFFF`  
- Primary green: `#4A7C59`
- Accent terracotta: `#C17B5C`
- Text primary: `#2C2C2A`
- Text muted: `#888780`
- Border: `#E8E6DF`

### Typography & Layout
- Font: `system-ui, -apple-system, sans-serif`
- Border radius: 12px (cards), 8px (fields)
- Mobile-first: max-width 480px centered
- Touch targets: minimum 44px height
- No shadows, borders only

## 🔑 Key Decisions Made

1. **Simple Auth**: Password gate instead of user accounts - easier for shared access
2. **Personal Customization**: garden_plants table stores individual user field overrides
3. **Mobile-First Design**: 480px max width, large touch targets
4. **German Botanical Focus**: Authentic German gardening terminology
5. **Kawaii Aesthetic**: Soft, cute illustrations inspired by Kim's artistic style
6. **Filename Sanitization**: Handle German special characters for file uploads
7. **Single Page App**: Simple navigation for all gardening enthusiasts

## 🎯 v2 Roadmap

Features to build on top of v1.0 (prioritize one per plan):

1. **On-demand kawaii image generation** — when a user adds a new plant, auto-generate the illustration via Google Imagen/Gemini API and upload to Supabase Storage. Reuses the existing `@google/generative-ai` dep.
2. **30+ plants** with complete botanical data (currently 8).
3. **Filter/sort** by any of the 16 botanical dimensions.
4. **Per-user gardens** — move beyond the single shared password to individual accounts.
5. **Custom domain** — point `garten.philia-aletheia.art` at Vercel.
6. **Enhanced mobile UI** — polish and animations.

## 📝 Development Notes

### Architecture Choices
- Next.js 16 with App Router for modern React patterns
- Supabase for rapid backend setup with real-time capabilities
- TypeScript for type safety with botanical data structures
- Tailwind for mobile-first responsive design

### User-Friendly Features
- No complex user management - simple shared access
- Large, clear typography and buttons for accessibility
- Intuitive tap-to-edit interaction pattern
- Gentle error messages and loading states
- Inclusive design for gardeners of all backgrounds

---

**Built with ❤️ for gardening enthusiasts everywhere**  
*Inspired by Kim's passion for plants*  
*Simple, warm, earthy. No overkill.*
