# 🚀 Gap Analysis Feature - Supabase Setup

## ✅ Current Status
Your VidyaMitra project is configured to use **Supabase** (`DB_TYPE=supabase` in `.env`).

The Gap Analysis feature will work seamlessly with Supabase! The database adapter automatically translates all SQLite-style queries to Supabase/PostgreSQL.

## 📋 What You Need to Do

### Step 1: Create Tables in Supabase Dashboard

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: **zakryngmxzckmfaesqwy**
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the following SQL:

```sql
-- ============================================================
-- Gap Analysis & Learning Roadmaps Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS gap_analysis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  future_ready_score TEXT DEFAULT '{}',
  skill_gaps TEXT DEFAULT '[]',
  profile_conflicts TEXT DEFAULT '[]',
  job_ready_date TEXT,
  job_ready_months INTEGER,
  created_at TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS learning_roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gap_analysis_id TEXT,
  mermaid_code TEXT,
  monthly_plan TEXT DEFAULT '[]',
  total_months INTEGER,
  total_hours INTEGER,
  job_ready_date TEXT,
  created_at TEXT DEFAULT (now()::text)
);
```

6. Click **Run** (or press `Ctrl+Enter`)
7. Verify success: You should see "Success. No rows returned"

### Step 2: Test the Feature

1. Start your development server if not already running:
   ```powershell
   npm run dev
   ```

2. Navigate to: http://localhost:5173/gap-analysis

3. Login and click **"Run Analysis"**

4. Enter a target role (e.g., "Full Stack Developer")

5. The feature should:
   - ✅ Generate AI-powered skill gap analysis
   - ✅ Create personalized learning roadmap
   - ✅ Display Mermaid visualization
   - ✅ Provide career insights

## 🔧 How It Works

### Database Architecture
```
┌─────────────────┐
│  API Endpoints  │
│  (apiServer.ts) │
└────────┬────────┘
         │
    DB.get/all/run (SQLite-style API)
         │
         ▼
┌──────────────────┐
│  Database.ts     │
│  (Smart Router)  │
└────────┬─────────┘
         │
    DB_TYPE=supabase
         │
         ▼
┌─────────────────────┐
│ SupabaseAdapter.ts  │
│ (SQL Translator)    │
└─────────┬───────────┘
          │
    Translates to Supabase queries
          │
          ▼
┌──────────────────────┐
│   Supabase Cloud DB  │
│   (PostgreSQL)       │
└──────────────────────┘
```

### API Endpoints (All Supabase-Ready)
- `GET /api/analysis/:userId` - Load existing analysis
- `POST /api/analysis/run` - Generate new analysis (uses Groq AI)
- `GET /api/roadmap/:userId` - Load roadmap
- `POST /api/roadmap/generate` - Create learning roadmap (uses Groq AI)
- `POST /api/analysis/narrative` - Get AI career insights
- `POST /api/analysis/skill-explain` - Get skill-specific guidance

### Data Flow Example
```typescript
// Your API code (works identically with SQLite or Supabase)
const analysis = await DB.get(
  'SELECT * FROM gap_analysis WHERE user_id = ?',
  [userId]
);

// Behind the scenes with Supabase:
// 1. SupabaseAdapter parses the SQL
// 2. Translates to: supabase.from('gap_analysis').select('*').eq('user_id', userId)
// 3. Returns result in same format as SQLite
```

## ✅ Verification Checklist

After creating the tables, verify everything works:

- [ ] Tables created in Supabase (check SQL Editor or Table Editor)
- [ ] Can access `/gap-analysis` page
- [ ] Can run analysis without errors
- [ ] Analysis results displayed correctly
- [ ] Roadmap visualization renders
- [ ] Data persists across page reloads

## 🐛 Troubleshooting

### Error: "No such table: gap_analysis"
**Solution:** You haven't run the SQL in Supabase dashboard yet. Go to Step 1 above.

### Error: "Failed to fetch"
**Solution:** Check that:
- Dev server is running (`npm run dev`)
- Supabase credentials in `.env` are correct
- `DB_TYPE=supabase` is set in `.env`

### Error: "Groq API not configured"
**Solution:** Verify `GROQ_GAP_ANALYSIS_KEY` is in your `.env` file:
```
GROQ_GAP_ANALYSIS_KEY=your_groq_api_key_here
```

### Error: "Not authenticated"
**Solution:** Make sure you're logged in. The feature requires authentication.

## 📊 Database Schema Reference

### gap_analysis Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| user_id | TEXT | User who ran the analysis |
| target_role | TEXT | Job role being targeted |
| future_ready_score | JSON | Overall readiness metrics |
| skill_gaps | JSON | Array of skills to improve |
| profile_conflicts | JSON | Issues detected in profile |
| job_ready_date | TEXT | Projected job-ready date |
| job_ready_months | INTEGER | Months to job-ready |
| created_at | TEXT | Timestamp |

### learning_roadmaps Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| user_id | TEXT | User who owns the roadmap |
| gap_analysis_id | TEXT | Links to gap_analysis |
| mermaid_code | TEXT | Mermaid.js diagram code |
| monthly_plan | JSON | Detailed learning plan |
| total_months | INTEGER | Duration of roadmap |
| total_hours | INTEGER | Total learning hours |
| job_ready_date | TEXT | Completion target date |
| created_at | TEXT | Timestamp |

## 🎉 That's It!

Once you run the SQL in Supabase, the Gap Analysis feature will work perfectly with your Supabase database. No code changes needed - the adapter handles everything automatically!
