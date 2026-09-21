-- 012_content_moderation.sql
-- Content moderation records and review queue

DO $$ BEGIN
    CREATE TYPE moderation_decision AS ENUM ('approved', 'rejected', 'escalated', 'auto_flagged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(50) NOT NULL, -- 'post', 'confession', 'comment'
    content_id UUID NOT NULL,
    flagged_reason VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    status moderation_decision NOT NULL DEFAULT 'auto_flagged',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mod_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_mod_queue_content ON moderation_queue(content_type, content_id);
