# Quick Start Guide

## 🚀 Get DeutschBoost Running in 5 Minutes

### Prerequisites
- Node.js installed
- A Supabase account (free tier is fine)
- Gemini API key

---

## Step-by-Step Setup

### 1. Install Dependencies (Already Done ✅)
```bash
npm install
```

### 2. Create Supabase Project (2 minutes)

1. Visit [supabase.com](https://supabase.com)
2. Sign up / Log in
3. **New Project** button
4. Name it `deutschboost`
5. Set a strong database password
6. Choose your region
7. Wait for creation (~2 min)

### 3. Run Database Migration (1 minute)

1. In Supabase → **SQL Editor**
2. **New Query**
3. Copy-paste entire `supabase/migrations/001_initial_schema.sql`
4. Click **Run** ▶️
5. Should see "Success"

### 4. Configure .env.local (1 minute)

1. In Supabase → **Settings > API**
2. Open `.env.local` in your project
3. Replace:

```env
# Copy from Supabase Settings > API
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...YOUR-KEY

# Your existing Gemini key
API_KEY=your_gemini_api_key_here

# Leave as is
VITE_APP_URL=http://localhost:5173
```

### 5. Start the App (10 seconds)

```bash
npm run dev
```

Open http://localhost:5173

---

## First Use

1. **Sign Up** → Click "Sign up" → Fill form → Check email
2. **Login** → Enter credentials → Access app
3. **Take Test** → Click "Test" in nav → Complete placement test
4. **View Plan** → Auto-generated learning plan appears
5. **Profile** → Check your profile with real data

---

## What You Can Do Now

✅ **Sign up/Login** - Email + password or Google OAuth
✅ **Take Placement Test** - AI evaluates your German level
✅ **Get Learning Plan** - Personalized 4-week plan
✅ **Track Progress** - Check off completed items
✅ **AI Conversation** - Practice speaking with AI
✅ **View Profile** - See your stats and settings

---

## Verify It Works

After signup, check Supabase → **Table Editor**:
- `users` - Should have 1 row (you!)
- `user_profiles` - Your learning profile
- After test: `test_results` should have your results
- After test: `learning_plans` should have your plan

---

## Optional: Enable Google OAuth

1. Supabase → **Authentication > Providers**
2. Toggle **Google**
3. Follow setup instructions
4. Add OAuth credentials from Google Cloud

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ Check `.env.local` has correct values from Supabase dashboard

**Can't sign up**
→ Check email (including spam). Or disable email confirmation:
   Supabase → Authentication > Settings → Toggle off "Enable email confirmations"

**Learning plan not saving**
→ Check browser console. Verify database migration ran successfully.

---

## Next Steps

See **BUILD_PLAN.md** for the complete roadmap.

**Phase 2** will add:
- Full Goethe exam simulator
- Listening exercises with audio
- Advanced scoring

Ready to continue? Follow **SETUP_INSTRUCTIONS.md** for detailed next steps.

---

Happy Learning! 🇩🇪 🚀
