# Proctoring System Setup Guide

## Step 1: Run Database Migration

The proctoring settings persistence requires two new tables in your Supabase database. You must run this SQL **once** in your Supabase SQL Editor:

### Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **+ New Query**

### Run This SQL

```sql
-- Proctoring settings persistence (admin panel)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proctoring violation logs (admin dashboard)
CREATE TABLE IF NOT EXISTS proctoring_violations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  interview_id TEXT,
  violation_type TEXT NOT NULL,
  reason TEXT,
  strike_count INTEGER DEFAULT 2,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_user_id 
  ON proctoring_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_created_at 
  ON proctoring_violations(created_at DESC);
```

5. Click **RUN** button (or press Cmd/Ctrl + Enter)

### Verify Success

You should see:
```
Success. No rows returned
```

## Step 2: Restart Dev Server

After running the migration:

1. Stop the dev server (Ctrl + C in terminal)
2. Restart it: `npm run dev`
3. Refresh your browser

## Step 3: Test Proctoring Settings

1. Navigate to **Admin → Proctoring** page
2. Adjust any slider (e.g., "No Face Strike Seconds")
3. Click outside the slider area
4. Navigate away to another page
5. Come back to Admin → Proctoring
6. **Settings should persist** ✅

## Troubleshooting

### 403 Forbidden on GET /api/settings/proctoring

This error occurs if:
- ✅ **Tables created**: The migration above fixes this
- ❌ **Old server state**: Restart dev server after migration

### Settings still resetting

1. Check browser console for errors
2. Verify the SQL ran successfully in Supabase
3. Check server terminal for "Proctoring Settings load failed" warnings

### 403 Forbidden on POST /api/settings/proctoring (when saving)

This is expected! Only **admin users** can save proctoring settings. Make sure you're logged in as an admin user.

To make yourself admin:
```sql
-- Run in Supabase SQL Editor
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

## What Changed

### New Features
- ✅ Proctoring settings persist across page refreshes
- ✅ All Rekognition violations now trigger strikes (not just multiple_faces)
- ✅ Behavioral proctoring: right-click, copy/paste, split-screen, F12/devtools
- ✅ 2-strike system for both camera and behavioral violations
- ✅ Strike cooldown reduced to 2 seconds (from 5)
- ✅ Admin violation logging for review
- ✅ Head angle/emotion display in webcam badges

### Files Modified
- `server/apiServer.ts` — Persistent settings + violation logging endpoint
- `src/hooks/useFaceDetection.ts` — Fixed strike abort bug
- `src/components/WebcamPanel.tsx` — Unified 2-strike system, cooldown fix
- `src/hooks/useBehaviorProctor.ts` — **NEW** behavioral detection hook  
- `src/pages/Interview.tsx` — Integrated behavioral proctoring
- `supabase/schema.sql` — Database schema (run this manually)
