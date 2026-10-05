-- Historial inicial extraído de CONTABILIDAD_COPROACTIVA.xlsx.
-- Se conserva el texto original de glosas y la numeración de asientos.

do $$
declare
  v_entidad uuid;
  v_asiento uuid;
  j jsonb;
  l jsonb;
begin
  select id into v_entidad
  from public.contabilidad_entidades
  where nombre='Coproactiva Administración SpA' and tipo='empresa'
  order by creado_en
  limit 1;

  if v_entidad is null then
    insert into public.contabilidad_entidades(nombre,tipo,moneda,activa)
    values ('Coproactiva Administración SpA','empresa','CLP',true)
    returning id into v_entidad;
  end if;

  if exists (
    select 1 from public.contabilidad_asientos
    where entidad_id=v_entidad and referencia='CONTABILIDAD_COPROACTIVA.xlsx'
  ) then
    return;
  end if;

  for j in select value from jsonb_array_elements('[{"numero":1,"fecha":"2026-04-02","glosa":"Socios Francisco y Osmar suscriben copital 1000000 equivalente a 1000 acciones, en una proporcion de 50/50","lineas":[{"codigo":"1107","debe":1000000,"haber":0,"glosa":"Socios Francisco y Osmar suscriben copital 1000000 equivalente a 1000 acciones, en una proporcion de 50/50","orden":1},{"codigo":"3101","debe":0,"haber":1000000,"glosa":"Socios Francisco y Osmar suscriben copital 1000000 equivalente a 1000 acciones, en una proporcion de 50/51","orden":2}]},{"numero":2,"fecha":"2026-04-20","glosa":"Domino Pagina web, Pago a Nic Chile con Cta Cte socio Francisco (BOLETA)","lineas":[{"codigo":"5107","debe":9990,"haber":0,"glosa":"Domino Pagina web, Pago a Nic Chile con Cta Cte socio Francisco (BOLETA)","orden":1},{"codigo":"2108","debe":0,"haber":9990,"glosa":"Domino Pagina web, Pago a Nic Chile con Cta Cte socio Francisco (BOLETA)","orden":2}]},{"numero":3,"fecha":"2026-04-27","glosa":"Curso Claves de finanazas en Condominios","lineas":[{"codigo":"5108","debe":120000,"haber":0,"glosa":"Curso Claves de finanazas en Condominios","orden":1},{"codigo":"2109","debe":0,"haber":120000,"glosa":"Curso Claves de finanazas en Condominios","orden":2}]},{"numero":4,"fecha":"2026-05-14","glosa":"Desposito a cuenta cte empresa desde cta socio","lineas":[{"codigo":"1102","debe":10000,"haber":0,"glosa":"Desposito a cuenta cte empresa desde cta socio","orden":1},{"codigo":"2109","debe":0,"haber":10000,"glosa":"Desposito a cuenta cte empresa desde cta socio","orden":2}]},{"numero":5,"fecha":"2026-06-01","glosa":"Suscripcion workspace","lineas":[{"codigo":"5107","debe":778,"haber":0,"glosa":"Suscripcion workspace","orden":1},{"codigo":"1102","debe":0,"haber":778,"glosa":"Suscripcion workspace","orden":2}]},{"numero":6,"fecha":"2026-06-01","glosa":"Comisión Tarjeta debito pago google workspace","lineas":[{"codigo":"5105","debe":12,"haber":0,"glosa":"Comisión Tarjeta debito pago google workspace","orden":1},{"codigo":"1102","debe":0,"haber":12,"glosa":"Comisión Tarjeta debito pago google workspace","orden":2}]},{"numero":7,"fecha":"2026-07-01","glosa":"Suscripción Julio Google workspace","lineas":[{"codigo":"5107","debe":8021,"haber":0,"glosa":"Suscripción Julio Google workspace","orden":1},{"codigo":"5105","debe":121,"haber":0,"glosa":"Suscripción Julio Google workspace","orden":2},{"codigo":"1102","debe":0,"haber":8142,"glosa":"Suscripción Julio Google workspace","orden":3}]},{"numero":8,"fecha":"2026-08-01","glosa":"Transferencia Socio Osmar ","lineas":[{"codigo":"1102","debe":10000,"haber":0,"glosa":"Transferencia Socio Osmar ","orden":1},{"codigo":"2109","debe":0,"haber":10000,"glosa":"Transferencia Socio Osmar ","orden":2}]},{"numero":9,"fecha":"2026-08-01","glosa":"Suscripcion Google Workspace Agosto","lineas":[{"codigo":"5107","debe":8016,"haber":0,"glosa":"Suscripcion Google Workspace Agosto","orden":1},{"codigo":"1102","debe":0,"haber":8016,"glosa":"Suscripcion Google Workspace Agosto","orden":2}]},{"numero":10,"fecha":"2026-08-03","glosa":"Comision por compa suscripcion worksapce Agosto","lineas":[{"codigo":"5105","debe":121,"haber":0,"glosa":"Comision por compa suscripcion worksapce Agosto","orden":1},{"codigo":"1102","debe":0,"haber":121,"glosa":"Comision por compa suscripcion worksapce Agosto","orden":2}]},{"numero":11,"fecha":"2026-08-20","glosa":"Aporte Transferencia Socio Francisco","lineas":[{"codigo":"1102","debe":10000,"haber":0,"glosa":"Aporte Transferencia Socio Francisco","orden":1},{"codigo":"2108","debe":0,"haber":10000,"glosa":"Aporte Transferencia Socio Francisco","orden":2}]},{"numero":12,"fecha":"2026-08-20","glosa":"Ajuste IVA Interés Tarjeta Débito, Asiento 6 - 7 -10","lineas":[{"codigo":"1104","debe":40,"haber":0,"glosa":"Ajuste IVA Interés Tarjeta Débito, Asiento 6 - 7 -10","orden":1},{"codigo":"5105","debe":0,"haber":40,"glosa":"Ajuste IVA Interés Tarjeta Débito, Asiento 6 - 7 - 10","orden":2}]},{"numero":13,"fecha":"2026-08-20","glosa":"Comisión Mantencion CTA CTE","lineas":[{"codigo":"5105","debe":5106,"haber":0,"glosa":"Comisión Mantencion CTA CTE","orden":1},{"codigo":"1104","debe":970,"haber":0,"glosa":"Comisión Mantencion CTA CTE","orden":2},{"codigo":"1102","debe":0,"haber":6076,"glosa":"Comisión Mantencion CTA CTE","orden":3}]},{"numero":14,"fecha":"2026-09-01","glosa":"Aporte transferencia Socio Osmar","lineas":[{"codigo":"1102","debe":10000,"haber":0,"glosa":"Aporte transferencia Socio Osmar","orden":1},{"codigo":"2109","debe":0,"haber":10000,"glosa":"Aporte transferencia Socio Osmar","orden":2}]},{"numero":15,"fecha":"2026-10-02","glosa":"Suscripcion Workspace Google Septiembre","lineas":[{"codigo":"5107","debe":8038,"haber":0,"glosa":"Suscripcion Workspace Google Septiembre","orden":1},{"codigo":"1102","debe":0,"haber":8038,"glosa":"Suscripcion Workspace Google Septiembre","orden":2}]},{"numero":16,"fecha":"2026-09-01","glosa":"Comisión pago Workspace compra internacional","lineas":[{"codigo":"5105","debe":102,"haber":0,"glosa":"Comisión pago Workspace compra internacional","orden":1},{"codigo":"1104","debe":19,"haber":0,"glosa":"Comisión pago Workspace compra internacional","orden":2},{"codigo":"1102","debe":0,"haber":121,"glosa":"Comisión pago Workspace compra internacional","orden":3}]},{"numero":17,"fecha":"2026-09-07","glosa":"Comisión Cta cte","lineas":[{"codigo":"5105","debe":5110,"haber":0,"glosa":"Comisión Cta cte","orden":1},{"codigo":"1104","debe":971,"haber":0,"glosa":"Comisión Cta cte","orden":2},{"codigo":"1102","debe":0,"haber":6081,"glosa":"Comisión Cta cte","orden":3}]},{"numero":18,"fecha":"2026-09-20","glosa":"Declaración F29 Junio-Agosto","lineas":[{"codigo":"1106","debe":1010,"haber":0,"glosa":"Declaración F29 Junio-Agosto","orden":1},{"codigo":"1104","debe":0,"haber":1010,"glosa":"Declaración F29 Junio-Agosto","orden":2}]},{"numero":19,"fecha":"2026-10-01","glosa":"Aporte Transferencia Socio Francisco","lineas":[{"codigo":"1102","debe":20000,"haber":0,"glosa":"Aporte Transferencia Socio Francisco","orden":1},{"codigo":"2108","debe":0,"haber":20000,"glosa":"Aporte Transferencia Socio Francisco","orden":2}]},{"numero":20,"fecha":"2026-09-01","glosa":"Curso Gestión Laboral y calculo de Reuneraciones","lineas":[{"codigo":"5108","debe":96000,"haber":0,"glosa":"Curso Gestión Laboral y calculo de Reuneraciones","orden":1},{"codigo":"2109","debe":0,"haber":96000,"glosa":"Curso Gestión Laboral y calculo de Reuneraciones","orden":2}]},{"numero":21,"fecha":"2026-10-01","glosa":"Suscripción Google Workspace Oct","lineas":[{"codigo":"5107","debe":8060,"haber":0,"glosa":"Suscripción Google Workspace Oct","orden":1},{"codigo":"1102","debe":0,"haber":8060,"glosa":"Suscripción Google Workspace Oct","orden":2}]}]'::jsonb)
  loop
    insert into public.contabilidad_asientos(
      entidad_id,numero,fecha,glosa,estado,origen,referencia
    )
    values (
      v_entidad,
      (j->>'numero')::integer,
      (j->>'fecha')::date,
      j->>'glosa',
      'contabilizado',
      'importacion_excel',
      'CONTABILIDAD_COPROACTIVA.xlsx'
    )
    returning id into v_asiento;

    for l in select value from jsonb_array_elements(j->'lineas')
    loop
      insert into public.contabilidad_asiento_lineas(
        asiento_id,cuenta_id,orden,debe,haber,glosa
      )
      select
        v_asiento,
        c.id,
        (l->>'orden')::integer,
        (l->>'debe')::numeric,
        (l->>'haber')::numeric,
        l->>'glosa'
      from public.contabilidad_cuentas c
      where c.entidad_id=v_entidad and c.codigo=l->>'codigo';

      if not found then
        raise exception 'No existe la cuenta % para importar el asiento %.',
          l->>'codigo',j->>'numero';
      end if;
    end loop;
  end loop;
end $$;
