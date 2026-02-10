-- Social System Schema Improvements - Industry Standard
-- Adds timestamps, soft-delete, constraints, and indexes to all social tables

-- =============================================
-- 1. FRIENDSHIPS TABLE
-- =============================================

-- Add timestamps and soft-delete
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint to prevent duplicate friendships (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'friendships_user_friend_unique'
    ) THEN
        ALTER TABLE friendships ADD CONSTRAINT friendships_user_friend_unique 
        UNIQUE (user_id, friend_id);
    END IF;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_deleted ON friendships(deleted_at);

-- =============================================
-- 2. FRIEND_REQUESTS TABLE
-- =============================================

-- Add timestamps and soft-delete
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint to prevent duplicate requests (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_from_to_unique'
    ) THEN
        ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_from_to_unique 
        UNIQUE (from_user_id, to_user_id);
    END IF;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_deleted ON friend_requests(deleted_at);

-- =============================================
-- 3. SHARED_HABITS TABLE
-- =============================================

-- Add timestamps and soft-delete
ALTER TABLE shared_habits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE shared_habits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shared_habits_habit_user_unique'
    ) THEN
        ALTER TABLE shared_habits ADD CONSTRAINT shared_habits_habit_user_unique 
        UNIQUE (habit_id, shared_with_id);
    END IF;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shared_habits_owner ON shared_habits(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_habits_shared_with ON shared_habits(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_shared_habits_deleted ON shared_habits(deleted_at);

-- =============================================
-- 4. SHARED_GOALS TABLE
-- =============================================

-- Add timestamps and soft-delete
ALTER TABLE shared_goals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE shared_goals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shared_goals_goal_user_unique'
    ) THEN
        ALTER TABLE shared_goals ADD CONSTRAINT shared_goals_goal_user_unique 
        UNIQUE (goal_id, shared_with_id);
    END IF;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shared_goals_owner ON shared_goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_goals_shared_with ON shared_goals(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_shared_goals_deleted ON shared_goals(deleted_at);

-- =============================================
-- 5. NOTIFICATIONS TABLE
-- =============================================

-- Add timestamps and soft-delete
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted ON notifications(deleted_at);

-- =============================================
-- 6. AUTO-UPDATE TRIGGERS FOR updated_at
-- =============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all social tables
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON friend_requests;
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shared_habits_updated_at ON shared_habits;
CREATE TRIGGER update_shared_habits_updated_at
    BEFORE UPDATE ON shared_habits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shared_goals_updated_at ON shared_goals;
CREATE TRIGGER update_shared_goals_updated_at
    BEFORE UPDATE ON shared_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. RLS POLICIES FOR NEW COLUMNS
-- =============================================

-- Update friendships RLS to exclude soft-deleted
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
    FOR SELECT USING (
        (auth.uid() = user_id OR auth.uid() = friend_id) 
        AND deleted_at IS NULL
    );

-- Update friend_requests RLS to exclude soft-deleted
DROP POLICY IF EXISTS "Users can view own requests" ON friend_requests;
CREATE POLICY "Users can view own requests" ON friend_requests
    FOR SELECT USING (
        (auth.uid() = from_user_id OR auth.uid() = to_user_id)
        AND deleted_at IS NULL
    );

-- Update shared_habits RLS
DROP POLICY IF EXISTS "Users can view shared habits" ON shared_habits;
CREATE POLICY "Users can view shared habits" ON shared_habits
    FOR SELECT USING (
        (auth.uid() = owner_id OR auth.uid() = shared_with_id)
        AND deleted_at IS NULL
    );

-- Update shared_goals RLS  
DROP POLICY IF EXISTS "Users can view shared goals" ON shared_goals;
CREATE POLICY "Users can view shared goals" ON shared_goals
    FOR SELECT USING (
        (auth.uid() = owner_id OR auth.uid() = shared_with_id)
        AND deleted_at IS NULL
    );

-- Update notifications RLS
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (
        auth.uid() = user_id
        AND deleted_at IS NULL
    );
