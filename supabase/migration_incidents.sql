-- Migration: Epic 14 — Adversidades / Incidentes

CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_access" ON incidents
  FOR ALL USING (
    pet_id IN (
      SELECT id FROM pets WHERE user_id = auth.uid()
      UNION
      SELECT pet_id FROM pet_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_incidents_pet ON incidents(pet_id, occurred_at DESC);

-- Bucket para fotos de incidentes
INSERT INTO storage.buckets (id, name, public)
  VALUES ('pet-incidents', 'pet-incidents', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY "pet_incidents_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pet-incidents');

CREATE POLICY "pet_incidents_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pet-incidents' AND auth.uid() IS NOT NULL);

CREATE POLICY "pet_incidents_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'pet-incidents' AND auth.uid() IS NOT NULL);

CREATE POLICY "pet_incidents_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'pet-incidents' AND auth.uid() IS NOT NULL);
