-- Schedule the cleanup-voices function to run every hour
SELECT cron.schedule(
  'cleanup-elevenlabs-voices',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://dqdesuxtqragmjyggnkz.supabase.co/functions/v1/cleanup-voices',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZGVzdXh0cXJhZ21qeWdnbmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTg0MjcsImV4cCI6MjA3NjI3NDQyN30.3SEN5F5V3a6hQFyhFgVi2qO3cW8wcJjkVSJJg3wwtUM"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);