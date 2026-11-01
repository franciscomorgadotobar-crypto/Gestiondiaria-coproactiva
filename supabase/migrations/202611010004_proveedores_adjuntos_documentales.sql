-- Historial de adjuntos físicos por comunicación, sin duplicar bytes.
-- La biblioteca conserva el archivo original; aquí quedan referencias y metadatos.
alter table public.proveedor_comunicaciones
  add column if not exists adjuntos jsonb not null default '[]'::jsonb;

comment on column public.proveedor_comunicaciones.adjuntos is
  'Metadatos históricos de los archivos enviados por SMTP: ID interno, origen, nombre, bytes y copia opcional en Drive. No almacena archivos binarios ni enlaces públicos.';
