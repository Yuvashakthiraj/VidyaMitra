# Boolean Type Fix for Supabase Database

## Problem
The application was throwing this error when loading the login/signup page:
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
Error: invalid input syntax for type integer: "true"
```

## Root Cause
- The Supabase database schema has `is_active` column defined as **INTEGER** (0 or 1)
- The application queries were using `is_active = TRUE` (boolean syntax)
- PostgreSQL couldn't compare an INTEGER column with a boolean value

## Solution
Changed all boolean comparisons in queries from `= TRUE` to `= 1` for compatibility with the INTEGER column type.

### Files Fixed
1. **server/apiServer.ts**
   - Line 817: `/api/institutions/list` endpoint - Changed `is_active = TRUE` to `is_active = 1`
   - Line 788: `/api/auth/institution/login` endpoint - Changed `is_active = TRUE` to `is_active = 1`

2. **server/subscriptionRoutes.ts**
   - Line 23: `/api/subscription/plans` endpoint - Changed `is_active = TRUE` to `is_active = 1`

## Testing
After the fix:
1. Restart the server: `npm run dev`
2. Navigate to the login page
3. Verify that institutions list loads without error
4. Test both student and institution login flows

## Note for Future
If you want to use BOOLEAN type instead of INTEGER in PostgreSQL:
1. Update the Supabase schema to use `BOOLEAN` instead of `INTEGER`
2. Run: `ALTER TABLE institutions ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;`
3. Run: `ALTER TABLE subscription_plans ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;`
4. Then you can use `= TRUE` / `= FALSE` in queries
