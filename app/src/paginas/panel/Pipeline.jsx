import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePestanaHistorial } from '../../lib/pestanasHistorial';
import { useSesion } from '../../lib/sesion';
import { inicioSegunArea } from '../../lib/area';
import './Pipeline.css';
import { useVolverGlobal, volverPorJerarquia } from '../../lib/navegacion';
import Confirmar from '../../componentes/Confirmar';
import DialogoCampos from '../../componentes/DialogoCampos';
import { prepararCarpetasDrive } from '../../lib/drive';
import {completarCorreo,validarBorradorCorreo} from '../../lib/plantillasCorreo';
import AdjuntosCorreo from '../../componentes/AdjuntosCorreo';
import CopiasCorreo from '../../componentes/CopiasCorreo';
import {prepararCopias} from '../../lib/copiasCorreo';

/* Pipeline comercial: leads y prospectos en un embudo hasta ganarse o perderse.
 *
 * No hay una tabla "leads" separada de "prospectos": un lead es simplemente un
 * prospecto en una etapa temprana (nuevo/contacto). Partirlos en dos tablas
 * solo existía en el CRM viejo porque Sheets obligaba a esa separación; acá no
 * hace falta, y evita el parche de "convertir lead en prospecto" de ese
 * sistema.
 *
 * Al ganar un prospecto se crea la comunidad real y queda enlazada: es el
 * puente hacia la operación (levantamientos, mantención, portal cliente).
 */

const ETAPAS = [
  ['nuevo', 'Nuevo'],
  ['contacto', 'Contacto'],
  ['diagnostico', 'Diagnóstico'],
  ['propuesta', 'Propuesta'],
  ['negociacion', 'Negociación'],
  ['ganado', 'Ganado'],
  ['perdido', 'Perdido']
];

// Estado del diagnóstico: los mismos chips que un levantamiento en el panel.
const ESTADO_DIAGNOSTICO = {
  pendiente: ['chip-pendiente', 'Pendiente'],
  en_curso: ['chip-alerta', 'En curso'],
  pausado: ['chip-pausado', 'En pausa'],
  enviado: ['chip-cumple', 'Enviado']
};
const LINEAS = { L1: 'Administración integral', L2: 'Nueva administración', L3: 'Asesoría externa' };

const TIPOS_SERVICIO = [
  ['administracion', 'Administración'],
  ['auditoria', 'Auditoría'],
  ['asesoria', 'Asesoría'],
  ['primera_administracion', 'Primera administración'],
  ['otro', 'Otro']
];

const VACIO = {
  nombre_condominio: '', direccion: '', comuna: '', unidades: '',
  nombre_contacto: '', cargo_contacto: '', telefono: '', email: '',
  tipo_servicio: '', fuente: '', responsable_id: '',
  proxima_accion: '', fecha_proxima_accion: '', observaciones: ''
};

function enlaceTelefono(valor, whatsapp = false) {
  const numeros=String(valor||'').replace(/\D/g,'');
  if (!numeros) return null;
  const internacional=numeros.length===9 && numeros.startsWith('9')?'56'+numeros:numeros;
  return whatsapp ? 'https://wa.me/'+internacional : 'tel:+'+internacional;
}

function fechaCL(valor, conHora = false) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-CL', conHora
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}


function asuntoAutomatico(plantilla, prospecto, nombreRemitente) {
  const cliente=String(prospecto?.nombre_condominio||prospecto?.nombre_contacto||'').trim();
  const asuntoBase=plantilla?.codigo==='04'
    ? 'Presentación Coproactiva y propuesta de reunión'
    : completarCorreo(plantilla?.asunto||plantilla?.nombre||'Contacto Coproactiva',prospecto,nombreRemitente).trim();
  if (!cliente || asuntoBase.toLocaleLowerCase('es').includes(cliente.toLocaleLowerCase('es'))) return asuntoBase.slice(0,160);
  if (/^Re:/i.test(asuntoBase)) return ('Correo de Coproactiva | '+cliente).slice(0,160);
  return (asuntoBase+' | '+cliente).slice(0,160);
}
export default function Pipeline() {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  const location = useLocation();
  const idAbiertoPorUrl = useRef(null);
  useVolverGlobal(() => volverPipeline());
  const [prospectos, setProspectos] = useState(null);
  const [diagnosticos, setDiagnosticos] = useState(new Map());   // prospecto_id → { control, resultado }
  const [equipo, setEquipo] = useState([]);
  const [error, setError] = useState(null);
  const [etapa, setEtapa] = usePestanaHistorial('etapa', 'nuevo', ETAPAS.map(([clave]) => clave));
  const [abierto, setAbierto] = useState(null);   // id en edición, o 'nuevo'
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [perdidaPendiente, setPerdidaPendiente] = useState(null);
  const [ganarPendiente, setGanarPendiente] = useState(null);
  const [eliminarPendiente,setEliminarPendiente]=useState(null);
  const [filtroResumen,setFiltroResumen]=useState(null);
  const [etapaFocalizada,setEtapaFocalizada]=useState(false);
  const [vistaCompletaMovil,setVistaCompletaMovil]=useState(false);
  const [arrastrandoId,setArrastrandoId]=useState(null);
  const [soltarEn,setSoltarEn]=useState('');
  const [correoProspecto, setCorreoProspecto] = useState(null);
  const [asuntoCorreo, setAsuntoCorreo] = useState('');
  const [mensajeCorreo, setMensajeCorreo] = useState('');
  const [ccCorreo,setCcCorreo]=useState('');
  const [ccoCorreo,setCcoCorreo]=useState('');
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [avisoCorreo, setAvisoCorreo] = useState(null);
  const [plantillasCorreo,setPlantillasCorreo] = useState([]);
  const [plantillaElegida,setPlantillaElegida] = useState('');
  const [varianteElegida,setVarianteElegida] = useState('principal');
  const [adjuntosCorreo,setAdjuntosCorreo] = useState([]);
  const [guardadoDriveCorreo,setGuardadoDriveCorreo] = useState(null);
  const [firmaCorreo,setFirmaCorreo]=useState(null);
  const [historialCorreos,setHistorialCorreos]=useState([]);
  const [historialCorreosCargando,setHistorialCorreosCargando]=useState(false);
  const [historialCorreosError,setHistorialCorreosError]=useState('');
  const [refrescarHistorial,setRefrescarHistorial]=useState(0);
  // El prospecto seleccionado y su subvista viven en la URL. Android y el
  // navegador conservan Atrás: embudo → ficha → editar/correo.
  const parametros = new URLSearchParams(location.search);
  const prospectoSeleccionadoId = parametros.get('prospecto');
  const accionSeleccionada = parametros.get('accion');
  const correoDestacado = parametros.get('correo');
  const prospectoSeleccionado = prospectos?.find(x => x.id === prospectoSeleccionadoId) ?? null;

  function navegarPipeline(params, state = null, replace = false) {
    navegar({pathname:'/pipeline',search:params.toString() ? '?' + params.toString() : ''},
      {state,replace,preventScrollReset:true});
  }
  function abrirGestion(p) {
    if (!p) return;
    setError(null);
    setAbierto(null);
    setCorreoProspecto(null);
    const params=new URLSearchParams(location.search);
    params.set('prospecto',p.id);
    params.delete('accion');
    navegarPipeline(params,{desdeEmbudo:true});
    window.scrollTo?.({top:0,behavior:'instant'});
  }
  function abrirAccion(accion) {
    const params=new URLSearchParams(location.search);
    params.set('accion',accion);
    navegarPipeline(params,{desdeFicha:true});
  }
  function volverFicha() {
    setGuardadoDriveCorreo(null);
    setAdjuntosCorreo([]);
    setCcCorreo('');setCcoCorreo('');
    setError(null);
    setAbierto(null);
    setCorreoProspecto(null);
    if (location.state?.desdeFicha) return navegar(-1);
    const params=new URLSearchParams(location.search);
    params.delete('accion');
    navegarPipeline(params,null,true);
  }
  function cerrarGestion() {
    setError(null);
    setAbierto(null);
    setCorreoProspecto(null);
    if (location.state?.desdeEmbudo) return navegar(-1);
    const params=new URLSearchParams(location.search);
    params.delete('prospecto');
    params.delete('accion');
    navegarPipeline(params,null,true);
  }
  function volverPipeline() {
    if (abierto==='nuevo') return cerrarForm();
    if (prospectoSeleccionado && (accionSeleccionada || abierto===prospectoSeleccionado.id || correoProspecto))
      return volverFicha();
    if (prospectoSeleccionado) return cerrarGestion();
    return volverPorJerarquia(navegar,'/pipeline');
  }
  useEffect(()=>{
    let activo=true;
    supabase.from('plantillas_correo_crm').select('id,codigo,nombre,categoria,uso,etapa_crm,adjunto_sugerido,asunto,cuerpo,variantes')
      .eq('activa',true).neq('categoria','Proveedores')
      .order('codigo',{ascending:true,nullsFirst:false}).then(({data,error})=>{
        if(activo&&!error)setPlantillasCorreo(data||[]);
      });
    return()=>{activo=false};
  },[]);

  async function cargar() {
    setError(null);
    const [rp, re, rd, rr] = await Promise.all([
      supabase.from('prospectos').select('*').order('creado_en', { ascending: false }),
      // Un cliente no es responsable de un lead: es externo, no parte del
      // equipo comercial.
      supabase.from('perfiles').select('id, nombre, rol, activo').eq('activo', true).neq('rol', 'cliente').order('nombre'),
      // El diagnóstico vigente de cada prospecto (uno por prospecto: la base
      // no admite un segundo salvo que el anterior esté anulado).
      supabase.from('controles')
        .select('id, prospecto_id, estado, responsable_id, programado_para, enviado_en')
        .eq('es_diagnostico', true).neq('estado', 'anulado'),
      supabase.from('diagnosticos_resultado').select('control_id, score, nivel, linea_sugerida, linea_elegida')
    ]);
    if (rp.error) return setError(rp.error.message);
    if (re.error) return setError(re.error.message);
    setProspectos(rp.data ?? []);
    setEquipo(re.data ?? []);
    // Sin diagnósticos legibles la tarjeta simplemente no los muestra.
    const resultados = new Map((rr.data ?? []).map(r => [r.control_id, r]));
    setDiagnosticos(new Map((rd.data ?? [])
      .filter(c => c.prospecto_id)
      .map(c => [c.prospecto_id, { control: c, resultado: resultados.get(c.id) ?? null }])));
  }

  useEffect(() => { cargar(); }, []);

  // Al usar Atrás/Adelante el estado del editor debe seguir a la URL.
  // Se preservan los formularios solo mientras su subvista está activa.
  useEffect(() => {
    if (accionSeleccionada!=='editar') setAbierto(x=>x==='nuevo'?x:null);
    if (accionSeleccionada!=='correo') setCorreoProspecto(null);
    if (!prospectoSeleccionado) return;
    if (accionSeleccionada==='correo') {
      if(correoProspecto?.id && correoProspecto.id!==prospectoSeleccionado.id){
        setGuardadoDriveCorreo(null);
        setAdjuntosCorreo([]);
      }
      setCorreoProspecto(x=>x?.id===prospectoSeleccionado.id?x:prospectoSeleccionado);
    }
    if (accionSeleccionada==='editar') {
      setForm({
        nombre_condominio:prospectoSeleccionado.nombre_condominio??'',
        direccion:prospectoSeleccionado.direccion??'',comuna:prospectoSeleccionado.comuna??'',
        unidades:prospectoSeleccionado.unidades??'',nombre_contacto:prospectoSeleccionado.nombre_contacto??'',
        cargo_contacto:prospectoSeleccionado.cargo_contacto??'',telefono:prospectoSeleccionado.telefono??'',
        email:prospectoSeleccionado.email??'',tipo_servicio:prospectoSeleccionado.tipo_servicio??'',
        fuente:prospectoSeleccionado.fuente??'',responsable_id:prospectoSeleccionado.responsable_id??'',
        proxima_accion:prospectoSeleccionado.proxima_accion??'',
        fecha_proxima_accion:prospectoSeleccionado.fecha_proxima_accion
          ?prospectoSeleccionado.fecha_proxima_accion.slice(0,16):'',
        observaciones:prospectoSeleccionado.observaciones??''
      });
      setAbierto(prospectoSeleccionado.id);
    }
  },[accionSeleccionada,prospectoSeleccionado?.id]);

  const porEtapa = useMemo(() => {
    const m = new Map(ETAPAS.map(([k]) => [k, []]));
    for (const p of prospectos ?? []) {
      if (!m.has(p.etapa)) m.set(p.etapa, []);
      m.get(p.etapa).push(p);
    }
    return m;
  }, [prospectos]);

  const activos = (prospectos ?? []).filter(p => p.etapa !== 'ganado' && p.etapa !== 'perdido').length;

  // Diagnósticos por hacer (no enviados) de prospectos vivos, los más
  // próximos primero. También aparecen en "Por hacer" de Operación: se ven
  // desde las dos áreas.
  const diagnosticosPendientes = useMemo(() => {
    const porId = new Map((prospectos ?? []).map(p => [p.id, p]));
    return [...diagnosticos.values()]
      .filter(d => d.control.estado !== 'enviado')
      .map(d => ({ ...d, prospecto: porId.get(d.control.prospecto_id) }))
      .filter(d => d.prospecto && d.prospecto.etapa !== 'perdido')
      .sort((a, b) => (a.control.programado_para ?? '9999').localeCompare(b.control.programado_para ?? '9999'));
  }, [diagnosticos, prospectos]);
  const ganadosMes = (prospectos ?? []).filter(p => {
    if (p.etapa !== 'ganado' || !p.editado_en) return false;
    const d = new Date(p.editado_en), h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth();
  }).length;
  const enDiagnostico = porEtapa.get('diagnostico')?.length ?? 0;
  const perdidos = porEtapa.get('perdido')?.length ?? 0;
  const esGanadoEsteMes = p => {
    if(p.etapa!=='ganado'||!p.editado_en)return false;
    const d=new Date(p.editado_en),h=new Date();
    return d.getFullYear()===h.getFullYear()&&d.getMonth()===h.getMonth();
  };
  const etapaVisible = clave => {
    if(filtroResumen==='activos') return clave!=='ganado'&&clave!=='perdido';
    if(filtroResumen==='diagnostico')return clave==='diagnostico';
    if(filtroResumen==='ganados')return clave==='ganado';
    if(filtroResumen==='perdidos')return clave==='perdido';
    return (vistaCompletaMovil&&!etapaFocalizada) || (!etapaFocalizada?clave===etapa:clave===etapa);
  };
  const resumenEtapa = {
    activos:'Activos',diagnostico:'En diagnóstico',
    ganados:'Ganados este mes',perdidos:'Perdidos'
  };
  function activarResumen(tipo){
    setFiltroResumen(tipo);
    setEtapaFocalizada(false);
    setVistaCompletaMovil(false);
    setEtapa(({activos:'nuevo',diagnostico:'diagnostico',ganados:'ganado',perdidos:'perdido'})[tipo],{replace:true});
  }
  function elegirEtapa(clave){
    setFiltroResumen(null);
    setVistaCompletaMovil(false);
    setEtapaFocalizada(true);
    setEtapa(clave);
  }
  function verTodoElEmbudo(){
    setFiltroResumen(null);
    setEtapaFocalizada(false);
    setVistaCompletaMovil(true);
  }
  function soltarProspecto(evento,etapaDestino){
    evento.preventDefault();
    const id=evento.dataTransfer.getData('text/plain')||arrastrandoId;
    setArrastrandoId(null);
    setSoltarEn('');
    const actual=(prospectos||[]).find(p=>p.id===id);
    if(!actual||guardando||actual.etapa===etapaDestino)return;
    void cambiarEtapa(actual,etapaDestino);
  }


  // Los avisos de contacto web abren directamente el prospecto enlazado.
  // Si ya no existe o está restringido, se informa sin seleccionar otro.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('prospecto');
    if (!id || !prospectos || idAbiertoPorUrl.current === id) return;
    idAbiertoPorUrl.current = id;
    const p = prospectos.find(x => x.id === id);
    if (p) {
      // La notificación abre primero la ficha de gestión, nunca la edición.
      setEtapa(p.etapa,{replace:true});
    } else {
      setError('El prospecto de esta notificación ya no está disponible o no tienes acceso.');
    }
  }, [location.search, prospectos]);

  function comenzarCorreo(p) {
    if (!p.email) return setError('Este prospecto no tiene correo electrónico registrado.');
    setError(null);
    setAvisoCorreo(null);
    setCorreoProspecto(p);
    setAsuntoCorreo('Coproactiva · ' + p.nombre_condominio);
    setMensajeCorreo('');
    setPlantillaElegida('');
    setVarianteElegida('principal');
    setAdjuntosCorreo([]);
    setGuardadoDriveCorreo(null);
    abrirAccion('correo');
    requestAnimationFrame(() => document.getElementById('pipeline-correo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function cargarPlantillaCorreo(id, variante='principal') {
    const p=plantillasCorreo.find(x=>x.id===id);
    setPlantillaElegida(id);
    setVarianteElegida(variante);
    if(!p||!correoProspecto)return;
    const cuerpo=variante==='principal'?p.cuerpo:p.variantes?.[Number(variante)]?.cuerpo||p.cuerpo;
    setAsuntoCorreo(asuntoAutomatico(p,correoProspecto,perfil?.nombre));
    const texto=completarCorreo(cuerpo,correoProspecto,perfil?.nombre);
    setMensajeCorreo(texto);
  }

  useEffect(() => {
    let activo=true;
    if (!prospectoSeleccionadoId) {
      setHistorialCorreos([]);
      setHistorialCorreosError('');
      setHistorialCorreosCargando(false);
      return () => { activo=false; };
    }
    setHistorialCorreosCargando(true);
    setHistorialCorreosError('');
    const cargarHistorial=async()=>{
      const {data,error}=await supabase.from('prospecto_correos')
        .select('id,asunto,mensaje,destinatario,estado,creado_en,enviado_en,error,adjuntos,seguimiento_activo,primera_apertura,ultima_apertura,aperturas_total')
        .eq('prospecto_id',prospectoSeleccionadoId)
        .order('creado_en',{ascending:false}).limit(30);
      if(!activo)return;
      if(error){
        setHistorialCorreosError('No fue posible cargar el historial de correos.');
      }else{
        setHistorialCorreos(data||[]);
        setHistorialCorreosError('');
      }
      setHistorialCorreosCargando(false);
    };
    void cargarHistorial();
    // La ficha recupera nuevas señales sin necesidad de recargar la página.
    const intervalo=window.setInterval(()=>{void cargarHistorial();},60000);
    return ()=>{activo=false;window.clearInterval(intervalo);};
  },[prospectoSeleccionadoId,refrescarHistorial]);

  useEffect(()=>{
    if(!perfil?.id||!correoProspecto){setFirmaCorreo(null);return;}
    let activa=true;
    supabase.from('firmas_correo').select('*').eq('usuario_id',perfil.id).maybeSingle()
      .then(({data,error})=>{
        if(!activa)return;
        if(error)console.warn('No se pudo obtener la firma del usuario',error.message);
        setFirmaCorreo(error?null:data);
      });
    return ()=>{activa=false;};
  },[perfil?.id,correoProspecto?.id]);

  const plantillaActual=plantillasCorreo.find(p=>p.id===plantillaElegida);
  const necesitaAdjunto=Boolean(plantillaActual?.adjunto_sugerido?.trim());
  async function copiarBorradorCorreo(){
    const firmaTexto=firmaCorreo?.activa===false ? '' : [
      firmaCorreo?.nombre||perfil?.nombre,
      firmaCorreo?.cargo,
      firmaCorreo?.empresa??'Coproactiva Administración SpA',
      firmaCorreo?.telefono||(!firmaCorreo&&perfil?.telefono),
      firmaCorreo?.correo??'contacto@coproactiva.cl',
      firmaCorreo?.web??'www.coproactiva.cl',
      firmaCorreo?.texto_adicional
    ].filter(Boolean).join('\n');
    const texto='Asunto: '+asuntoCorreo+'\n\n'+mensajeCorreo+(firmaTexto?'\n\n'+firmaTexto:'');
    try {
      await navigator.clipboard.writeText(texto);
      setAvisoCorreo('Texto copiado. El logo y los adjuntos se incorporan al enviar desde el CRM.');
    }catch{
      setError('No se pudo copiar. Puedes seleccionar el asunto y mensaje manualmente.');
    }
  }

  async function enviarCorreo(e) {
    e.preventDefault();
    const copias=prepararCopias(ccCorreo,ccoCorreo);
    if(copias.errores.length)return setError(copias.errores.join(' '));
    if (!correoProspecto || enviandoCorreo) return;
    if(necesitaAdjunto&&!adjuntosCorreo.length) return setError('Esta plantilla requiere al menos un adjunto real antes del envío.');
    const erroresBorrador=validarBorradorCorreo(asuntoCorreo,mensajeCorreo);
    if (erroresBorrador.length) return setError(erroresBorrador.join(' '));
    setEnviandoCorreo(true);
    setError(null);
    const { data, error: envioError } = await supabase.functions.invoke('correo-prospecto', {
      body: { prospecto_id: correoProspecto.id, asunto: asuntoCorreo.trim(), mensaje: mensajeCorreo.trim(),
        plantilla_id:plantillaElegida||null, adjuntos:adjuntosCorreo,
        ...(guardadoDriveCorreo?.carpeta_id ? {guardar_drive:{carpeta_id:guardadoDriveCorreo.carpeta_id,operacion_id:guardadoDriveCorreo.operacion_id}} : {}),
        cc:copias.cc,cco:copias.cco }
    });
    setEnviandoCorreo(false);
    if (envioError || !data?.enviado) {
      return setError(data?.error || envioError?.message || 'No fue posible enviar el correo. Revisa la configuración de SMTP.');
    }
    setAvisoCorreo('Correo enviado a ' + correoProspecto.email);
    setCorreoProspecto(null);
    setMensajeCorreo('');
    setCcCorreo('');setCcoCorreo('');
    setAdjuntosCorreo([]);
    setGuardadoDriveCorreo(null);
    setRefrescarHistorial(n=>n+1);
    volverFicha();
    cargar();
  }

  function abrirNuevo() {
    setForm(VACIO);
    setAbierto('nuevo');
  }

  function abrirEdicion(p) {
    setForm({
      nombre_condominio: p.nombre_condominio ?? '', direccion: p.direccion ?? '', comuna: p.comuna ?? '',
      unidades: p.unidades ?? '', nombre_contacto: p.nombre_contacto ?? '', cargo_contacto: p.cargo_contacto ?? '',
      telefono: p.telefono ?? '', email: p.email ?? '', tipo_servicio: p.tipo_servicio ?? '',
      fuente: p.fuente ?? '', responsable_id: p.responsable_id ?? '',
      proxima_accion: p.proxima_accion ?? '',
      fecha_proxima_accion: p.fecha_proxima_accion ? p.fecha_proxima_accion.slice(0, 16) : '',
      observaciones: p.observaciones ?? ''
    });
    setAbierto(p.id);
    setCorreoProspecto(null);
    abrirAccion('editar');
    requestAnimationFrame(() => document.getElementById('pipeline-formulario')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function cerrarForm() {
    const eraEdicion=abierto!=='nuevo' && Boolean(prospectoSeleccionado);
    setAbierto(null);
    setForm(VACIO);
    if (eraEdicion) volverFicha();
  }

  async function guardar() {
    if (!form.nombre_condominio.trim()) return setError('Falta el nombre del condominio o edificio.');
    setGuardando(true);
    setError(null);

    const cuerpo = {
      nombre_condominio: form.nombre_condominio.trim(),
      direccion: form.direccion.trim() || null,
      comuna: form.comuna.trim() || null,
      unidades: form.unidades ? Number(form.unidades) : null,
      nombre_contacto: form.nombre_contacto.trim() || null,
      cargo_contacto: form.cargo_contacto.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      tipo_servicio: form.tipo_servicio || null,
      fuente: form.fuente.trim() || null,
      responsable_id: form.responsable_id || null,
      proxima_accion: form.proxima_accion.trim() || null,
      fecha_proxima_accion: form.fecha_proxima_accion ? new Date(form.fecha_proxima_accion).toISOString() : null,
      observaciones: form.observaciones.trim() || null,
      fecha_ultima_interaccion: new Date().toISOString()
    };

    if (abierto === 'nuevo') {
      cuerpo.responsable_id = cuerpo.responsable_id || perfil?.id || null;
      cuerpo.fecha_primer_contacto = new Date().toISOString();
      const { data, error } = await supabase.from('prospectos').insert(cuerpo).select().single();
      setGuardando(false);
      if (error || !data) return setError(error?.message || 'No se pudo crear el lead.');
      setProspectos(xs => [data, ...(xs ?? [])]);
      setEtapa(data.etapa);
      cerrarForm();
      return;
    }

    const { data, error } = await supabase.from('prospectos').update(cuerpo).eq('id', abierto).select().single();
    setGuardando(false);
    if (error || !data) return setError(error?.message || 'No se pudo actualizar el prospecto.');
    setProspectos(xs => xs.map(p => p.id === abierto ? data : p));
    cerrarForm();
  }

  async function confirmarEliminarProspecto(){
    const p=eliminarPendiente;
    if(!p||guardando)return;
    setEliminarPendiente(null);
    if(perfil?.rol!=='superadmin')return setError('Solo el superadministrador puede eliminar prospectos.');
    setGuardando(true);
    setError(null);
    const {data,error}=await supabase.rpc('eliminar_prospecto_superadmin',{p_prospecto_id:p.id});
    setGuardando(false);
    if(error||data!==true)
      return setError(error?.message||'No fue posible eliminar el prospecto.');
    setProspectos(xs=>(xs||[]).filter(x=>x.id!==p.id));
    setHistorialCorreos([]);
    setCorreoProspecto(null);
    setAbierto(null);
    setAvisoCorreo('Prospecto eliminado correctamente.');
    const params=new URLSearchParams(location.search);
    params.delete('prospecto');
    params.delete('accion');
    navegarPipeline(params,null,true);
  }

  async function guardarEtapa(p, nuevaEtapa, motivo = null) {
    setGuardando(true);
    setError(null);
    const { data, error } = await supabase.from('prospectos')
      .update({
        etapa: nuevaEtapa,
        motivo_perdida: nuevaEtapa === 'perdido' ? (motivo || null) : null,
        fecha_ultima_interaccion: new Date().toISOString()
      })
      .eq('id', p.id).select().single();
    setGuardando(false);
    if (error || !data) return setError(error?.message || 'No se pudo actualizar el prospecto.');
    setProspectos(xs => xs.map(x => x.id === p.id ? data : x));
    setEtapa(nuevaEtapa,{replace:true});
  }

  async function cambiarEtapa(p, nuevaEtapa) {
    if (nuevaEtapa === p.etapa) return;
    if (nuevaEtapa === 'ganado') {
      setGanarPendiente(p);
      return;
    }
    if (nuevaEtapa === 'perdido') {
      setPerdidaPendiente(p);
      return;
    }
    await guardarEtapa(p, nuevaEtapa);
  }

  async function confirmarPerdida({ motivo }) {
    const p = perdidaPendiente;
    setPerdidaPendiente(null);
    if (!p) return;
    await guardarEtapa(p, 'perdido', motivo.trim() || null);
  }

  async function convertirEnComunidad(p) {
    setGanarPendiente(null);
    setGuardando(true);
    setError(null);
    // Un solo paso en el servidor (ganar_prospecto): crea la comunidad, la
    // liga, pasa el prospecto a Ganado y asigna la comunidad a quien lo ganó y
    // al responsable. Hecho desde el navegador solo funcionaba para el
    // superadmin: jefatura no puede crear comunidades y un admin no veía la
    // que acababa de crear.
    const { error: errorGanar } = await supabase.rpc('ganar_prospecto', { p_prospecto_id: p.id });
    if (errorGanar) {
      setGuardando(false);
      return setError(errorGanar.message);
    }

    const { data, error } = await supabase.from('prospectos').select('*').eq('id', p.id).single();
    setGuardando(false);
    if (error || !data) return setError(error?.message || 'No se pudo actualizar el prospecto.');
    setProspectos(xs => xs.map(x => x.id === p.id ? data : x));
    // Prospecto ganado → comunidad nueva: carpetas en Drive sin bloquear el CRM.
    if (data.comunidad_id) prepararCarpetasDrive(data.comunidad_id);
  }

  return (
    <div className="pantalla pantalla-ancha modulo-unificado">
      {perdidaPendiente && (
        <DialogoCampos
          titulo="Marcar prospecto como perdido"
          mensaje={`Puedes registrar por qué no continuó “${perdidaPendiente.nombre_condominio}”.`}
          campos={[{
            id: 'motivo',
            label: 'Motivo de la pérdida',
            valor: perdidaPendiente.motivo_perdida ?? '',
            multiline: true,
            filas: 3,
            placeholder: 'Opcional'
          }]}
          textoConfirmar="Marcar como perdido"
          textoCancelar="Cancelar"
          onConfirmar={confirmarPerdida}
          onCancelar={() => setPerdidaPendiente(null)}
        />
      )}

      {eliminarPendiente&&<Confirmar
        titulo="Eliminar prospecto definitivamente"
        mensaje={`¿Eliminar “${eliminarPendiente.nombre_condominio}”? Se borrarán su historial comercial y los correos asociados. Esta acción no se puede deshacer. No se eliminarán prospectos vinculados a comunidades o gestiones operativas.`}
        textoConfirmar="Eliminar definitivamente"
        textoCancelar="Conservar"
        onConfirmar={confirmarEliminarProspecto}
        onCancelar={()=>setEliminarPendiente(null)}
      />}
      {ganarPendiente && (
        <Confirmar
          titulo="Convertir en comunidad"
          mensaje={`“${ganarPendiente.nombre_condominio}” pasará a Ganado y se creará como comunidad para gestionar levantamientos, mantención y portal cliente.`}
          textoConfirmar="Convertir en comunidad"
          textoCancelar="Cancelar"
          onConfirmar={() => convertirEnComunidad(ganarPendiente)}
          onCancelar={() => setGanarPendiente(null)}
        />
      )}
      <header className="encabezado modulo-cabecera">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
            onClick={() => prospectoSeleccionado ? cerrarGestion() : navegar(inicioSegunArea())}>
            {prospectoSeleccionado ? '‹ Volver al embudo' : '‹ Inicio'}
          </button>
        </div>
        <div className="fila">
          <div className="crece">
            <h1 className="h3">Pipeline comercial</h1>
            <p className="chico apagado" style={{ margin: '4px 0 0' }}>
              Leads y prospectos hasta ganarse o perderse.
            </p>
          </div>
          {!prospectoSeleccionado&&<button type="button" className="boton" onClick={abrirNuevo}>Nuevo lead</button>}
        </div>
      </header>

      <div className="cuerpo">
        {prospectoSeleccionado && !accionSeleccionada && (
          <button type="button" className="boton boton-secundario pipeline-volver-movil"
            onClick={cerrarGestion}>‹ Volver al embudo</button>
        )}
        {error && <div className="aviso aviso-critico" style={{ marginBottom: 14 }} role="alert">{error}</div>}
        {avisoCorreo && <div className="aviso" role="status">{avisoCorreo}</div>}

        {prospectoSeleccionado && (
          <section className="tarjeta pipeline-ficha" aria-label={'Ficha de gestión de '+prospectoSeleccionado.nombre_condominio}>
            <div className="pipeline-ficha-encabezado">
              <div>
                <span className="chip chip-tipo">{ETAPAS.find(([id])=>id===prospectoSeleccionado.etapa)?.[1]||prospectoSeleccionado.etapa}</span>
                <h2 className="h3">{prospectoSeleccionado.nombre_condominio}</h2>
                <p className="chico apagado">{[prospectoSeleccionado.direccion,prospectoSeleccionado.comuna].filter(Boolean).join(' · ')||'Dirección pendiente'}</p>
              </div>
              {accionSeleccionada&&<button type="button" className="boton boton-secundario"
                onClick={volverFicha}>‹ Volver a la ficha</button>}
            </div>
            {!accionSeleccionada && (
              <>
                <div className="pipeline-ficha-informacion">
                  <div><span className="etiqueta-campo">Contacto</span><strong>{prospectoSeleccionado.nombre_contacto||'Sin registrar'}</strong></div>
                  <div><span className="etiqueta-campo">Correo</span><span>{prospectoSeleccionado.email||'Sin registrar'}</span></div>
                  <div><span className="etiqueta-campo">Teléfono</span><span>{prospectoSeleccionado.telefono||'Sin registrar'}</span></div>
                  <div><span className="etiqueta-campo">Responsable</span><span>{equipo.find(e=>e.id===prospectoSeleccionado.responsable_id)?.nombre||'Sin asignar'}</span></div>
                  <div><span className="etiqueta-campo">Próxima acción</span><span>{prospectoSeleccionado.proxima_accion||'No definida'}</span></div>
                  <div><span className="etiqueta-campo">Fecha próxima acción</span><span>{fechaCL(prospectoSeleccionado.fecha_proxima_accion,true)||'Sin fecha'}</span></div>
                </div>
                {prospectoSeleccionado.observaciones&&<div className="pipeline-ficha-notas">
                  <strong>Observaciones</strong><p>{prospectoSeleccionado.observaciones}</p>
                </div>}
                <div className="pipeline-ficha-gestionar">
                  <h3 className="h4">Gestionar prospecto</h3>
                  <p className="chico apagado">Elige la acción que necesitas realizar.</p>
                  <div className="pipeline-ficha-acciones">
                    <button type="button" className="boton boton-secundario"
                      onClick={()=>abrirEdicion(prospectoSeleccionado)}>Editar datos</button>
                    <button type="button" className="boton boton-secundario"
                      disabled={!prospectoSeleccionado.email}
                      onClick={()=>comenzarCorreo(prospectoSeleccionado)}>Enviar correo</button>
                    {perfil?.rol==='superadmin'&&<button type="button" className="boton boton-secundario pipeline-eliminar"
                      disabled={guardando} onClick={()=>setEliminarPendiente(prospectoSeleccionado)}>
                      Eliminar prospecto
                    </button>}
                    {enlaceTelefono(prospectoSeleccionado.telefono,true)&&
                      <a className="boton boton-secundario" href={enlaceTelefono(prospectoSeleccionado.telefono,true)}
                         target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                    {enlaceTelefono(prospectoSeleccionado.telefono)&&
                      <a className="boton boton-secundario" href={enlaceTelefono(prospectoSeleccionado.telefono)}>Llamar</a>}
                    {diagnosticos.has(prospectoSeleccionado.id)
                      ?<TarjetaDiagnostico diagnostico={diagnosticos.get(prospectoSeleccionado.id)} equipo={equipo}/>
                      :!['ganado','perdido'].includes(prospectoSeleccionado.etapa) &&
                        <Link className="boton boton-secundario" to={'/nuevo?prospecto='+prospectoSeleccionado.id}>Iniciar diagnóstico</Link>}
                  </div>
                </div>
                <details className="pipeline-historial-correos" defaultOpen={Boolean(correoDestacado)}>
                  <summary>
                    <strong>Historial de correos</strong>
                    <span>{historialCorreosCargando?'Cargando…':historialCorreos.length+' registro'+(historialCorreos.length===1?'':'s')}</span>
                  </summary>
                  <div className="pipeline-historial-contenido">
                    {historialCorreosError&&<p className="chico" role="alert">{historialCorreosError}</p>}
                    {!historialCorreosCargando&&!historialCorreosError&&!historialCorreos.length&&
                      <p className="chico apagado">No hay correos enviados desde este CRM.</p>}
                    {historialCorreos.map(c=><details key={c.id} defaultOpen={c.id===correoDestacado} className="pipeline-correo-historial-item">
                      <summary>
                        <span className="pipeline-correo-fecha">{fechaCL(c.enviado_en||c.creado_en,true)||'Sin fecha'}</span>
                        <span className="pipeline-correo-asunto">{c.asunto}</span>
                        <span className={'pipeline-correo-estado '+(c.estado==='enviado'?'ok':'')}>{c.estado==='enviado'?'Enviado':c.estado==='fallido'?'Fallido':'Pendiente'}</span>
                        {c.estado==='enviado'&&c.seguimiento_activo&&
                          <span className={'pipeline-correo-apertura'+(c.primera_apertura?' detectada':'')}>
                            {c.primera_apertura?'◉ Apertura detectada':'○ Sin apertura detectada'}
                          </span>}
                      </summary>
                      <div className="pipeline-correo-historial-detalle">
                        <p className="chico apagado">Para: {c.destinatario}</p>
                        {c.estado==='enviado'&&
                          <div className="pipeline-correo-apertura-detalle">
                            {!c.seguimiento_activo
                              ? <span>Este correo no tiene seguimiento de aperturas.</span>
                              : c.primera_apertura
                                ? <>
                                  <strong>Apertura detectada</strong>
                                  <span>Primera señal: {fechaCL(c.primera_apertura,true)}</span>
                                  <span>Última señal: {fechaCL(c.ultima_apertura||c.primera_apertura,true)}</span>
                                  <span>Señales registradas: {c.aperturas_total||1}</span>
                                </>
                                : <span>Aún no se ha detectado la carga de imágenes del correo.</span>}
                            <small>Esta señal no confirma lectura. Gmail, Apple Mail y otros clientes pueden cargar o bloquear imágenes automáticamente.</small>
                          </div>}
                        {c.error&&<p className="chico pipeline-correo-error">{c.error}</p>}
                        <pre>{c.mensaje}</pre>
                        {Array.isArray(c.adjuntos)&&c.adjuntos.length>0&&
                          <div className="pipeline-correo-documentos"><p className="chico apagado">Adjuntos: {c.adjuntos.map(a=>a.nombre||'Archivo').join(' · ')}</p>
                            {c.adjuntos.filter(a=>a.guardado_drive).map((a,i)=><p className="chico" key={a.id||i}>Guardado en Drive: {a.nombre} - {a.guardado_drive.carpeta_nombre}</p>)}
                          </div>}
                      </div>
                    </details>)}
                    {historialCorreos.length===30&&<p className="micro apagado">Se muestran los 30 registros más recientes.</p>}
                  </div>
                </details>
                <div className="pipeline-ficha-etapa">
                  <label className="campo"><span className="etiqueta-campo">Etapa comercial</span>
                    <select value={prospectoSeleccionado.etapa} disabled={guardando}
                       onChange={e=>cambiarEtapa(prospectoSeleccionado,e.target.value)}>
                      {ETAPAS.map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}
                    </select>
                  </label>
                  {prospectoSeleccionado.motivo_perdida&&<p className="micro apagado">
                    Motivo de pérdida: {prospectoSeleccionado.motivo_perdida}</p>}
                </div>
              </>
            )}
          </section>
        )}

        {abierto && (
          <FormularioProspecto form={form} setForm={setForm} equipo={equipo}
            esNuevo={abierto==='nuevo'} guardando={guardando}
            onGuardar={guardar} onCancelar={cerrarForm}/>
        )}

        {correoProspecto && (
          <form id="pipeline-correo" className="tarjeta pipeline-correo" onSubmit={enviarCorreo}>
            <h2 className="h4">Enviar correo a {correoProspecto.nombre_contacto || correoProspecto.nombre_condominio}</h2>
            <p className="chico apagado">Para: {correoProspecto.email} · desde contacto@coproactiva.cl</p>
            <CopiasCorreo cc={ccCorreo} cco={ccoCorreo} onCC={setCcCorreo} onCCO={setCcoCorreo}
              errores={prepararCopias(ccCorreo,ccoCorreo).errores}/>
            <label className="campo">
              <span className="etiqueta-campo">Plantilla (opcional)</span>
              <select value={plantillaElegida} onChange={e=>cargarPlantillaCorreo(e.target.value)}>
                <option value="">Redactar desde cero</option>
                {plantillasCorreo.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <Link to="/plantillas-correo" className="micro">Administrar plantillas de correo</Link>
            </label>
            {plantillaActual&&Array.isArray(plantillaActual.variantes)&&plantillaActual.variantes.length>0&&
              <label className="campo">Variante
                <select value={varianteElegida} onChange={e=>cargarPlantillaCorreo(plantillaElegida,e.target.value)}>
                  <option value="principal">Principal</option>
                  {plantillaActual.variantes.map((v,i)=><option key={i} value={String(i)}>{v.nombre}</option>)}
                </select>
              </label>}
            <label className="campo">
              <span className="etiqueta-campo">Asunto</span>
              <input value={asuntoCorreo} required maxLength={160}
                     onChange={e => setAsuntoCorreo(e.target.value)} />
            </label>
            <label className="campo">
              <span className="etiqueta-campo">Mensaje</span>
              <textarea value={mensajeCorreo} required maxLength={5000} rows={6}
                        onChange={e => setMensajeCorreo(e.target.value)} />
            </label>

            <div className="pipeline-firma" aria-label="Firma del remitente">
              <strong>Firma de correo</strong>
              {firmaCorreo?.activa===false
                ? <span>No se agregará una firma a este mensaje.</span>
                : <div className="pipeline-firma-fila">
                  {firmaCorreo?.logo_path&&<img alt="Logo de firma"
                    src={supabase.storage.from('firmas-correo').getPublicUrl(firmaCorreo.logo_path).data.publicUrl+'?v='+encodeURIComponent(String(firmaCorreo.actualizada_en||1))}
                    className="pipeline-firma-logo"/>}
                  <div className="pipeline-firma-texto">
                    <strong>{firmaCorreo?.nombre||perfil?.nombre||'Equipo Coproactiva'}</strong>
                    {firmaCorreo?.cargo&&<span>{firmaCorreo.cargo}</span>}
                    <span>{firmaCorreo?.empresa??'Coproactiva Administración SpA'}</span>
                    {(firmaCorreo?.telefono||(!firmaCorreo&&perfil?.telefono))&&<span>{firmaCorreo?.telefono||perfil?.telefono}</span>}
                    <span>{firmaCorreo?.correo??'contacto@coproactiva.cl'}</span>
                    <span>{firmaCorreo?.web??'www.coproactiva.cl'}</span>
                    {firmaCorreo?.texto_adicional&&<span>{firmaCorreo.texto_adicional}</span>}
                  </div>
                </div>}
              <Link to="/mi-cuenta#firma-correo" className="micro">Configurar mi firma y logo</Link>
            </div>
            <AdjuntosCorreo seleccion={adjuntosCorreo} onChange={setAdjuntosCorreo}
              usuarioId={perfil?.id} guardadoDrive={guardadoDriveCorreo} onGuardarChange={setGuardadoDriveCorreo}/>
            {validarBorradorCorreo(asuntoCorreo,mensajeCorreo).map((aviso,i)=><p className="chico pipeline-correo-error" key={i} role="alert">{aviso}</p>)}
            {necesitaAdjunto&&!adjuntosCorreo.length&&<p className="chico pipeline-correo-error">Esta plantilla requiere un adjunto físico.</p>}
            <p className="chico apagado">Los adjuntos viajan dentro del correo. Las variables pendientes o instrucciones sin completar impiden el envío.</p>
            <div className="fila-botones">
              <button className="boton boton-secundario" type="button" disabled={enviandoCorreo}
                      onClick={volverFicha}>Cancelar</button>
              <button className="boton boton-secundario" type="button" onClick={copiarBorradorCorreo}>
                Copiar texto
              </button>
              <button className="boton" type="submit" disabled={enviandoCorreo||Boolean(validarBorradorCorreo(asuntoCorreo,mensajeCorreo).length)||Boolean(prepararCopias(ccCorreo,ccoCorreo).errores.length)||(necesitaAdjunto&&!adjuntosCorreo.length)}>
                {enviandoCorreo ? 'Enviando…' : 'Enviar correo'}
              </button>
            </div>
          </form>
        )}

        {!prospectoSeleccionado && <>
        <div className="tablero pipeline-indicadores">
          {[
            ['activos',activos,'Activos'],
            ['diagnostico',enDiagnostico,'En diagnóstico'],
            ['ganados',ganadosMes,'Ganados este mes'],
            ['perdidos',perdidos,'Perdidos']
          ].map(([clave,cantidad,nombre])=><button key={clave} type="button"
            className={'pipeline-indicador'+(filtroResumen===clave?' seleccionado':'')}
            aria-pressed={filtroResumen===clave} onClick={()=>activarResumen(clave)}>
            <span className="n">{cantidad}</span><span className="r">{nombre}</span>
            <span className="pipeline-indicador-accion">Ver prospectos ›</span>
          </button>)}
        </div>

        {diagnosticosPendientes.length > 0 && (
          <section className="pipeline-pendientes" aria-label="Diagnósticos pendientes">
            <h2 className="etiqueta-grupo" style={{ margin: '0 0 10px' }}>
              Diagnósticos pendientes ({diagnosticosPendientes.length})
            </h2>
            <div className="rejilla">
              {diagnosticosPendientes.map(({ control, prospecto }) => {
                const [clase, texto] = ESTADO_DIAGNOSTICO[control.estado] ?? ESTADO_DIAGNOSTICO.pendiente;
                const responsable = equipo.find(e => e.id === control.responsable_id);
                return (
                  <Link key={control.id} to={`/control/${control.id}`} className="tarjeta pipeline-pendiente">
                    <div className="fila" style={{ gap: 8 }}>
                      <strong className="dato-chico crece">{prospecto.nombre_condominio}</strong>
                      <span className={'chip ' + clase}>{texto}</span>
                    </div>
                    <p className="micro" style={{ margin: '4px 0 0' }}>
                      {responsable ? responsable.nombre : 'Sin asignar'}
                      {control.programado_para && ` · ${fechaCL(control.programado_para, true)}`}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="pipeline-etapas-encabezado">
          <strong>{filtroResumen?resumenEtapa[filtroResumen]:etapaFocalizada?
            ETAPAS.find(([id])=>id===etapa)?.[1]:'Todas las etapas'}</strong>
          {(filtroResumen||etapaFocalizada||vistaCompletaMovil)&&
            <button type="button" className="boton boton-texto" onClick={verTodoElEmbudo}>Ver todo el embudo</button>}
        </div>
        <nav className="pestanas pipeline-tabs" aria-label="Filtrar por etapa del pipeline">
          {ETAPAS.map(([clave, texto]) => (
            <button key={clave} type="button"
                    className={!filtroResumen&&etapa===clave&&(etapaFocalizada||!vistaCompletaMovil)?'activo':''}
                    aria-pressed={!filtroResumen&&etapaFocalizada&&etapa===clave}
                    onClick={() => elegirEtapa(clave)}>
              {texto}
              <span className="contador">{porEtapa.get(clave)?.length ?? 0}</span>
            </button>
          ))}
        </nav>

        {prospectos === null && !error && <p className="cargando">Cargando…</p>}

        {/* En el teléfono se ve una etapa a la vez, elegida con las pestañas.
            En escritorio se ven todas lado a lado, como un tablero. */}
        {prospectos !== null && (
          <div className={'pipeline-tablero'+(filtroResumen||etapaFocalizada?' pipeline-vista-filtrada':'')+
              (vistaCompletaMovil||filtroResumen==='activos'?' pipeline-mostrar-varias':'')}>
            {ETAPAS.map(([clave, texto]) => {
              const deEtapa = (porEtapa.get(clave)||[]).filter(p=>filtroResumen==='ganados'?esGanadoEsteMes(p):true);
              const visible=etapaVisible(clave);
              return (
                <section key={clave} aria-label={texto} data-pipeline-etapa={clave}
                         onDragOver={e=>{if(arrastrandoId&&!guardando){e.preventDefault();e.dataTransfer.dropEffect='move';if(soltarEn!==clave)setSoltarEn(clave);}}}
                         onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setSoltarEn(x=>x===clave?'':x);}}
                         onDrop={e=>soltarProspecto(e,clave)}
                         className={'pipeline-columna'+(visible?' activa':'')+(soltarEn===clave?' pipeline-soltar':'')}>
                  <header className="pipeline-columna-cabecera">
                    <span>{texto}</span>
                    <span className="contador">{deEtapa.length}</span>
                  </header>
                  {deEtapa.length === 0 && <p className="vacio">No hay prospectos en esta etapa.</p>}
                  {deEtapa.map(p => (
                    <TarjetaProspecto key={p.id} p={p} equipo={equipo} guardando={guardando}
                      onGestionar={() => abrirGestion(p)}
                      onCambiarEtapa={clave=>void cambiarEtapa(p,clave)}
                      onInicioArrastre={e=>{
                        if(guardando){e.preventDefault();return;}
                        setArrastrandoId(p.id);
                        e.dataTransfer.effectAllowed='move';
                        e.dataTransfer.setData('text/plain',p.id);
                      }}
                      onFinArrastre={()=>{setArrastrandoId(null);setSoltarEn('');}}
                      arrastrando={arrastrandoId===p.id}/>
                  ))}
                </section>
              );
            })}
          </div>
        )}
        </>}
      </div>
    </div>
  );
}

function TarjetaProspecto({p,equipo,onGestionar,onCambiarEtapa,onInicioArrastre,onFinArrastre,arrastrando,guardando}) {
  const responsable=equipo.find(e=>e.id===p.responsable_id);
  const vencida=p.fecha_proxima_accion && new Date(p.fecha_proxima_accion)<new Date();
  return (
    <article className={'tarjeta pipeline-tarjeta'+(arrastrando?' pipeline-arrastrando':'')}
      draggable={!guardando} onDragStart={onInicioArrastre} onDragEnd={onFinArrastre}>
      <button type="button" className="pipeline-tarjeta-abrir" onClick={onGestionar}
        aria-label={'Gestionar prospecto '+p.nombre_condominio}>
        <span className="pipeline-tarjeta-fila">
          <strong className="pipeline-titulo-prospecto">{p.nombre_condominio}</strong>
          <span className="pipeline-tarjeta-gestion">Gestionar ›</span>
        </span>
        {(p.comuna||p.direccion)&&<span className="micro apagado">
          {[p.direccion,p.comuna].filter(Boolean).join(', ')}</span>}
        {(p.nombre_contacto||p.telefono||p.email)&&
          <span className="micro pipeline-tarjeta-contacto">
            {p.nombre_contacto}{p.cargo_contacto?' · '+p.cargo_contacto:''}
            {(p.telefono||p.email)&&' - '+[p.telefono,p.email].filter(Boolean).join(' · ')}
          </span>}
        <span className="pipeline-tarjeta-tags">
          {p.fuente&&<span className="chip chip-tipo">{p.fuente}</span>}
          {p.unidades&&<span className="chip chip-tipo">{p.unidades} unidades</span>}
          {responsable&&<span className="chip chip-tipo">{responsable.nombre}</span>}
        </span>
        {p.proxima_accion&&<span className={'micro pipeline-tarjeta-accion'+(vencida?' pipeline-vencida':' apagado')}>
          {vencida?'Vencida: ':'Próxima acción: '}{p.proxima_accion}
          {p.fecha_proxima_accion&&' · '+fechaCL(p.fecha_proxima_accion,true)}
        </span>}
      </button>
      <label className="pipeline-tarjeta-etapa-movil">
        <span>Etapa</span>
        <select value={p.etapa} disabled={guardando} aria-label={'Cambiar etapa de '+p.nombre_condominio}
          onChange={e=>onCambiarEtapa(e.target.value)}>
          {ETAPAS.map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}
        </select>
      </label>
    </article>
  );
}

function TarjetaDiagnostico({ diagnostico, equipo }) {
  const { control, resultado } = diagnostico;
  const [clase, texto] = ESTADO_DIAGNOSTICO[control.estado] ?? ESTADO_DIAGNOSTICO.pendiente;
  const responsable = equipo.find(e => e.id === control.responsable_id);
  const linea = resultado ? LINEAS[resultado.linea_elegida ?? resultado.linea_sugerida] : null;

  return (
    <div className="pipeline-diagnostico">
      <div className="fila" style={{ gap: 8 }}>
        <span className="etiqueta-campo crece" style={{ margin: 0 }}>Diagnóstico</span>
        <span className={'chip ' + clase}>{texto}</span>
      </div>
      {resultado ? (
        <>
          <p className="pipeline-diagnostico-puntaje">
            <strong>{resultado.score}%</strong> · {resultado.nivel}
          </p>
          {linea && <p className="micro" style={{ margin: '2px 0 0' }}>{linea}</p>}
        </>
      ) : (
        <p className="micro" style={{ margin: '6px 0 0' }}>
          {responsable ? responsable.nombre : 'Sin asignar'}
          {control.programado_para && ` · ${fechaCL(control.programado_para, true)}`}
        </p>
      )}
      <Link to={`/control/${control.id}`} className="boton boton-secundario boton-ancho"
            style={{ marginTop: 10, textAlign: 'center' }}>
        Ver diagnóstico
      </Link>
    </div>
  );
}

function FormularioProspecto({ form, setForm, equipo, esNuevo, guardando, onGuardar, onCancelar }) {
  function set(campo, valor) { setForm(x => ({ ...x, [campo]: valor })); }

  return (
    <div id="pipeline-formulario" className="tarjeta pipeline-formulario">
      <h2 className="h4" style={{ marginTop: 0 }}>{esNuevo ? 'Nuevo lead' : 'Editar prospecto'}</h2>

      <Campo label="Nombre del condominio o edificio *" valor={form.nombre_condominio} onChange={v => set('nombre_condominio', v)} />
      <div className="pipeline-grid-2">
        <Campo label="Dirección" valor={form.direccion} onChange={v => set('direccion', v)} />
        <Campo label="Comuna" valor={form.comuna} onChange={v => set('comuna', v)} />
      </div>
      <div className="pipeline-grid-2">
        <Campo label="N° de unidades" tipo="number" valor={form.unidades} onChange={v => set('unidades', v)} />
        <div className="campo">
          <label className="etiqueta-campo">Tipo de servicio</label>
          <select value={form.tipo_servicio} onChange={e => set('tipo_servicio', e.target.value)}>
            <option value="">Sin definir</option>
            {TIPOS_SERVICIO.map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
          </select>
        </div>
      </div>

      <div className="pipeline-grid-2">
        <Campo label="Nombre de contacto" valor={form.nombre_contacto} onChange={v => set('nombre_contacto', v)} />
        <Campo label="Cargo del contacto" valor={form.cargo_contacto} onChange={v => set('cargo_contacto', v)} />
      </div>
      <div className="pipeline-grid-2">
        <Campo label="Teléfono" valor={form.telefono} onChange={v => set('telefono', v)} />
        <Campo label="Correo" tipo="email" valor={form.email} onChange={v => set('email', v)} />
      </div>

      <div className="pipeline-grid-2">
        <Campo label="Fuente" valor={form.fuente} onChange={v => set('fuente', v)} placeholder="Referido, web, llamada…" />
        <div className="campo">
          <label className="etiqueta-campo">Responsable</label>
          <select value={form.responsable_id} onChange={e => set('responsable_id', e.target.value)}>
            <option value="">Sin asignar</option>
            {equipo.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="pipeline-grid-2">
        <Campo label="Próxima acción" valor={form.proxima_accion} onChange={v => set('proxima_accion', v)} placeholder="Llamar, enviar propuesta…" />
        <Campo label="Fecha próxima acción" tipo="datetime-local" valor={form.fecha_proxima_accion} onChange={v => set('fecha_proxima_accion', v)} />
      </div>

      <div className="campo">
        <label className="etiqueta-campo">Observaciones</label>
        <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
      </div>

      <div className="fila-botones">
        <button type="button" className="boton boton-secundario" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="button" className="boton" onClick={onGuardar} disabled={guardando}>Guardar</button>
      </div>
    </div>
  );
}

function Campo({ label, tipo = 'text', valor, onChange, placeholder }) {
  return (
    <div className="campo">
      <label className="etiqueta-campo">{label}</label>
      <input type={tipo} value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
