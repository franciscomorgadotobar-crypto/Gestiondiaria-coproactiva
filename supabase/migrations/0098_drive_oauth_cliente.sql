-- ID público del cliente OAuth (no es secreto). Su valor se carga en el proyecto,
-- no en el repositorio. El secreto del cliente vive solo en los secretos de Edge
-- Functions (GOOGLE_OAUTH_CLIENT_SECRET).
alter table public.drive_configuracion add column if not exists oauth_client_id text;
