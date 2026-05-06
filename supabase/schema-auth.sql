-- ── Auth migration — run after schema.sql ──────────────────────────────
-- Esegui nel Supabase SQL Editor dopo aver abilitato Email auth in Authentication > Providers

-- 1. Profili utente (creati automaticamente al signup)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Aggiungi user_id alla tabella jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);

-- 4. RLS — utenti vedono solo i propri job (abilitare RLS su Supabase Dashboard)
ALTER TABLE jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Jobs: owner può leggere e modificare; service role bypassa tutto
CREATE POLICY "jobs_owner_read"   ON jobs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "jobs_owner_insert" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "jobs_owner_update" ON jobs FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Profiles: ogni utente legge/modifica il proprio
CREATE POLICY "profiles_self_read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (auth.uid() = id);
