-- Diagnóstico comercial: quién lo completa, cuántos hay por prospecto y en
-- qué etapa queda el prospecto.
--
-- 1. Solo lectura para admin y jefatura. Lo programan (crean el diagnóstico,
--    lo que copia sus preguntas) y lo ven, pero las respuestas y el
--    resultado los escribe solo un superadministrador. Van como políticas
--    restrictivas: se suman a las que ya existen sin reescribirlas.
-- 2. Un diagnóstico vigente por prospecto: el Pipeline ya no ofrece
--    "Iniciar diagnóstico" si hay uno, y la base no admite un segundo
--    (salvo que el anterior esté anulado).
-- 3. Crear el diagnóstico pasa el prospecto a la etapa Diagnóstico si
--    estaba en Nuevo o Contacto. Si ya estaba más adelante, no retrocede.

create or replace function public.es_control_diagnostico(cid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select es_diagnostico from controles where id = cid), false);
$$;
revoke all on function public.es_control_diagnostico(uuid) from public, anon;
grant execute on function public.es_control_diagnostico(uuid) to authenticated;

-- 1. Respuestas y resultado: solo superadmin.
drop policy if exists control_items_diagnostico_edita_superadmin on public.control_items;
create policy control_items_diagnostico_edita_superadmin on public.control_items
  as restrictive for update to authenticated
  using (not es_control_diagnostico(control_id) or es_superadmin())
  with check (not es_control_diagnostico(control_id) or es_superadmin());

drop policy if exists control_items_diagnostico_borra_superadmin on public.control_items;
create policy control_items_diagnostico_borra_superadmin on public.control_items
  as restrictive for delete to authenticated
  using (not es_control_diagnostico(control_id) or es_superadmin());

drop policy if exists diagnosticos_resultado_crea_superadmin on public.diagnosticos_resultado;
create policy diagnosticos_resultado_crea_superadmin on public.diagnosticos_resultado
  as restrictive for insert to authenticated
  with check (es_superadmin());

drop policy if exists diagnosticos_resultado_edita_superadmin on public.diagnosticos_resultado;
create policy diagnosticos_resultado_edita_superadmin on public.diagnosticos_resultado
  as restrictive for update to authenticated
  using (es_superadmin())
  with check (es_superadmin());

drop policy if exists diagnosticos_resultado_borra_superadmin on public.diagnosticos_resultado;
create policy diagnosticos_resultado_borra_superadmin on public.diagnosticos_resultado
  as restrictive for delete to authenticated
  using (es_superadmin());

-- 2. Un diagnóstico vigente por prospecto.
create unique index if not exists controles_un_diagnostico_por_prospecto
  on public.controles (prospecto_id)
  where es_diagnostico and estado <> 'anulado';

-- 3. Etapa del prospecto al crear el diagnóstico.
create or replace function public.prospecto_a_diagnostico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update prospectos
     set etapa = 'diagnostico',
         fecha_ultima_interaccion = now()
   where id = new.prospecto_id
     and etapa in ('nuevo', 'contacto');
  return new;
end;
$$;
revoke all on function public.prospecto_a_diagnostico() from public, anon, authenticated;

drop trigger if exists controles_prospecto_a_diagnostico on public.controles;
create trigger controles_prospecto_a_diagnostico
  after insert on public.controles
  for each row
  when (new.es_diagnostico and new.prospecto_id is not null)
  execute function public.prospecto_a_diagnostico();
