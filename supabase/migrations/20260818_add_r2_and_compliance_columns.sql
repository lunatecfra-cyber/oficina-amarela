-- Video URLs (R2/S3)
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS raw_video_url TEXT,
ADD COLUMN IF NOT EXISTS delivery_video_url TEXT;

-- Campaign / Regulatory columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS watermark TEXT,
ADD COLUMN IF NOT EXISTS campaign_tax_id TEXT,
ADD COLUMN IF NOT EXISTS voter_id TEXT;

ALTER TABLE missions
ADD COLUMN IF NOT EXISTS watermark TEXT,
ADD COLUMN IF NOT EXISTS campaign_tax_id TEXT,
ADD COLUMN IF NOT EXISTS voter_id TEXT;
