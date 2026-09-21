-- 015_uploads.sql
-- Create uploads table for tracking verified user uploaded assets, metadata, and storage references

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    is_attached BOOLEAN NOT NULL DEFAULT FALSE,
    attached_to_type VARCHAR(50),
    attached_to_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uploads_owner_id ON uploads(owner_id);
CREATE INDEX IF NOT EXISTS idx_uploads_storage_key ON uploads(storage_key);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at DESC);
