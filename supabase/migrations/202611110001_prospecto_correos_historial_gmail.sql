-- Histórico de Gmail en la ficha del prospecto.
--
-- Hasta ahora el historial mostraba solo lo enviado desde el CRM. Los correos
-- anteriores (enviados y recibidos en contacto@coproactiva.cl) se importan una
-- vez a esta misma tabla, marcados con origen 'gmail', para que la ficha muestre
-- la conversación completa sin cambiar de dónde lee.
--
-- Un correo importado no tiene autor en el CRM (se envió desde Gmail o lo
-- escribió el prospecto), así que enviado_por pasa a ser opcional, pero solo
-- para esas filas.

alter table public.prospecto_correos alter column enviado_por drop not null;

alter table public.prospecto_correos
  add column if not exists origen text not null default 'crm',
  add column if not exists remitente text,
  add column if not exists gmail_message_id text;

alter table public.prospecto_correos drop constraint if exists prospecto_correos_origen_check;
alter table public.prospecto_correos add constraint prospecto_correos_origen_check
  check (origen in ('crm', 'gmail'));

alter table public.prospecto_correos drop constraint if exists prospecto_correos_autor_check;
alter table public.prospecto_correos add constraint prospecto_correos_autor_check
  check (origen = 'gmail' or enviado_por is not null);

-- 'recibido': correo que escribió el prospecto.
alter table public.prospecto_correos drop constraint if exists prospecto_correos_estado_check;
alter table public.prospecto_correos add constraint prospecto_correos_estado_check
  check (estado in ('pendiente', 'enviado', 'fallido', 'recibido'));

-- Un mismo correo de Gmail no se importa dos veces para el mismo prospecto.
create unique index if not exists prospecto_correos_gmail_unico
  on public.prospecto_correos (prospecto_id, gmail_message_id);
