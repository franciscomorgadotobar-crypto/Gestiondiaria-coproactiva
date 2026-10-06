-- Bitácora: correlativo por usuario/fecha y cierre de incidencias por admin/superadmin.

alter table public.bitacora_registros
  add column if not exists correlativo text,
  add column if not exists estado text not null default 'abierta',
  add column if not exists finalizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists finalizado_en timestamptz,
  add column if not exists cierre_observacion text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='bitacora_registros_estado_check'
  ) then
    alter table public.bitacora_registros
      add constraint bitacora_registros_estado_check
      check (estado in ('abierta','finalizada'));
  end if;
end $$;

create or replace function public.bitacora_iniciales_usuario(p_usuario uuid)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_nombre text;
  v_limpio text;
  v_partes text[];
  v_iniciales text;
begin
  select nombre into v_nombre from public.perfiles where id=p_usuario;
  v_limpio := upper(trim(regexp_replace(
    translate(coalesce(v_nombre,'XX'),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'),
    '[^A-Za-z0-9 ]','','g'
  )));
  v_partes := regexp_split_to_array(v_limpio,'\s+');

  if coalesce(array_length(v_partes,1),0) >= 2 then
    v_iniciales := left(v_partes[1],1) || left(v_partes[array_length(v_partes,1)],1);
  else
    v_iniciales := left(coalesce(v_partes[1],'XX') || 'X',2);
  end if;

  return left(coalesce(nullif(v_iniciales,''),'XX') || 'XX',2);
end;
$$;

revoke all on function public.bitacora_iniciales_usuario(uuid) from public,anon;
grant execute on function public.bitacora_iniciales_usuario(uuid) to authenticated;

create or replace function public.bitacora_generar_correlativo(
  p_usuario uuid,
  p_fecha timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_prefijo text;
  v_seq integer;
begin
  v_prefijo := public.bitacora_iniciales_usuario(p_usuario)
    || to_char(timezone('America/Santiago',coalesce(p_fecha,now())),'DDMM')
    || '-';

  perform pg_advisory_xact_lock(hashtextextended(v_prefijo,0));

  select coalesce(max(
    case
      when correlativo ~ ('^' || v_prefijo || '[0-9]+$')
      then substring(correlativo from '([0-9]+)$')::integer
      else null
    end
  ),0)+1
  into v_seq
  from public.bitacora_registros
  where correlativo like v_prefijo || '%';

  return v_prefijo || lpad(v_seq::text,2,'0');
end;
$$;

revoke all on function public.bitacora_generar_correlativo(uuid,timestamptz) from public,anon;
grant execute on function public.bitacora_generar_correlativo(uuid,timestamptz) to authenticated;

create or replace function public.bitacora_asignar_correlativo()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if nullif(btrim(coalesce(new.correlativo,'')),'') is null then
    new.correlativo := public.bitacora_generar_correlativo(
      new.registrado_por,
      coalesce(new.registrado_en,now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bitacora_asignar_correlativo on public.bitacora_registros;
create trigger trg_bitacora_asignar_correlativo
before insert on public.bitacora_registros
for each row execute function public.bitacora_asignar_correlativo();

do $$
declare
  r record;
begin
  for r in
    select id,registrado_por,registrado_en
    from public.bitacora_registros
    where correlativo is null
    order by registrado_en,id
  loop
    update public.bitacora_registros
    set correlativo=public.bitacora_generar_correlativo(r.registrado_por,r.registrado_en)
    where id=r.id;
  end loop;
end $$;

alter table public.bitacora_registros
  alter column correlativo set not null;

create unique index if not exists bitacora_registros_correlativo_uidx
  on public.bitacora_registros(correlativo);

create index if not exists bitacora_registros_estado_fecha
  on public.bitacora_registros(estado,nivel,registrado_en desc);

create or replace function public.bitacora_finalizar(
  p_bitacora_id uuid,
  p_observacion text default null
)
returns public.bitacora_registros
language plpgsql
security definer
set search_path=public
as $$
declare
  v_rol text;
  v_reg public.bitacora_registros%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión requerida.'; end if;

  select rol::text into v_rol
  from public.perfiles
  where id=auth.uid() and activo;

  if v_rol not in ('superadmin','admin') then
    raise exception 'Solo administradores y superadministradores pueden finalizar incidencias.';
  end if;

  select * into v_reg
  from public.bitacora_registros
  where id=p_bitacora_id
  for update;

  if not found then raise exception 'Registro no encontrado.'; end if;

  if v_reg.nivel not in ('atencion','urgente') then
    raise exception 'Solo se pueden finalizar registros que requieren atención.';
  end if;

  if v_reg.estado='finalizada' then
    return v_reg;
  end if;

  update public.bitacora_registros
  set estado='finalizada',
      finalizado_por=auth.uid(),
      finalizado_en=now(),
      cierre_observacion=nullif(btrim(coalesce(p_observacion,'')),''),
      editado_en=now()
  where id=p_bitacora_id
  returning * into v_reg;

  update public.notificaciones
  set leida=true,
      leida_en=coalesce(leida_en,now())
  where bitacora_id=p_bitacora_id
    and not leida;

  return v_reg;
end;
$$;

revoke all on function public.bitacora_finalizar(uuid,text) from public,anon;
grant execute on function public.bitacora_finalizar(uuid,text) to authenticated;

drop function if exists public.bitacora_listar();

create function public.bitacora_listar()
returns table(
  id uuid,
  correlativo text,
  comunidad_id uuid,
  comunidad_nombre text,
  comunidad_comuna text,
  tipo_codigo text,
  tipo_nombre text,
  tipo_otro text,
  nivel text,
  estado text,
  titulo text,
  descripcion text,
  registrado_por uuid,
  registrado_por_nombre text,
  registrado_en timestamptz,
  finalizado_por uuid,
  finalizado_por_nombre text,
  finalizado_en timestamptz,
  cierre_observacion text,
  adjuntos integer
)
language sql
stable
security definer
set search_path=public
as $$
  select
    b.id,
    b.correlativo,
    b.comunidad_id,
    c.nombre,
    c.comuna,
    b.tipo_codigo,
    t.nombre,
    b.tipo_otro,
    b.nivel,
    b.estado,
    b.titulo,
    b.descripcion,
    b.registrado_por,
    p.nombre,
    b.registrado_en,
    b.finalizado_por,
    pf.nombre,
    b.finalizado_en,
    b.cierre_observacion,
    (select count(*)::integer from public.bitacora_adjuntos a where a.bitacora_id=b.id)
  from public.bitacora_registros b
  join public.comunidades c on c.id=b.comunidad_id
  join public.bitacora_tipos t on t.codigo=b.tipo_codigo
  join public.perfiles p on p.id=b.registrado_por
  left join public.perfiles pf on pf.id=b.finalizado_por
  where public.bitacora_puede_ver_comunidad(b.comunidad_id)
  order by b.registrado_en desc;
$$;

revoke all on function public.bitacora_listar() from public,anon;
grant execute on function public.bitacora_listar() to authenticated;
