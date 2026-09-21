-- 013_anonymous_identities.sql
-- Assign consistent anonymous identities to users for privacy enforcement

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'anonymous_number'
    ) THEN
        ALTER TABLE users ADD COLUMN anonymous_number SERIAL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'anonymous_pseudonym'
    ) THEN
        ALTER TABLE users ADD COLUMN anonymous_pseudonym VARCHAR(100);
    END IF;
END $$;

-- Populate existing users with consistent anonymous pseudonyms
UPDATE users 
SET anonymous_pseudonym = 'Anonymous #' || LPAD(anonymous_number::text, 2, '0')
WHERE anonymous_pseudonym IS NULL;

-- Create index for faster lookup on pseudonym
CREATE INDEX IF NOT EXISTS idx_users_anonymous_pseudonym ON users(anonymous_pseudonym);
