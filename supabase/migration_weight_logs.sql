-- Migration: Histórico de peso por data

CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight_kg NUMERIC(6,2) NOT NULL,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weight_logs_access" ON weight_logs
  FOR ALL USING (
    pet_id IN (
      SELECT id FROM pets WHERE user_id = auth.uid()
      UNION
      SELECT pet_id FROM pet_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_weight_logs_pet ON weight_logs(pet_id, measured_at DESC);

-- Bucket público para fotos de pets
INSERT INTO storage.buckets (id, name, public)
  VALUES ('pet-photos', 'pet-photos', true)
  ON CONFLICT DO NOTHING;

-- Políticas de storage para fotos de pets
CREATE POLICY "pet_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pet-photos');

CREATE POLICY "pet_photos_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pet-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "pet_photos_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'pet-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "pet_photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'pet-photos' AND auth.uid() IS NOT NULL);
