-- =====================================================
-- Create Friendship Function (Bypasses RLS)
-- This function creates bidirectional friendships
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Function to create bidirectional friendship
-- Uses SECURITY DEFINER to bypass RLS policies
CREATE OR REPLACE FUNCTION create_friendship(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert both directions
    INSERT INTO friendships (user_id, friend_id)
    VALUES (user1_id, user2_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
    
    INSERT INTO friendships (user_id, friend_id)
    VALUES (user2_id, user1_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating friendship: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_friendship TO authenticated;
GRANT EXECUTE ON FUNCTION create_friendship TO anon;

-- Also update RLS policy to allow viewing friendships where user is friend_id
-- This ensures both users can see the friendship
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
