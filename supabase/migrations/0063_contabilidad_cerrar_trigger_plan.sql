-- La función de trigger se usa internamente al crear entidades y no debe exponerse como RPC.
revoke all on function public.contabilidad_plan_al_crear_entidad() from public,anon,authenticated;
grant execute on function public.contabilidad_plan_al_crear_entidad() to service_role;
