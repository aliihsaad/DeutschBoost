-- Add mother_language field to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS mother_language TEXT;

-- Add comment to document the field
COMMENT ON COLUMN user_profiles.mother_language IS 'User''s native language for AI to provide explanations in';

-- Example update for testing (optional - remove if not needed)
-- UPDATE user_profiles SET mother_language = 'English' WHERE mother_language IS NULL;
