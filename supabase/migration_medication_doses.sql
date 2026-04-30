-- Epic 4: Confirmação de dose
CREATE TABLE IF NOT EXISTS medication_doses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id   UUID        NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  pet_id          UUID        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  administered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  administered_by TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE medication_doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage doses for their pets"
  ON medication_doses
  FOR ALL
  USING (
    pet_id IN (
      SELECT id FROM pets WHERE user_id = auth.uid()
      UNION
      SELECT pet_id FROM pet_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS medication_doses_medication_id_idx ON medication_doses(medication_id);
CREATE INDEX IF NOT EXISTS medication_doses_pet_id_idx ON medication_doses(pet_id);
CREATE INDEX IF NOT EXISTS medication_doses_administered_at_idx ON medication_doses(administered_at DESC);
