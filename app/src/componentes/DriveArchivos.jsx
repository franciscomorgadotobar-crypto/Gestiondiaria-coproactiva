import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';
import Confirmar from './Confirmar';
import {
  CATEGORIAS_DRIVE, DRIVE_ACCEPT, ORIGENES_DRIVE, conexionDrive, descargarDeDrive, eliminarDeDrive,
  fechaHoraCL, sePuedeVer, subirADrive, tamanoLegible, validarArchivoDrive, verEnDrive, visibilidadDrive
} from '../lib/drive';
import './DriveArchivos.css';

const PERSONAL = ['superadmin', 'admin', 'jefatura'];
const ACCIONES = {
  subido: 'Subido', descargado: 'Descargado', visto: 'Visualizado', eliminado: 'Enviado a la papelera de Drive',
  publicado_cliente: 'Publicado al portal cliente', retirado_cliente: 'Retirado del portal cliente'
};

/* Documentos guardados en Google Drive. Supabase conserva solo metadatos,
 * autoría e historial; los bytes viven en la carpeta de la comunidad. */
export default function DriveArchivos({
  comunidadId, origenTipo = 'levantamiento', origenId = null, detalleId = null, categoria = null,
  titulo, ayuda, permitirSubir = true, compacto = false, ocultarVacio = false, onCambio,
  soloVistaCliente = false
}) {
  const { perfil } = useSesion();
  const rol = perfil?.rol;
  const personal = PERSONAL.includes(rol) && !soloVistaCliente;
  const puedeSubir = !soloVistaCliente && Boolean(origenTipo) && permitirSubir && (personal || (rol === 'terreno' && origenTipo === 'levantamiento'));
  const [archivos, setArchivos] = useState([]);
  const [conectada, setConectada] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [verEliminados, setVerEliminados] = useState(false);
  const [historial, setHistorial] = useState({});
  const [confirmar, setConfirmar] = useState(null);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    if (!comunidadId) return;
    const { data, error: err } = await supabase.rpc('drive_listar_documentos', {
      p_comunidad_id: comunidadId,
      p_origen_tipo: origenTipo || null,
      p_origen_id: origenId ? String(origenId) : null,
      p_incluir_eliminados: personal && verEliminados
    });
    if (err) setError(err.message);
    else setArchivos((data || []).filter(d =>
      (!soloVistaCliente || (d.visible_cliente===true && !d.eliminado_en)) &&
      (!detalleId || d.detalle_id === String(detalleId))));
    setCargado(true);
  }, [comunidadId, origenTipo, origenId, detalleId, personal, verEliminados, soloVistaCliente]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!puedeSubir) return;
    conexionDrive().then(c => setConectada(Boolean(c?.conectada)));
  }, [puedeSubir]);

  function elegir(e) {
    const lista = Array.from(e.target.files || []);
    const errores = lista.map(validarArchivoDrive).filter(Boolean);
    setError(errores.join(' '));
    setOk('');
    setPendientes(prev => [...prev, ...lista.filter(f => !validarArchivoDrive(f))
      .map(file => ({ file, clave: crypto.randomUUID(), estado: 'pendiente' }))]);
    e.target.value = '';
  }

  async function subir() {
    if (!pendientes.length || ocupado) return;
    setOcupado(true); setError(''); setOk('');
    let guardados = 0;
    const restantes = [];
    for (const p of pendientes) {
      try {
        await subirADrive({ comunidadId, origenTipo, origenId, detalleId, categoria, archivo: p.file, clave: p.clave });
        guardados++;
      } catch (e) {
        restantes.push({ ...p, estado: 'error', error: e.message });
      }
    }
    setPendientes(restantes);
    if (guardados) setOk(guardados === 1 ? '1 archivo guardado en Google Drive.' : `${guardados} archivos guardados en Google Drive.`);
    if (restantes.length) setError(`${restantes.length} archivo(s) no se guardaron. Puedes reintentar sin duplicarlos.`);
    await cargar();
    setOcupado(false);
    if (guardados) onCambio?.();
  }

  async function accion(fn, doc) {
    setError('');
    try { await fn(); } catch (e) { setError(e.message || 'No se pudo completar la acción.'); }
    if (doc && historial[doc.id]) verHistorial(doc, true);
  }

  async function cambiarVisibilidad(doc, confirmado = false) {
    setError('');
    try {
      await visibilidadDrive(comunidadId, doc.id, !doc.visible_cliente, confirmado);
      await cargar();
    } catch (e) {
      if (e.datos?.requiere_confirmacion) {
        setConfirmar({
          titulo: 'Publicar documento al cliente',
          mensaje: `"${doc.nombre}" pertenece a ${CATEGORIAS_DRIVE[doc.categoria]}. Confirma que no contiene información contable, personal, laboral o contractual reservada.`,
          texto: 'Sí, publicar',
          accion: () => cambiarVisibilidad(doc, true)
        });
      } else setError(e.message);
    }
  }

  function pedirEliminar(doc) {
    setConfirmar({
      titulo: 'Eliminar documento',
      mensaje: `"${doc.nombre}" se enviará a la papelera de Google Drive y dejará de verse en la aplicación. El historial se conserva.`,
      texto: 'Enviar a la papelera',
      accion: async () => {
        setOk(''); setError('');
        try { await eliminarDeDrive(comunidadId, doc.id); setOk(`"${doc.nombre}" se envió a la papelera de Google Drive.`); await cargar(); onCambio?.(); }
        catch (e) { setError(e.message); }
      }
    });
  }

  async function verHistorial(doc, forzar = false) {
    if (historial[doc.id] && !forzar) { setHistorial(h => { const x = { ...h }; delete x[doc.id]; return x; }); return; }
    const { data, error: err } = await supabase.rpc('drive_historial', { p_comunidad_id: comunidadId, p_documento_id: doc.id, p_limite: 50 });
    if (err) setError(err.message); else setHistorial(h => ({ ...h, [doc.id]: data || [] }));
  }

  if (ocultarVacio && cargado && !archivos.length && !puedeSubir) return null;

  const tituloFinal = titulo || (origenTipo ? `Documentos · ${ORIGENES_DRIVE[origenTipo] || 'Drive'}` : 'Documentos en Google Drive');
  return (
    <section className={'tarjeta drive-archivos' + (compacto ? ' drive-compacto' : '')} aria-label={tituloFinal}>
      <div className="drive-archivos-cabecera">
        <h3 className="h4">{tituloFinal}</h3>
        {personal && <label className="micro apagado">
          <input type="checkbox" checked={verEliminados} onChange={e => setVerEliminados(e.target.checked)} /> Mostrar eliminados
        </label>}
      </div>
      {ayuda && <p className="micro apagado" style={{ margin: '4px 0 0' }}>{ayuda}</p>}
      {error && <p className="aviso aviso-critico" role="alert">{error}</p>}
      {ok && <p className="aviso aviso-ok" role="status">{ok}</p>}

      {puedeSubir && conectada === false && (
        <p className="aviso" role="status">Google Drive aún no está autorizado. Un administrador debe conectarlo en Comunidades → Configuración.</p>
      )}
      {puedeSubir && conectada && (
        <>
          <div className="drive-carga">
            <input type="file" multiple accept={DRIVE_ACCEPT} aria-label="Seleccionar archivos para Google Drive" onChange={elegir} disabled={ocupado} />
            <button type="button" className="boton" disabled={!pendientes.length || ocupado} onClick={subir}>
              {ocupado ? 'Guardando…' : pendientes.some(p => p.estado === 'error') ? 'Reintentar' : 'Guardar en Drive'}
            </button>
          </div>
          <p className="micro apagado" style={{ margin: 0 }}>PDF, fotos, Word, Excel, PowerPoint, CSV, TXT o video MP4/MOV · hasta 25 MB por archivo.</p>
          {pendientes.length > 0 && (
            <ul className="drive-pendientes">
              {pendientes.map(p => (
                <li key={p.clave}>
                  <span>{p.file.name} · {tamanoLegible(p.file.size)}{p.error ? ' · ' + p.error : ''}</span>
                  {!ocupado && <button type="button" className="boton boton-texto" onClick={() => setPendientes(xs => xs.filter(x => x.clave !== p.clave))}>Quitar</button>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="drive-lista">
        {archivos.map(d => (
          <article key={d.id} className={'drive-doc' + (d.eliminado_en ? ' drive-eliminado' : '')}>
            <div className="drive-doc-fila">
              <span className="drive-doc-nombre">{d.nombre}</span>
              {d.eliminado_en && <span className="chip chip-pendiente">Eliminado</span>}
              {!d.eliminado_en && personal && d.visible_cliente && <span className="chip chip-cumple">Visible al cliente</span>}
            </div>
            <div className="drive-doc-meta micro apagado">
              {!origenTipo && <span>{ORIGENES_DRIVE[d.origen_tipo] || d.origen_tipo}</span>}
              <span>{CATEGORIAS_DRIVE[d.categoria]}</span>
              <span>{tamanoLegible(d.tamano)}</span>
              <span>{fechaHoraCL(d.creado_en)}{d.registrado_por_nombre ? ' · ' + d.registrado_por_nombre : ''}</span>
              {d.eliminado_en && <span>Eliminado {fechaHoraCL(d.eliminado_en)}{d.eliminado_por_nombre ? ' · ' + d.eliminado_por_nombre : ''}</span>}
            </div>
            {!d.eliminado_en && (
              <div className="drive-doc-acciones">
                {sePuedeVer(d.mime) && <button type="button" className="boton boton-texto" onClick={() => accion(() => verEnDrive(comunidadId, d), d)}>Ver</button>}
                <button type="button" className="boton boton-texto" onClick={() => accion(() => descargarDeDrive(comunidadId, d), d)}>Descargar</button>
                {personal && <button type="button" className="boton boton-texto" onClick={() => cambiarVisibilidad(d)}>
                  {d.visible_cliente ? 'Retirar del portal cliente' : 'Publicar al cliente'}
                </button>}
                {personal && <button type="button" className="boton boton-texto" onClick={() => verHistorial(d)}>{historial[d.id] ? 'Ocultar historial' : 'Historial'}</button>}
                {personal && <button type="button" className="boton boton-texto peligro" onClick={() => pedirEliminar(d)}>Eliminar</button>}
              </div>
            )}
            {d.eliminado_en && personal && (
              <div className="drive-doc-acciones">
                <button type="button" className="boton boton-texto" onClick={() => verHistorial(d)}>{historial[d.id] ? 'Ocultar historial' : 'Historial'}</button>
              </div>
            )}
            {historial[d.id] && (
              <ul className="drive-historial micro apagado">
                {historial[d.id].map(h => <li key={h.id}>{fechaHoraCL(h.creado_en)} · {ACCIONES[h.accion] || h.accion}{h.perfil_nombre ? ' · ' + h.perfil_nombre : ''}</li>)}
                {historial[d.id].length === 0 && <li>Sin movimientos registrados.</li>}
              </ul>
            )}
          </article>
        ))}
        {cargado && archivos.length === 0 && <span className="micro apagado">Sin documentos guardados en Drive.</span>}
      </div>

      {confirmar && (
        <Confirmar
          titulo={confirmar.titulo}
          mensaje={confirmar.mensaje}
          textoConfirmar={confirmar.texto}
          textoCancelar="Cancelar"
          onCancelar={() => setConfirmar(null)}
          onConfirmar={async () => { const a = confirmar.accion; setConfirmar(null); await a(); }}
        />
      )}
    </section>
  );
}
