update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/webp', 'video/mp4', 'video/webm']
where id = 'school-website-assets';
