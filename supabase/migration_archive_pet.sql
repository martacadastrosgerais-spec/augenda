-- Add archived flag to pets
ALTER TABLE pets ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
