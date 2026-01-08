-- =====================================================
-- Friend Code Search Function
-- This function allows searching profiles by friend code (UUID prefix)
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Create function to search profiles by friend code (UUID prefix)
CREATE OR REPLACE FUNCTION search_profiles_by_code(search_code TEXT, current_user_id UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.email,
        p.avatar_url
    FROM profiles p
    WHERE 
        -- Cast UUID to text and search by prefix (case-insensitive)
        LOWER(p.id::text) LIKE LOWER(search_code) || '%'
        -- Exclude current user
        AND p.id != current_user_id
    LIMIT 10;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_profiles_by_code TO authenticated;
GRANT EXECUTE ON FUNCTION search_profiles_by_code TO anon;
