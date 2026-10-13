-- ==============================================================================
-- Fix Supabase Warnings: RLS Performance & Duplicate Indexes
-- Run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. FIX DUPLICATE INDEX
-- Table: shared_habits
-- Warning: Identical indexes found.
-- Error correction: The index is tied to a constraint. We must drop the constraint.
ALTER TABLE shared_habits DROP CONSTRAINT IF EXISTS shared_habits_unique_habit_shared_with;

-- 2. FIX RLS POLICIES (PERFORMANCE)
-- Warning: calls to auth.uid() should be wrapped in (select auth.uid()) to avoid re-evaluation per row.

-- --- HABITS ---
DROP POLICY IF EXISTS "Users can view their own habits" ON habits;
CREATE POLICY "Users can view their own habits" ON habits FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own habits" ON habits;
CREATE POLICY "Users can insert their own habits" ON habits FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own habits" ON habits;
CREATE POLICY "Users can update their own habits" ON habits FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own habits" ON habits;
CREATE POLICY "Users can delete their own habits" ON habits FOR DELETE USING ((select auth.uid()) = user_id);

-- --- HABIT COMPLETIONS ---
DROP POLICY IF EXISTS "Users can view their own completions" ON habit_completions;
CREATE POLICY "Users can view their own completions" ON habit_completions FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own completions" ON habit_completions;
CREATE POLICY "Users can insert their own completions" ON habit_completions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own completions" ON habit_completions;
CREATE POLICY "Users can update their own completions" ON habit_completions FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own completions" ON habit_completions;
CREATE POLICY "Users can delete their own completions" ON habit_completions FOR DELETE USING ((select auth.uid()) = user_id);

-- --- PROFILES ---
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- --- FRIENDSHIPS ---
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships FOR SELECT USING ((select auth.uid()) = user_id OR (select auth.uid()) = friend_id);

DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE USING ((select auth.uid()) = user_id);

-- --- FRIEND REQUESTS ---
DROP POLICY IF EXISTS "Users can view own requests" ON friend_requests;
CREATE POLICY "Users can view own requests" ON friend_requests FOR SELECT USING ((select auth.uid()) = from_user_id OR (select auth.uid()) = to_user_id);

DROP POLICY IF EXISTS "Users can send requests" ON friend_requests;
CREATE POLICY "Users can send requests" ON friend_requests FOR INSERT WITH CHECK ((select auth.uid()) = from_user_id);

DROP POLICY IF EXISTS "Users can update received requests" ON friend_requests;
CREATE POLICY "Users can update received requests" ON friend_requests FOR UPDATE USING ((select auth.uid()) = to_user_id);

-- --- SHARED HABITS ---
DROP POLICY IF EXISTS "Users can view shared habits" ON shared_habits;
CREATE POLICY "Users can view shared habits" ON shared_habits FOR SELECT USING ((select auth.uid()) = owner_id OR (select auth.uid()) = shared_with_id);

DROP POLICY IF EXISTS "Users can share own habits" ON shared_habits;
CREATE POLICY "Users can share own habits" ON shared_habits FOR INSERT WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can unshare own habits" ON shared_habits;
CREATE POLICY "Users can unshare own habits" ON shared_habits FOR DELETE USING ((select auth.uid()) = owner_id);

-- --- INTEGRATIONS ---
DROP POLICY IF EXISTS "Users can view their own integrations" ON integrations;
CREATE POLICY "Users can view their own integrations" ON integrations FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own integrations" ON integrations;
CREATE POLICY "Users can update their own integrations" ON integrations FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own integrations" ON integrations;
CREATE POLICY "Users can insert their own integrations" ON integrations FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own integrations" ON integrations;
CREATE POLICY "Users can delete their own integrations" ON integrations FOR DELETE USING ((select auth.uid()) = user_id);

-- --- SYNCED ACTIVITIES ---
DROP POLICY IF EXISTS "Users can view their own synced activities" ON synced_activities;
CREATE POLICY "Users can view their own synced activities" ON synced_activities FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM integrations
    WHERE integrations.id = synced_activities.integration_id
    AND integrations.user_id = (select auth.uid())
  )
);
