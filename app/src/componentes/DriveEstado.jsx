import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Confirmar from './Confirmar';
import {
  CATEGORIAS_DRIVE, autorizarDrive, desconectarDrive, estadoOAuthDrive, fechaHoraCL, llamarDrive, verificarConexionDrive
} from '../lib/drive';
import './DriveArchivos.css';

const CONEXION = {
  conectada: ['chip-cumple', 'Conectada'],
  desconectada: ['chip-pendiente', 'Sin autorizar'],
  revocada: ['chip-critico', 'Autorización revocada'],
  error: ['chip-critico', 'Con error']
};
const CARPETA = {
  lista: ['chip-cumple', 'Vinculada'],
  pendiente: ['chip-pendiente', 'Pendiente de crear'],
  en_proceso: ['chip-alerta', 'En proceso'],
  sin_configurar: ['chip-pendiente', 'Esperando autorización de Drive'],
  error: ['chip-critico', 'Error · se reintentará'],
  revision: ['chip-critico', 'Requiere revisión']
};
const MOTIVOS = {
  cancelado: 'Se canceló la autorización en Google.',
  cuenta_incorrecta: 'Debes autorizar con la cuenta contacto@coproactiva.cl. No se guardó ninguna otra cuenta.',
  estado_invalido: 'El enlace de autorización expiró o ya se usó. Vuelve a presionar "Autorizar Google Drive".',
  permisos_incompletos: 'No se concedió el permiso de Google Drive solicitado.',
  sin_acceso_offline: 'Google no entregó acceso permanente. Vuelve a autorizar.',
  sin_permiso: 'Solo un administrador activo puede autorizar Google Drive.',
  sin_cliente: 'Falta la configuración del cliente OAuth en el servidor.',
  intercambio: 'Google rechazó la autorización. Vuelve a intentarlo.',
  sin_codigo: 'Google no devolvió la autorización. Vuelve a intentarlo.',
  interno: 'Ocurrió un error interno al completar la autorización.'
};

export default function DriveEstado({ comunidadId }) {
  const location = useLocation();
  const navegar = useNavigate();
  const [oauth, setOauth] = useState(null);
  const [carpeta, setCarpeta] = useState(null);
  const [carpetaId, setCarpetaId] = useState(null);
  const [agrupaciones, setAgrupaciones] = useState(null);
  const [agrupacion, setAgrupacion] = useState('');
  const [nuevaAgrupacion, setNuevaAgrupacion] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    const [o, c, com] = await Promise.all([
      estadoOAuthDrive().catch(e => ({ error: e.message })),
      supabase.from('drive_carpetas_comunidad')
        .select('estado,carpetas,carpeta_nombre,agrupacion_id,agrupacion_nombre,verificado_en,ultimo_error,ultimo_intento,siguiente_intento')
        .eq('comunidad_id', comunidadId).maybeSingle(),
      supabase.from('comunidades').select('carpeta_drive_id').eq('id', comunidadId).maybeSingle()
    ]);
    if (o?.error) setError(o.error); else setOauth(o);
    if (c.error) setError(c.error.message); else setCarpeta(c.data);
    setCarpetaId(com.data?.carpeta_drive_id ?? null);
    setCargado(true);
  }, [comunidadId]);

  const comprobarCarpetas = useCallback(async (silencioso = false) => {
    setOcupado('carpetas'); setError(''); if (!silencioso) setAviso('');
    try {
      const r = await llamarDrive('provision', { comunidad_id: comunidadId });
      setAviso(`Carpeta "${r.carpeta_nombre}" comprobada: las cuatro categorías están disponibles.`);
    } catch (e) { setError(e.message); }
    await cargar();
    setOcupado('');
  }, [comunidadId, cargar]);

  useEffect(() => { cargar(); }, [cargar]);

  // Regreso desde Google: ?drive=conectado | ?drive=error&motivo=…
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const resultado = p.get('drive');
    if (!resultado) return;
    const motivo = p.get('motivo');
    p.delete('drive'); p.delete('motivo');
    navegar({ pathname: location.pathname, search: p.toString() ? '?' + p.toString() : '' }, { replace: true });
    if (resultado === 'conectado') {
      setAviso('Google Drive quedó conectado con contacto@coproactiva.cl. Comprobando la carpeta de esta comunidad…');
      comprobarCarpetas(true);
    } else setError(MOTIVOS[motivo] || 'No se pudo completar la autorización de Google Drive.');
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function autorizar() {
    setOcupado('oauth'); setError('');
    try { await autorizarDrive(`/comunidades/${comunidadId}?seccion=configuracion`); }
    catch (e) { setError(e.message); setOcupado(''); }
  }

  async function verificar() {
    setOcupado('verificar'); setError(''); setAviso('');
    try {
      const r = await verificarConexionDrive();
      if (r.ok) setAviso(`Conexión verificada: acceso a "${r.raiz}" y "${r.comunidades}".`);
    } catch (e) { setError(e.message); }
    await cargar(); setOcupado('');
  }

  async function desconectar() {
    setConfirmarDesconexion(false); setOcupado('oauth'); setError('');
    try { await desconectarDrive(); setAviso('Google Drive se desconectó. Las carpetas y archivos se conservan en Drive.'); }
    catch (e) { setError(e.message); }
    await cargar(); setOcupado('');
  }

  async function cargarAgrupaciones() {
    setOcupado('agrupaciones'); setError('');
    try { const r = await llamarDrive('agrupaciones', { comunidad_id: comunidadId }); setAgrupaciones(r.agrupaciones || []); }
    catch (e) { setError(e.message); }
    setOcupado('');
  }

  async function guardarAgrupacion() {
    setOcupado('agrupaciones'); setError(''); setAviso('');
    try {
      const r = await llamarDrive('asignar_agrupacion', {
        comunidad_id: comunidadId, agrupacion_id: agrupacion || null, agrupacion_nueva: nuevaAgrupacion.trim() || null
      });
      setAviso(r.agrupacion_nombre ? `La carpeta se creará dentro de "${r.agrupacion_nombre}".` : 'La carpeta se creará directamente en Comunidades.');
      setNuevaAgrupacion('');
      await cargar();
    } catch (e) { setError(e.message); }
    setOcupado('');
  }

  if (!cargado) {
    return (
      <section className="tarjeta drive-archivos" style={{ marginTop: 0, marginBottom: 20 }} aria-label="Google Drive" aria-busy="true">
        <h3 className="h4" style={{ margin: 0 }}>Google Drive</h3>
        <p className="micro apagado" style={{ margin: '6px 0 0' }}>Consultando el estado de la conexión y de la carpeta…</p>
        {error && <div role="alert" className="aviso aviso-critico">{error}</div>}
      </section>
    );
  }

  const c = oauth?.conexion;
  const [claseC, textoC] = CONEXION[c?.estado] ?? CONEXION.desconectada;
  const [claseF, textoF] = CARPETA[carpeta?.estado] ?? CARPETA.pendiente;
  const conectada = c?.estado === 'conectada';
  const enlace = carpetaId ? 'https://drive.google.com/drive/folders/' + encodeURIComponent(carpetaId) : null;
  const categorias = carpeta?.carpetas || {};

  return (
    <section className="tarjeta drive-archivos" style={{ marginTop: 0, marginBottom: 20 }} aria-label="Google Drive">
      <div className="drive-archivos-cabecera">
        <h3 className="h4">Google Drive</h3>
        <span className={'chip ' + claseC}>{textoC}</span>
      </div>
      <p className="micro apagado" style={{ margin: '4px 0 0' }}>
        Los documentos de la comunidad se guardan en el Drive corporativo. La aplicación conserva solo sus referencias e historial.
      </p>
      {error && <div role="alert" className="aviso aviso-critico">{error}</div>}
      {aviso && <div role="status" className="aviso aviso-ok">{aviso}</div>}

      <div className="drive-estado-grid">
        <div><span>Cuenta Google vinculada</span><strong>{c?.cuenta_email || (oauth?.cuenta_esperada ? `Pendiente (${oauth.cuenta_esperada})` : '—')}</strong></div>
        <div><span>Conectada desde</span><strong>{c?.conectada_en && conectada ? fechaHoraCL(c.conectada_en) : '—'}</strong></div>
        <div><span>Última verificación de conexión</span><strong>{c?.ultima_verificacion ? fechaHoraCL(c.ultima_verificacion) : '—'}</strong></div>
      </div>
      {c?.ultimo_error && <p className="aviso" role="status">{c.ultimo_error}</p>}

      {oauth?.puede_autorizar ? (
        <div className="drive-acciones">
          {!conectada && <button type="button" className="boton" onClick={autorizar} disabled={!!ocupado || !oauth?.cliente_configurado}>
            {ocupado === 'oauth' ? 'Abriendo Google…' : c?.estado === 'revocada' || c?.cuenta_email ? 'Reconectar Google Drive' : 'Autorizar Google Drive'}
          </button>}
          {conectada && <button type="button" className="boton boton-secundario" onClick={verificar} disabled={!!ocupado}>
            {ocupado === 'verificar' ? 'Verificando…' : 'Verificar conexión'}
          </button>}
          {conectada && <button type="button" className="boton boton-secundario" onClick={autorizar} disabled={!!ocupado}>Reconectar</button>}
          {conectada && <button type="button" className="boton boton-texto peligro" onClick={() => setConfirmarDesconexion(true)} disabled={!!ocupado}>Desconectar</button>}
        </div>
      ) : (!conectada && <p className="micro apagado">Solo un administrador puede autorizar Google Drive.</p>)}

      <hr className="drive-separador" />

      <div className="drive-archivos-cabecera">
        <h4 className="h4" style={{ margin: 0 }}>Carpeta de la comunidad</h4>
        <span className={'chip ' + claseF}>{textoF}</span>
      </div>
      <div className="drive-estado-grid">
        <div><span>Carpeta principal</span><strong>{carpeta?.carpeta_nombre || (carpetaId ? 'Vinculada' : 'Sin crear')}</strong></div>
        <div><span>Agrupación</span><strong>{carpeta?.agrupacion_nombre || (carpetaId ? 'Según ubicación en Drive' : 'Comunidades')}</strong></div>
        <div><span>Última sincronización comprobada</span><strong>{carpeta?.verificado_en ? fechaHoraCL(carpeta.verificado_en) : 'Aún no comprobada'}</strong></div>
      </div>
      {enlace && <p style={{ margin: '0 0 8px' }}><a href={enlace} target="_blank" rel="noreferrer">Abrir carpeta en Google Drive</a></p>}
      {Object.keys(categorias).length > 0 && (
        <p className="micro apagado">{Object.keys(CATEGORIAS_DRIVE).filter(k => categorias[k]).map(k => CATEGORIAS_DRIVE[k]).join(' · ')}</p>
      )}
      {carpeta?.ultimo_error && carpeta?.estado !== 'lista' && <p className="aviso aviso-critico" role="alert">{carpeta.ultimo_error}</p>}
      {carpeta?.estado === 'error' && carpeta?.siguiente_intento && (
        <p className="micro apagado">Reintento automático: {fechaHoraCL(carpeta.siguiente_intento)}.</p>
      )}

      {!carpetaId && (
        <div className="campo" style={{ marginTop: 8 }}>
          <span className="etiqueta-campo">Agrupación de cliente o inmobiliaria (opcional)</span>
          {agrupaciones === null ? (
            <button type="button" className="boton boton-texto" onClick={cargarAgrupaciones} disabled={!conectada || !!ocupado}>
              {ocupado === 'agrupaciones' ? 'Cargando…' : 'Elegir agrupación existente en Drive'}
            </button>
          ) : (
            <>
              <select value={agrupacion} onChange={e => setAgrupacion(e.target.value)} aria-label="Agrupación en Drive">
                <option value="">Directamente en Comunidades</option>
                {agrupaciones.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input style={{ marginTop: 8 }} placeholder="O crear una agrupación nueva (ej.: nombre de la inmobiliaria)"
                     value={nuevaAgrupacion} onChange={e => setNuevaAgrupacion(e.target.value)} maxLength={120} />
              <div className="drive-acciones">
                <button type="button" className="boton boton-secundario" onClick={guardarAgrupacion} disabled={!!ocupado}>Guardar agrupación</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="drive-acciones">
        <button type="button" className="boton boton-secundario" onClick={() => comprobarCarpetas()} disabled={!!ocupado || !conectada}>
          {ocupado === 'carpetas' ? 'Comprobando…' : carpeta?.estado === 'lista' ? 'Comprobar carpetas' : carpeta?.estado === 'error' || carpeta?.estado === 'revision' ? 'Reintentar' : 'Crear carpetas ahora'}
        </button>
      </div>

      {confirmarDesconexion && (
        <Confirmar
          titulo="Desconectar Google Drive"
          mensaje="La aplicación dejará de guardar y abrir documentos en Drive hasta que un administrador vuelva a autorizar. Las carpetas y archivos no se eliminan."
          textoConfirmar="Desconectar"
          textoCancelar="Cancelar"
          onCancelar={() => setConfirmarDesconexion(false)}
          onConfirmar={desconectar}
        />
      )}
    </section>
  );
}
