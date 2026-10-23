-- Orden operativo de los compromisos de Reserva Santa Clara.
alter table public.compromisos_administracion add column if not exists orden integer;
update public.compromisos_administracion c set orden=v.orden from (values
 ('Recepción de antecedentes del proyecto',1),
 ('Informe de estado documental',2),
 ('Habilitación tributaria y bancaria',3),
 ('Recorrido e inventario de bienes comunes Etapa I',4),
 ('Cronograma de puesta en marcha',5),
 ('Preparación operativa de la comunidad',6),
 ('Registro de aportes de financiamiento inicial',7),
 ('Informe de puesta en marcha',8),
 ('Administración y conservación de bienes comunes',9),
 ('Atención presencial semanal',10),
 ('Reunión mensual de coordinación',11),
 ('Gestión de incidencias por nivel de respuesta',12),
 ('Escalamiento de incidencias de nivel Alto',13),
 ('Notificación de gastos de emergencia',14),
 ('Seguimiento de observaciones de postventa',15),
 ('Control y respaldo de pagos comunitarios',16),
 ('Gestión de cobranza extrajudicial',17),
 ('Rendición mensual documentada',18),
 ('Presupuesto estimativo anual',19),
 ('Convocatoria de primera asamblea',20),
 ('Balance anual para asamblea',21),
 ('Coordinación de incorporación de Etapa II',22),
 ('Acta de Condiciones Etapa II',23),
 ('Informe de gestión al término',24)
) as v(titulo,orden)
where c.comunidad_id='deaf0183-72e5-4fe7-8fb9-45de53df1253'::uuid and c.titulo=v.titulo;
