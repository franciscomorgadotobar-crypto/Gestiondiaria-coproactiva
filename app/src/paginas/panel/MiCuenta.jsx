import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { useVolverGlobal } from '../../lib/navegacion';
import { inicioSegunArea } from '../../lib/area';
import './MiCuenta.css';

const DEFAULT_NAV = ['inicio', 'comunidades', 'levantamientos', 'notificaciones'];

const ITEMS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'comunidades', label: 'Comunidades' },
  { id: 'levantamientos', label: 'Levantamientos' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'plantillas', label: 'Plantillas', roles: ['superadmin', 'admin', 'jefatura'] },
  { id: 'bitacora', label: 'Bitácora' },
  { id: 'mantenciones', label: 'Mantenciones' },
  { id: 'mapa', label: 'Mapa' }
];

function etiquetaRol(rol) {
  const nombres = {
    superadmin: 'Superadministrador',
    admin: 'Administrador',
    jefatura: 'Jefatura',
    terreno: 'Terreno',
    cliente: 'Cliente'
  };
  return nombres[rol] || rol || '—';
}

export default function MiCuenta() {
  const navegar = useNavigate();
  const { perfil, recargarPerfil } = useSesion();
  useVolverGlobal(() => navegar(inicioSegunArea()));

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [barra, setBarra] = useState(DEFAULT_NAV);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const disponibles = useMemo(() => ITEMS.filter(item =>
    !item.roles || item.roles.includes(perfil?.rol)
  ), [perfil?.rol]);

  useEffect(() => {
    if (!perfil) return;
    setNombre(perfil.nombre || '');
    setTelefono(perfil.telefono || '');
    const preferida = Array.isArray(perfil.bottom_nav) && perfil.bottom_nav.length === 4
      ? perfil.bottom_nav
      : DEFAULT_NAV;
    const permitidos = new Set(disponibles.map(x => x.id));
    const validos = preferida.filter(id => permitidos.has(id));
    for (const item of disponibles) {
      if (validos.length >= 4) break;
      if (!validos.includes(item.id)) validos.push(item.id);
    }
    setBarra(validos.slice(0, 4));
  }, [perfil, disponibles]);

  function cambiarAcceso(pos, valor) {
    setBarra(xs => xs.map((x, i) => i === pos ? valor : x));
    setError(null);
    setAviso(null);
  }

  function restaurar() {
    const permitidos = new Set(disponibles.map(x => x.id));
    const base = DEFAULT_NAV.filter(id => permitidos.has(id));
    for (const item of disponibles) {
      if (base.length >= 4) break;
      if (!base.includes(item.id)) base.push(item.id);
    }
    setBarra(base.slice(0, 4));
    setError(null);
    setAviso(null);
  }

  async function guardar() {
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    if (barra.length !== 4 || barra.some(x => !x)) {
      return setError('Selecciona cuatro accesos para la barra inferior.');
    }
    if (new Set(barra).size !== barra.length) {
      return setError('No repitas accesos en la barra inferior.');
    }

    setGuardando(true);
    setError(null);
    setAviso(null);

    const { error } = await supabase.rpc('perfil_actualizar_mi_cuenta', {
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim() || null,
      p_bottom_nav: barra
    });

    if (error) {
      setGuardando(false);
      return setError(error.message);
    }

    await recargarPerfil?.();
    setGuardando(false);
    setAviso('Tus datos y preferencias se guardaron.');
  }

  return (
    <div className="pantalla mi-cuenta-pantalla modulo-unificado">
      <header className="encabezado modulo-cabecera">
        <div className="fila navegacion-interna" style={{ marginBottom: 8 }}>
          <button className="boton boton-texto" style={{ padding: '4px 8px 4px 0' }}
                  onClick={() => navegar(inicioSegunArea())}>
            ‹ Volver
          </button>
        </div>
        <h1 className="h3">Mi cuenta</h1>
        <p className="chico apagado" style={{ margin: '3px 0 0' }}>
          Configura tus datos, firma de correo y accesos de la aplicación.
        </p>
      </header>

      <div className="cuerpo mi-cuenta-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {aviso && <div className="aviso aviso-ok">{aviso}</div>}

        <section className="tarjeta mi-cuenta-seccion">
          <div className="mi-cuenta-seccion-cabecera">
            <div>
              <h2>Datos personales</h2>
              <p>Estos datos identifican tu cuenta dentro de CoproActiva.</p>
            </div>
          </div>

          <div className="mi-cuenta-form-grid">
            <label className="campo">
              <span className="etiqueta-campo">Nombre *</span>
              <input value={nombre} onChange={e => setNombre(e.target.value)} />
            </label>

            <label className="campo">
              <span className="etiqueta-campo">Teléfono</span>
              <input value={telefono} onChange={e => setTelefono(e.target.value)}
                     inputMode="tel" placeholder="+56 9 1234 5678" />
            </label>

            <label className="campo">
              <span className="etiqueta-campo">Correo</span>
              <input value={perfil?.email || ''} readOnly disabled />
              <span className="micro apagado">
                El correo de acceso lo define el superadministrador y no se puede modificar desde Mi cuenta.
              </span>
            </label>

            <label className="campo">
              <span className="etiqueta-campo">Perfil</span>
              <input value={etiquetaRol(perfil?.rol)} readOnly disabled />
            </label>
          </div>
        </section>

        {['superadmin','admin','jefatura'].includes(perfil?.rol)&&<EditorFirmaCorreo perfil={perfil}/>}
        <section className="tarjeta mi-cuenta-seccion">
          <div className="mi-cuenta-seccion-cabecera">
            <div>
              <h2>Barra inferior</h2>
              <p>
                Elige cuatro accesos rápidos. <b>Más</b> siempre ocupa la quinta posición
                y muestra las opciones que no dejaste fijas.
              </p>
            </div>
            <button type="button" className="boton boton-texto" onClick={restaurar}>
              Restaurar
            </button>
          </div>

          <div className="mi-cuenta-nav-selectores">
            {barra.map((valor, i) => (
              <label className="campo" key={i}>
                <span className="etiqueta-campo">Acceso {i + 1}</span>
                <select value={valor} onChange={e => cambiarAcceso(i, e.target.value)}>
                  {disponibles.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mi-cuenta-preview">
            {barra.map(id => (
              <div key={id}>
                <span className="mi-cuenta-preview-icono">•</span>
                <small>{ITEMS.find(x => x.id === id)?.label || id}</small>
              </div>
            ))}
            <div>
              <span className="mi-cuenta-preview-icono">☰</span>
              <small>Más</small>
            </div>
          </div>
        </section>

        <button type="button" className="boton boton-movil mi-cuenta-guardar"
                disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}


const FIRMA_BASE={
  nombre:'',cargo:'',empresa:'Coproactiva Administración SpA',telefono:'',
  correo:'contacto@coproactiva.cl',web:'www.coproactiva.cl',
  texto_adicional:'',logo_path:null,activa:true,seguimiento_aperturas:true
};
function urlLogoFirma(path, version) {
  if(!path)return '';
  const {data}=supabase.storage.from('firmas-correo').getPublicUrl(path);
  return data?.publicUrl ? data.publicUrl+'?v='+encodeURIComponent(String(version||1)) : '';
}

function EditorFirmaCorreo({perfil}) {
  const [firma,setFirma]=useState({...FIRMA_BASE});
  const [firmaExiste,setFirmaExiste]=useState(false);
  const [logoArchivo,setLogoArchivo]=useState(null);
  const [quitarLogo,setQuitarLogo]=useState(false);
  const [logoVersion,setLogoVersion]=useState(1);
  const [logoTemporal,setLogoTemporal]=useState('');
  const [cargando,setCargando]=useState(true);
  const [guardando,setGuardando]=useState(false);
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');

  useEffect(()=>{
    if(!perfil?.id)return;
    let activo=true;
    setCargando(true);
    supabase.from('firmas_correo').select('*').eq('usuario_id',perfil.id).maybeSingle()
      .then(({data,error})=>{
        if(!activo)return;
        if(error)setError('No se pudo cargar la firma: '+error.message);
        else {setFirmaExiste(Boolean(data));setFirma(data||{...FIRMA_BASE,nombre:perfil.nombre||'',telefono:perfil.telefono||''});}
        if(data?.actualizada_en)setLogoVersion(new Date(data.actualizada_en).getTime());
        setCargando(false);
      });
    return ()=>{activo=false;};
  },[perfil?.id]);

  useEffect(()=>{
    if(!logoArchivo){setLogoTemporal('');return;}
    const url=URL.createObjectURL(logoArchivo);
    setLogoTemporal(url);
    return ()=>URL.revokeObjectURL(url);
  },[logoArchivo]);

  function campo(nombre,valor){setFirma(f=>({...f,[nombre]:valor}));setAviso('');setError('');}
  function elegirLogo(evento){
    const archivo=evento.target.files?.[0];
    evento.target.value='';
    if(!archivo)return;
    if(!['image/png','image/jpeg','image/webp'].includes(archivo.type)){
      setError('El logo debe ser PNG, JPG o WebP.');return;
    }
    if(archivo.size>500000){
      setError('El logo debe pesar menos de 500 KB.');return;
    }
    setLogoArchivo(archivo);
    setQuitarLogo(false);
    setError('');
    setAviso('Logo seleccionado. Guarda la firma para aplicarlo.');
  }
  const rutaLogo=quitarLogo?'':firma.logo_path;
  const urlPreview=logoTemporal||urlLogoFirma(rutaLogo,logoVersion);
  async function guardarFirma(e){
    e.preventDefault();
    if(guardando||!perfil?.id)return;
    if(!firma.nombre.trim())return setError('Escribe tu nombre para la firma.');
    setGuardando(true);setError('');setAviso('');
    let nuevaRuta=quitarLogo?null:firma.logo_path;
    const anterior=firma.logo_path;
    try{
      if(logoArchivo){
        const ext=logoArchivo.type==='image/png'?'png':logoArchivo.type==='image/webp'?'webp':'jpg';
        nuevaRuta=perfil.id+'/logo.'+ext;
        const {error:uploadError}=await supabase.storage.from('firmas-correo')
          .upload(nuevaRuta,logoArchivo,{contentType:logoArchivo.type,upsert:true,cacheControl:'3600'});
        if(uploadError)throw new Error('No se pudo cargar el logo: '+uploadError.message);
      }
      const datos={
        usuario_id:perfil.id,
        nombre:firma.nombre.trim(),
        cargo:firma.cargo.trim(),
        empresa:firma.empresa.trim(),
        telefono:firma.telefono.trim(),
        correo:firma.correo.trim(),
        web:firma.web.trim(),
        texto_adicional:firma.texto_adicional.trim(),
        logo_path:nuevaRuta,
        activa:!!firma.activa,
        seguimiento_aperturas:firma.seguimiento_aperturas!==false,
        actualizada_en:new Date().toISOString()
      };
      const {error:saveError}=await supabase.from('firmas_correo').upsert(datos,{onConflict:'usuario_id'});
      if(saveError)throw new Error('No se pudo guardar la firma: '+saveError.message);
      setFirma(datos);
      setFirmaExiste(true);
      setLogoArchivo(null);
      setQuitarLogo(false);
      setLogoVersion(Date.now());
      setAviso('Firma guardada. Se aplicará automáticamente a tus próximos correos.');
      if(anterior&&anterior!==nuevaRuta){
        supabase.storage.from('firmas-correo').remove([anterior]).then(({error:removeError})=>{
          if(removeError)console.warn('No se pudo eliminar el logo anterior',removeError.message);
        });
      }
    }catch(err){setError(err.message||'No se pudo guardar la firma.');}
    finally{setGuardando(false);}
  }

  return <section id="firma-correo" className="tarjeta mi-cuenta-seccion mi-cuenta-firma">
    <div className="mi-cuenta-seccion-cabecera">
      <div><h2>Firma de correo</h2>
        <p>Como en Gmail, configura tu propia firma una vez. Se insertará automáticamente en los correos que envíes desde el CRM.</p>
      </div>
    </div>
    {cargando?<p className="chico apagado">Cargando tu firma…</p>:<form onSubmit={guardarFirma}>
      <label className="mi-cuenta-firma-check">
        <input type="checkbox" checked={firma.activa} onChange={e=>campo('activa',e.target.checked)}/>
        Añadir esta firma automáticamente a mis correos
      </label>
      <div className="mi-cuenta-seguimiento-correo">
        <label className="mi-cuenta-firma-check">
          <input type="checkbox" checked={firma.seguimiento_aperturas!==false}
            onChange={e=>campo('seguimiento_aperturas',e.target.checked)}/>
          Registrar aperturas detectadas en los correos enviados desde el CRM
        </label>
        <p className="micro apagado">Se añade un indicador de carga de imagen a los nuevos mensajes y una nota informativa al destinatario. No confirma lectura; no registramos IP, ubicación ni dispositivo en el CRM. Puedes desactivarlo para tus próximos envíos.</p>
      </div>
      <div className="mi-cuenta-form-grid">
        <label className="campo"><span className="etiqueta-campo">Nombre *</span>
          <input value={firma.nombre} maxLength={120} required onChange={e=>campo('nombre',e.target.value)}/></label>
        <label className="campo"><span className="etiqueta-campo">Cargo</span>
          <input value={firma.cargo} maxLength={120} placeholder="Administración" onChange={e=>campo('cargo',e.target.value)}/></label>
        <label className="campo"><span className="etiqueta-campo">Empresa</span>
          <input value={firma.empresa} maxLength={140} onChange={e=>campo('empresa',e.target.value)}/></label>
        <label className="campo"><span className="etiqueta-campo">Teléfono</span>
          <input value={firma.telefono} maxLength={60} inputMode="tel" onChange={e=>campo('telefono',e.target.value)}/></label>
        <label className="campo"><span className="etiqueta-campo">Correo de contacto</span>
          <input value={firma.correo} maxLength={150} type="email" onChange={e=>campo('correo',e.target.value)}/></label>
        <label className="campo"><span className="etiqueta-campo">Sitio web</span>
          <input value={firma.web} maxLength={150} onChange={e=>campo('web',e.target.value)}/></label>
      </div>
      <label className="campo"><span className="etiqueta-campo">Texto adicional (opcional)</span>
        <textarea rows={2} maxLength={750} value={firma.texto_adicional}
          placeholder="Una frase corporativa o información adicional"
          onChange={e=>campo('texto_adicional',e.target.value)}/></label>
      <div className="mi-cuenta-firma-logo">
        <span className="etiqueta-campo">Logo en la firma</span>
        <div className="mi-cuenta-firma-logo-acciones">
          <label className="boton boton-secundario" htmlFor="firma-logo-subir">Agregar o cambiar logo</label>
          <input id="firma-logo-subir" type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirLogo}/>
          {(urlPreview||logoArchivo)&&<button type="button" className="boton boton-texto"
            onClick={()=>{setLogoArchivo(null);setQuitarLogo(true);setAviso('Guarda la firma para quitar el logo.');}}>Quitar logo</button>}
        </div>
        <p className="micro apagado">PNG, JPG o WebP · máximo 500 KB. El logo será visible públicamente como imagen de la firma.</p>
      </div>
      <div className="mi-cuenta-firma-previa">
        <strong>Vista previa de tu firma</strong>
        <div className="mi-cuenta-firma-preview-fila">
          {urlPreview&&<img src={urlPreview} alt="Logo de firma" className="mi-cuenta-firma-preview-logo"/>}
          <div className="mi-cuenta-firma-preview-texto">
            <strong>{firma.nombre||'Nombre'}</strong>
            {firma.cargo&&<span>{firma.cargo}</span>}
            {firma.empresa&&<span>{firma.empresa}</span>}
            {firma.telefono&&<span>{firma.telefono}</span>}
            {firma.correo&&<span>{firma.correo}</span>}
            {firma.web&&<span>{firma.web}</span>}
            {firma.texto_adicional&&<span className="mi-cuenta-firma-adicional">{firma.texto_adicional}</span>}
          </div>
        </div>
      </div>
      {error&&<p className="aviso aviso-critico" role="alert">{error}</p>}
      {aviso&&<p className="aviso aviso-ok" role="status">{aviso}</p>}
      <button type="submit" className="boton" disabled={guardando}>
        {guardando?'Guardando firma…':firmaExiste?'Guardar firma':'Agregar firma'}
      </button>
    </form>}
  </section>;
}
