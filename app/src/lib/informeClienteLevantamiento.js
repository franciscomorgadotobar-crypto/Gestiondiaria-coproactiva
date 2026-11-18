import {supabase} from './supabase';
import {informeHtml,imprimirInforme} from './informe';

/** Usa la misma plantilla de lectura/impresión que el personal en Control.jsx.
 * El cliente no obtiene acceso a la pantalla de edición ni a tablas internas.
 * Las respuestas se autorizan por RPC y las fotografías por Storage RLS.
 */
export async function abrirInformeClienteLevantamiento({controlId,clienteId=null,ventana}) {
  if(!controlId)throw new Error('No hay levantamiento seleccionado.');
  const {data,error}=await supabase.rpc('portal_levantamiento_detalle',{
    p_control_id:controlId,p_usuario_cliente:clienteId||null
  });
  if(error)throw new Error('No se pudo consultar el informe autorizado: '+error.message);
  if(!data?.levantamiento)throw new Error('El informe no está disponible.');

  const adjuntos=(data.adjuntos||[]).filter(a=>a.storage_path);
  const rutas=[...new Set(adjuntos.map(a=>a.storage_path))];
  const urls=new Map();
  // Igual que el informe interno: URL firmada y carga nativa de img en HTML.
  // No descargar fotografías con fetch() ni convertirlas otra vez a JPEG.
  for(let inicio=0;inicio<rutas.length;inicio+=25){
    const lote=rutas.slice(inicio,inicio+25);
    const {data:firmadas,error:fallo}=await supabase.storage
      .from('evidencia').createSignedUrls(lote,3600);
    if(fallo)throw new Error('No se pudieron autorizar las fotografías del informe. Reintenta con conexión.');
    for(const foto of firmadas||[]){
      if(foto.path&&foto.signedUrl)urls.set(foto.path,foto.signedUrl);
    }
  }
  if(urls.size!==rutas.length)throw new Error('No se pudieron cargar todas las evidencias del informe.');

  const porItem=new Map();
  const firmas=[];
  for(const adjunto of adjuntos){
    const foto={
      url:urls.get(adjunto.storage_path),
      criterio_id:adjunto.criterio_id||null,
      descripcion:adjunto.descripcion||adjunto.nombre||''
    };
    if(adjunto.clase==='firma'){
      firmas.push({...foto,nombre:adjunto.firmante_nombre||'',rut:adjunto.firmante_rut||''});
      continue;
    }
    if(!adjunto.control_item_id)continue;
    const clave=String(adjunto.control_item_id);
    if(!porItem.has(clave))porItem.set(clave,[]);
    porItem.get(clave).push(foto);
  }

  const categoriasPorNombre=new Map();
  for(const item of data.items||[]){
    const nombre=item.grupo||'Sin categoría';
    if(!categoriasPorNombre.has(nombre)){
      categoriasPorNombre.set(nombre,{
        nombre,descripcion:item.config?.descripcion_categoria||'',items:[]
      });
    }
    const categoria=categoriasPorNombre.get(nombre);
    if(!categoria.descripcion&&item.config?.descripcion_categoria){
      categoria.descripcion=item.config.descripcion_categoria;
    }
    categoria.items.push({
      texto:item.texto,descripcion:item.ayuda||'',
      estado:item.estado,nota:item.nota,
      tipo_ingreso:item.tipo_ingreso,config:item.config,
      respuesta:item.respuesta,fotos:porItem.get(String(item.id))||[]
    });
  }

  const levantamiento=data.levantamiento;
  const html=informeHtml({
    soloLecturaCliente:true,
    comunidad:{
      nombre:levantamiento.comunidad_nombre||'Comunidad',
      direccion:levantamiento.comunidad_direccion||'',
      comuna:levantamiento.comunidad_comuna||''
    },
    control:{
      plantilla_nombre:levantamiento.plantilla_nombre,
      periodo:levantamiento.periodo,
      fecha_levantamiento:levantamiento.programado_para||levantamiento.creado_en,
      estado:levantamiento.estado,
      enviado_en:levantamiento.enviado_en,
      creado_en:levantamiento.creado_en,
      responsable:levantamiento.responsable_nombre||'Coproactiva'
      // El cliente no recibe ni consulta motivos de check-in administrativo.
    },
    logo:import.meta.env.BASE_URL+'logo-coproactiva.svg',
    categorias:[...categoriasPorNombre.values()],
    firmas
  });
  if(!imprimirInforme(html,ventana)){
    throw new Error('El navegador bloqueó la apertura del informe. Habilita ventanas emergentes.');
  }
  return true;
}
