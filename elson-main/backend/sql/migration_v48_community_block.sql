-- v48: per-user community posting block.
-- An admin can bar a specific user from posting/commenting in the community
-- (distinct from the global top-N gate). Default false = everyone can post.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_blocked boolean NOT NULL DEFAULT false;
