import { supabase } from './supabase';

// Los indicadores siempre se calculan sobre tablas existentes y sujetos a RLS.
// Un error de consulta se representa como "—", nunca como un cero inventado.
const contar = tabla => supabase.from(tabla).select('id', { count:'exact', head:true });
const indicador = (nombre, ruta, consulta, nota = '') => ({ nombre, ruta, consulta, nota });
const fechaLocal = fecha =>
  [fecha.getFullYear(),String(fecha.getMonth()+1).padStart(2,'0'),String(fecha.getDate()).padStart(2,'0')].join('-');

async function resolver(definiciones) {
  const respuestas = await Promise.all(definiciones.map(async item => {
    try {
      const { count, error } = await item.consulta;
      return { nombre:item.nombre, ruta:item.ruta, nota:item.nota,
        valor:error ? null : (count ?? 0) };
    } catch {
      return { nombre:item.nombre, ruta:item.ruta, nota:item.nota, valor:null };
    }
  }));
  return respuestas;
}

export async function indicadoresHomeArea(id, usuarioId) {
  const hoy = new Date();
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+30);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  switch (id) {
    case 'comercial':
      return resolver([
        indicador('Prospectos registrados','/pipeline',contar('prospectos')),
        indicador('Prospectos nuevos','/pipeline?etapa=nuevo',contar('prospectos').eq('etapa','nuevo')),
        indicador('En propuesta','/pipeline?etapa=propuesta',contar('prospectos').eq('etapa','propuesta')),
        indicador('En negociación','/pipeline?etapa=negociacion',contar('prospectos').eq('etapa','negociacion'))
      ]);
    case 'operaciones':
      return resolver([
        indicador('Comunidades activas','/comunidades',contar('comunidades').eq('estado','activo')),
        indicador('Levantamientos pendientes','/inicio',contar('controles_con_avance').in('estado',['pendiente','en_curso','pausado'])),
        indicador('Compromisos abiertos','/compromisos',contar('compromisos_administracion').neq('estado','completado')),
        indicador('Mantenciones próximos 30 días','/mantenciones',
          contar('mantenimiento_actividades').eq('activa',true)
            .gte('proxima_exigible',fechaLocal(hoy)).lte('proxima_exigible',fechaLocal(hasta)),
          'Actividades vigentes con fecha programada')
      ]);
    case 'finanzas':
      return resolver([
        indicador('Entidades activas','/contabilidad/entidades',contar('contabilidad_entidades').eq('activa',true)),
        indicador('Asientos del mes','/contabilidad/asientos',
          contar('contabilidad_asientos').gte('fecha',fechaLocal(inicioMes))
            .lte('fecha',fechaLocal(hoy))),
        indicador('Asientos contabilizados','/contabilidad/asientos',
          contar('contabilidad_asientos').eq('estado','contabilizado')),
        indicador('Total de asientos','/contabilidad/asientos',contar('contabilidad_asientos'))
      ]);
    case 'administracion':
      return resolver([
        indicador('Usuarios internos activos','/equipo',
          contar('perfiles').eq('activo',true).neq('rol','cliente')),
        indicador('Usuarios clientes activos','/clientes',
          contar('perfiles').eq('activo',true).eq('rol','cliente')),
        indicador('Accesos de clientes activos','/clientes',
          contar('portal_cliente_comunidades').eq('activa',true))
      ]);
    case 'general': {
      const [avisos, biblioteca] = await Promise.all([
        resolver([
          indicador('Mis avisos sin leer','/notificaciones',
            contar('notificaciones').eq('destinatario_id',usuarioId).eq('leida',false)),
          indicador('Alertas de mantención sin leer','/notificaciones',
            contar('notificaciones_mantenimiento').eq('destinatario_id',usuarioId).eq('leida',false))
        ]),
        import('../datos/ley21442.contenidos.json').catch(() => null)
      ]);
      const contenidos = biblioteca?.default?.contenidos;
      return [
        { nombre:'Contenidos educativos',ruta:'/conocimientos',valor:Array.isArray(contenidos)?contenidos.length:null },
        { nombre:'Cápsulas automáticas',ruta:'/conocimientos',
          valor:Array.isArray(contenidos)?contenidos.filter(c=>c.automatico).length:null },
        ...avisos
      ];
    }
    default: return [];
  }
}
