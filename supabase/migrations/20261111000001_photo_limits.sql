-- Security hardening for the photo bucket.
-- The app only ever uploads resized WebP or JPEG photos of a few hundred KB, but the bucket itself
-- accepted any file of any type. Limit it to images of at most 10 MB, so nobody can use a household
-- folder to store or share other kinds of files (or very large ones) by calling storage directly.
-- Existing photos are untouched; this only applies to new uploads.
update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'item-photos';
