# 🏠 Chorify

> Your household, in harmony. Track chores, reward the family.

A full-featured PWA for household chore tracking, built to be hosted free on GitHub Pages with Supabase as the backend (no credit card required for either).

---

## ✨ Features

- **Multi-user households** — invite family members via a share code
- **Recurring tasks** — daily, weekly, monthly, annual, and custom
- **Starter packs** — Dog Care, Home Maintenance, Parent Pack, Garden, Vehicle, and more
- **Points & leaderboard** — gamified completions, weekly rankings
- **Child mode** — simplified view for kids, with rewards parents can set
- **PWA** — installable on iPhone/Android, works offline
- **Capacitor-ready** — drop-in compatible for native app builds

---

## 🚀 Quick Start (15 minutes)

### 1. Set up Supabase (free, no credit card)

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login works)
2. Click **New project** — choose any name, any region, any password
3. Once created, go to **SQL Editor** (left sidebar)
4. Open `SUPABASE_SCHEMA.sql` from this repo and paste it in — click **Run**
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public** key (long string starting with `eyJ...`)

### 2. Add your Supabase credentials

Open `src/lib/supabase.js` and replace lines 5–6:

```js
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
```

### 3. Deploy to GitHub Pages

```bash
# 1. Create a new GitHub repo (e.g. "chorify")
# 2. Push this folder to it
git init
git add .
git commit -m "Initial Chorify app"
git remote add origin https://github.com/YOURUSERNAME/chorify.git
git push -u origin main

# 3. In GitHub repo settings → Pages:
#    Source: Deploy from branch → main → / (root)
#    Save

# Your app will be live at:
# https://YOURUSERNAME.github.io/chorify/
```

**That's it.** No build step required — this is vanilla JS/HTML/CSS.

---

## 📱 Installing as a PWA

**iPhone**: Open in Safari → Share → Add to Home Screen
**Android**: Open in Chrome → Menu → Install App / Add to Home Screen

---

## 🔧 Building with Capacitor (native app)

Once you're ready to go native:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Chorify com.yourname.chorify
npx cap add ios
npx cap add android

# Build and sync
npx cap sync

# Open in Xcode / Android Studio
npx cap open ios
npx cap open android
```

Capacitor wraps your existing web app with zero changes needed.

---

## 📁 File Structure

```
chorify/
├── index.html              # App shell
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline support)
├── SUPABASE_SCHEMA.sql     # Database setup
├── src/
│   ├── main.js             # All screens + UI logic (~600 lines)
│   ├── lib/
│   │   ├── supabase.js     # Lightweight Supabase client (no npm needed)
│   │   ├── store.js        # Reactive app state
│   │   └── db.js           # All database operations + starter packs
│   └── styles/
│       └── main.css        # Design system + all component styles
└── icons/                  # PWA icons (add icon-192.png + icon-512.png)
```

---

## 🎨 Design System

Warm and cozy palette: cream, terracotta, sage, parchment.
Typography: Fraunces (serif display) + DM Sans (body).
No build tools, no frameworks — pure vanilla JS with a custom reactive store.

---

## 🆓 Free Forever Stack

| Service | What it does | Free limits |
|---|---|---|
| GitHub Pages | Hosts the app | Unlimited |
| Supabase Auth | Email/password sign-in | 50,000 MAU |
| Supabase Postgres | All app data | 500MB |
| Supabase Realtime | Live sync | 200 concurrent |
| Google Fonts | Fraunces + DM Sans | Unlimited |

A household app will comfortably fit within these limits indefinitely.
No credit card. No surprise charges. 

---

## 🗺 Roadmap

- [ ] Push notifications (task reminders)
- [ ] Photo attachments on task completion
- [ ] Recurring task history charts
- [ ] Family chat / announcements
- [ ] Apple Sign In (Capacitor)
- [ ] Dark mode

---

## 💬 Invite Code Flow

When a user creates a household, they get a 6-character invite code (e.g. `AB12CD`).
Share this code with family. When they sign up and enter the code, they're added to the same household and can see all tasks and the leaderboard immediately.

Child accounts don't need an email — parents add them directly from the Family tab.
