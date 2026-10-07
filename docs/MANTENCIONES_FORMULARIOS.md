# Formularios desde el plan de mantención

En Comunidades → Plan de mantención, el campo **Formulario** ofrece las plantillas activas de esa comunidad y las generales. Se excluye Diagnóstico comercial. Elegir un formulario completa el trabajo si estaba vacío; el trabajo sigue siendo editable y la frecuencia se define por separado.

Las actividades existentes también tienen un selector para vincular o cambiar el formulario. No se asignó una plantilla arbitraria a registros históricos. Una plantilla sin preguntas activas no se puede vincular.

**Abrir formulario** aparece en el plan, las visitas abiertas de la Agenda y el listado global de Mantenciones. Abre el renderer existente de levantamientos con la comunidad, plantilla y responsable del plan o de la visita. Si el responsable está inactivo, se asigna a quien lo abre.

Desde el plan se usa la primera visita abierta de la actividad, cuando existe. En ausencia de visita se utiliza el período definido por su fecha exigible. Abrir otra vez reutiliza el mismo control, incluso si ya fue enviado. Los controles anulados permiten crear un reemplazo. Una nueva visita o un nuevo período tienen un registro independiente.

La creación del control y la copia de sus preguntas ocurren en una transacción. Se conservan grupos, orden, ayudas, tipos de ingreso, configuración, obligatoriedad y requisitos de fotos. Cambiar la plantilla o el vínculo en el plan no modifica las preguntas de controles ya creados.

Abrir o enviar el formulario no registra por sí solo una ejecución de mantención ni adelanta la frecuencia. Se conserva la acción existente **Registrar ejecución** en la Agenda. Esta incorporación vincula los formularios al plan sin cambiar las reglas de cierre.

La función usa SECURITY INVOKER y las reglas de acceso existentes: admin, superadmin y jefatura activos con acceso a la comunidad. Los formularios ya asignados siguen ejecutándose con el sistema existente de controles.

Migración: `0087_mantenciones_formularios.sql`. Verificación con rollback: `supabase/tests/mantenciones-formularios.sql`; comprueba contexto, preguntas, idempotencia, historial, exclusión de plantillas vacías/comerciales/ajenas, visitas, roles y eliminación del plan sin pérdida de las preguntas copiadas.
