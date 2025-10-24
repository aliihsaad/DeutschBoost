-- Function to ensure user exists in users and user_profiles tables
-- This is a fallback in case the trigger didn't fire
CREATE OR REPLACE FUNCTION public.ensure_user_exists(user_id UUID, user_email TEXT)
RETURNS VOID AS $$
BEGIN
  -- Insert into users if not exists
  INSERT INTO public.users (id, email, created_at)
  VALUES (user_id, user_email, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Insert into user_profiles if not exists
  INSERT INTO public.user_profiles (id)
  VALUES (user_id)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(UUID, TEXT) TO authenticated;
