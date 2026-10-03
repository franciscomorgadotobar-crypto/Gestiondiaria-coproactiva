-- La función solo existe para el trigger de perfiles. No debe exponerse como RPC.
revoke all on function public.asignar_tutoriales_a_nuevo_perfil() from public;
revoke all on function public.asignar_tutoriales_a_nuevo_perfil() from anon;
revoke all on function public.asignar_tutoriales_a_nuevo_perfil() from authenticated;
