-- 014_performance_indexes.sql
-- Production query optimization: Composite indexes for cursor-based pagination and zero-sort feed scans

-- Posts cursor feed (active, non-deleted, sorted by created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_posts_feed_cursor 
ON posts (created_at DESC, id DESC) 
WHERE deleted_at IS NULL AND status = 'active';

-- Posts tag-filtered feed
CREATE INDEX IF NOT EXISTS idx_posts_tag_feed 
ON posts (tag, created_at DESC, id DESC) 
WHERE deleted_at IS NULL AND status = 'active';

-- Confessions cursor feed
CREATE INDEX IF NOT EXISTS idx_confessions_feed_cursor 
ON confessions (created_at DESC, id DESC) 
WHERE deleted_at IS NULL AND status = 'active';

-- Confessions category-filtered feed
CREATE INDEX IF NOT EXISTS idx_confessions_category_feed 
ON confessions (category, created_at DESC, id DESC) 
WHERE deleted_at IS NULL AND status = 'active';

-- Events upcoming feed (ordered by event_date ASC, event_time ASC)
CREATE INDEX IF NOT EXISTS idx_events_upcoming_cursor 
ON events (event_date ASC, event_time ASC, id ASC) 
WHERE deleted_at IS NULL AND status = 'active';

-- Comments index for fast post/confession comment lookups
CREATE INDEX IF NOT EXISTS idx_comments_post_perf 
ON comments (post_id, created_at ASC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_confession_perf 
ON comments (confession_id, created_at ASC) 
WHERE deleted_at IS NULL;
