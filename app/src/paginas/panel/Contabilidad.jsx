import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSesion } from '../../lib/sesion';
import { limpiarArea } from '../../lib/area';
import { useVolverGlobal } from '../../lib/navegacion';
import Confirmar from '../../componentes/Confirmar';
import DialogoCampos from '../../componentes/DialogoCampos';
import ContabilidadConfiguracion from '../../componentes/ContabilidadConfiguracion';
import '../../componentes/ContabilidadConfiguracion.css';
import {
  armarBalanceGeneral,
  armarEstadoResultados,
  descargarPDF,
  descargarPPT,
  moneda,
  textoPeriodo,
  totalesBalance
} from '../../lib/contabilidadReportes';
import './Contabilidad.css';

const VISTAS = [
  ['resumen', 'Resumen', '/contabilidad'],
  ['asientos', 'Asientos', '/contabilidad/asientos'],
  ['plan', 'Plan de cuentas', '/contabilidad/plan'],
  ['reportes', 'Reportes', '/contabilidad/reportes'],
  ['configuracion', 'Configuración', '/contabilidad/configuracion'],
  ['entidades', 'Entidades', '/contabilidad/entidades']
];

const TIPOS_CUENTA = [
  ['activo', 'Activo'],
  ['pasivo', 'Pasivo'],
  ['patrimonio', 'Patrimonio'],
  ['ingreso', 'Ingreso'],
  ['gasto', 'Gasto'],
  ['costo', 'Costo'],
  ['impuesto', 'Impuesto']
];

const TIPOS_CUENTA_FORM = [
  ['activo', 'Activo'],
  ['activo_contra', 'Activo*'],
  ['pasivo', 'Pasivo'],
  ['patrimonio', 'Patrimonio'],
  ['ingreso', 'Ingreso'],
  ['gasto', 'Gasto'],
  ['costo', 'Costo'],
  ['impuesto', 'Impuesto']
];

const EERR_SECCIONES = [
  ['', 'Sin clasificación en EERR'],
  ['ingresos_operacionales', 'Ingresos operacionales'],
  ['costos_prestacion', 'Costos de prestación de servicios'],
  ['gastos_administracion', 'Gastos de administración y ventas'],
  ['resultado_no_operacional', 'Resultado no operacional'],
  ['impuesto_renta', 'Impuesto a la renta']
];

function hoyChile() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function fechaCL(valor) {
  if (!valor) return 'Sin fecha';
  const d = new Date(String(valor).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizar(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function monto(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function agruparAsientosDiario(filas = []) {
  const mapa = new Map();
  for (const x of filas) {
    const clave = x.asiento_id || [x.numero, x.fecha, x.glosa].join('|');
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        asiento_id: x.asiento_id,
        numero: x.numero,
        fecha: x.fecha,
        glosa: x.glosa || '',
        referencia: x.referencia || '',
        lineas: [],
        debe: 0,
        haber: 0
      });
    }
    const asiento = mapa.get(clave);
    asiento.lineas.push(x);
    asiento.debe += Number(x.debe || 0);
    asiento.haber += Number(x.haber || 0);
  }
  return [...mapa.values()];
}

function ListaAsientosDiarioMovil({ asientos }) {
  return (
    <div className="contabilidad-movimientos-movil contabilidad-solo-movil">
      {asientos.map(a => (
        <article className="tarjeta contabilidad-reporte-card" key={a.asiento_id || a.numero}>
          <div className="contabilidad-reporte-card-cabecera">
            <div>
              <span className="micro apagado">{fechaCL(a.fecha)}</span>
              <strong>Asiento N° {a.numero}</strong>
            </div>
          </div>

          <div className="contabilidad-diario-cuentas-movil">
            {a.lineas.map((l, i) => (
              <div key={(l.cuenta_id || '') + '-' + i}>
                <div>
                  <strong>{[l.codigo, l.cuenta].filter(Boolean).join(' · ')}</strong>
                  {l.centro_costo && l.centro_costo !== 'General / Sin asignar' && (
                    <span>Centro de costo: {l.centro_costo}</span>
                  )}
                </div>
                <span className="numero">
                  {Number(l.debe || 0) ? 'Debe ' + moneda(l.debe) : 'Haber ' + moneda(l.haber)}
                </span>
              </div>
            ))}
          </div>

          <div className="contabilidad-reporte-card-grid">
            <div><span>Debe</span><strong>{moneda(a.debe)}</strong></div>
            <div><span>Haber</span><strong>{moneda(a.haber)}</strong></div>
          </div>

          {a.glosa && <p className="micro contabilidad-reporte-card-glosa">{a.glosa}</p>}
        </article>
      ))}
      {!asientos.length && <p className="vacio">No hay asientos para el período seleccionado.</p>}
    </div>
  );
}

function clasificacionDesdeCodigo(codigo) {
  const inicial = String(codigo || '').trim()[0];
  if (inicial === '1') return 'activo';
  if (inicial === '2' || inicial === '3') return 'pasivo';
  if (inicial === '4') return 'ganancia';
  if (['5', '6', '7'].includes(inicial)) return 'perdida';
  return null;
}

function naturalezaDesdeTipo(tipo, codigo) {
  if (String(codigo) === '1202') return 'acreedora';
  if (['pasivo', 'patrimonio', 'ingreso'].includes(tipo)) return 'acreedora';
  return 'deudora';
}

function vistaDesdeRuta(pathname) {
  if (pathname.includes('/asientos')) return 'asientos';
  if (pathname.includes('/plan')) return 'plan';
  if (pathname.includes('/reportes')) return 'reportes';
  if (pathname.includes('/configuracion')) return 'configuracion';
  if (pathname.includes('/entidades')) return 'entidades';
  return 'resumen';
}

function gruposCuentas(cuentas) {
  const orden = ['activo','pasivo','patrimonio','ingreso','costo','gasto','impuesto'];
  return orden
    .map(tipo => [tipo, cuentas.filter(c => c.tipo_contable === tipo && c.activa && c.clase === 'movimiento' && c.imputable !== false)])
    .filter(([, xs]) => xs.length);
}

function etiquetaTipo(tipo, naturaleza = null) {
  if (tipo === 'activo' && naturaleza === 'acreedora') return 'Activo*';
  return TIPOS_CUENTA.find(x => x[0] === tipo)?.[1] ?? tipo;
}

function tipoCuentaFormulario(cuenta) {
  if (cuenta?.tipo_contable === 'activo' && cuenta?.naturaleza === 'acreedora') return 'activo_contra';
  return cuenta?.tipo_contable ?? 'gasto';
}

function lineaVacia() {
  return {
    key: crypto.randomUUID(),
    cuenta_id: '',
    debe: '',
    haber: '',
    glosa: '',
    centro_costo_id: ''
  };
}

function EditorAsiento({ cuentas, proveedores, centros = [], usaCentrosCosto = false, guardando, onGuardar, onCancelar }) {
  const [numeroAsiento, setNumeroAsiento] = useState('');
  const [fecha, setFecha] = useState(hoyChile());
  const [glosa, setGlosa] = useState('');
  const [referencia, setReferencia] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [lineas, setLineas] = useState([lineaVacia(), lineaVacia()]);
  const [montoOperacion, setMontoOperacion] = useState('');
  const grupos = useMemo(() => gruposCuentas(cuentas), [cuentas]);

  const cuentaPorCodigos = codigos => {
    for (const codigo of codigos) {
      const id = cuentas.find(x => x.codigo === codigo && x.activa && x.imputable !== false)?.id;
      if (id) return id;
    }
    return '';
  };

  function aplicarOperacion(tipo) {
    const total = monto(montoOperacion);
    if (total <= 0) return;

    const banco = cuentaPorCodigos(['1.1.01.002','1.1.02','1102']);
    const ivaCredito = cuentaPorCodigos(['1.1.01.004','1.1.04','1104']);
    const proveedores = cuentaPorCodigos(['2.1.01.002','2.1.02','2101']);
    const socioFrancisco = cuentaPorCodigos(['2.1.01.011','2.1.13','2108']);
    const socioOsmar = cuentaPorCodigos(['2.1.01.012','2.1.14','2109']);
    const ingresoAdministracion = cuentaPorCodigos(['4.1.01.001','4.1.01','4101']);

    const linea = (cuenta_id, debe = '', haber = '', detalle = '') => ({
      key: crypto.randomUUID(),
      cuenta_id,
      debe: debe === '' ? '' : String(debe),
      haber: haber === '' ? '' : String(haber),
      glosa: detalle,
      centro_costo_id: ''
    });

    if (tipo === 'aporte_francisco' && banco && socioFrancisco) {
      setGlosa('Aporte transferencia socio Francisco');
      setLineas([linea(banco, total, ''), linea(socioFrancisco, '', total)]);
      return;
    }

    if (tipo === 'aporte_osmar' && banco && socioOsmar) {
      setGlosa('Aporte transferencia socio Osmar');
      setLineas([linea(banco, total, ''), linea(socioOsmar, '', total)]);
      return;
    }

    if (tipo === 'pago_proveedor' && proveedores && banco) {
      setGlosa('Pago a proveedor');
      setLineas([linea(proveedores, total, ''), linea(banco, '', total)]);
      return;
    }

    if (tipo === 'cobro_administracion' && banco && ingresoAdministracion) {
      setGlosa('Cobro servicio de administración');
      setLineas([linea(banco, total, ''), linea(ingresoAdministracion, '', total)]);
      return;
    }

    if (tipo === 'gasto_banco' && banco) {
      setGlosa('Gasto pagado desde banco');
      setLineas([linea('', total, '', 'Selecciona la cuenta de gasto'), linea(banco, '', total)]);
      return;
    }

    if (tipo === 'compra_iva' && ivaCredito && proveedores) {
      const neto = Math.round((total / 1.19) * 100) / 100;
      const iva = Math.round((total - neto) * 100) / 100;
      setGlosa('Compra afecta a IVA');
      setLineas([
        linea('', neto, '', 'Selecciona gasto o activo'),
        linea(ivaCredito, iva, '', 'IVA crédito fiscal'),
        linea(proveedores, '', total)
      ]);
    }
  }

  const totalDebe = lineas.reduce((a, x) => a + monto(x.debe), 0);
  const totalHaber = lineas.reduce((a, x) => a + monto(x.haber), 0);
  const diferencia = totalDebe - totalHaber;
  const completas = lineas.filter(x => x.cuenta_id && (monto(x.debe) > 0 || monto(x.haber) > 0));
  const centrosCompletos = completas.every(x => {
    if (!usaCentrosCosto) return true;
    const cuenta = cuentas.find(c => c.id === x.cuenta_id);
    return !(cuenta?.requiere_centro_costo && ['4','5'].includes(String(cuenta.codigo || '')[0]))
      || Boolean(x.centro_costo_id);
  });
  const valido = fecha && completas.length >= 2 && totalDebe > 0 && Math.abs(diferencia) < 0.005 && centrosCompletos;

  function cambiarLinea(key, campo, valor) {
    setLineas(xs => xs.map(x => {
      if (x.key !== key) return x;
      if (campo === 'debe' && valor !== '') return { ...x, debe: valor, haber: '' };
      if (campo === 'haber' && valor !== '') return { ...x, haber: valor, debe: '' };
      return { ...x, [campo]: valor };
    }));
  }

  function agregarLinea() {
    setLineas(xs => [...xs, lineaVacia()]);
  }

  function quitarLinea(key) {
    setLineas(xs => xs.length <= 2 ? xs : xs.filter(x => x.key !== key));
  }

  function igualarLinea(key) {
    if (Math.abs(diferencia) < 0.005) return;
    setLineas(xs => xs.map(x => {
      if (x.key !== key) return x;
      if (diferencia > 0) return { ...x, debe: '', haber: Math.abs(diferencia).toFixed(2) };
      return { ...x, haber: '', debe: Math.abs(diferencia).toFixed(2) };
    }));
  }

  function enviar(e) {
    e.preventDefault();
    if (!valido || guardando) return;
    onGuardar({
      numero: numeroAsiento ? Number(numeroAsiento) : null,
      fecha,
      glosa: glosa.trim(),
      referencia: referencia.trim(),
      proveedor_id: proveedorId || null,
      lineas: completas.map(x => ({
        cuenta_id: x.cuenta_id,
        debe: monto(x.debe),
        haber: monto(x.haber),
        glosa: x.glosa.trim(),
        centro_costo_id: x.centro_costo_id || null
      }))
    });
  }

  return (
    <div className="modal-fondo contabilidad-editor-fondo" role="presentation" onClick={onCancelar}>
      <form
        className="modal contabilidad-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-asiento-titulo"
        onSubmit={enviar}
        onClick={e => e.stopPropagation()}
      >
        <div className="contabilidad-editor-cabecera">
          <div>
            <p className="micro apagado" style={{ margin: 0 }}>Puedes dejar el número vacío para asignarlo automáticamente.</p>
            <h2 id="nuevo-asiento-titulo" className="h2">Nuevo asiento contable</h2>
          </div>
          <button type="button" className="boton boton-texto" onClick={onCancelar}>Cerrar</button>
        </div>

        <div className="contabilidad-asiento-datos">
          <label className="campo">
            <span className="etiqueta-campo">N° asiento</span>
            <input type="number" min="1" step="1" inputMode="numeric"
                   value={numeroAsiento} onChange={e => setNumeroAsiento(e.target.value)}
                   placeholder="Automático" />
          </label>
          <label className="campo">
            <span className="etiqueta-campo">Fecha *</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
          <label className="campo contabilidad-glosa">
            <span className="etiqueta-campo">Glosa</span>
            <input value={glosa} onChange={e => setGlosa(e.target.value)}
                   placeholder="Describe la operación" />
          </label>
          <label className="campo">
            <span className="etiqueta-campo">Referencia</span>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
                   placeholder="Factura, transferencia, F29…" />
          </label>
          <label className="campo">
            <span className="etiqueta-campo">Proveedor</span>
            <select value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
              <option value="">Sin proveedor asociado</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.empresa}</option>)}
            </select>
          </label>
        </div>

        <div className="contabilidad-operaciones">
          <div className="contabilidad-operaciones-cabecera">
            <div>
              <h3 className="h3">Operación guiada</h3>
              <p className="micro apagado" style={{ margin: '3px 0 0' }}>
                Ingresa el monto total y elige una operación. El asiento queda prearmado para revisión antes de contabilizar.
              </p>
            </div>
            <label className="campo contabilidad-operacion-monto">
              <span className="etiqueta-campo">Monto total</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={montoOperacion}
                onChange={e => setMontoOperacion(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <div className="contabilidad-operaciones-botones">
            <button type="button" className="boton boton-secundario" disabled={monto(montoOperacion) <= 0}
                    onClick={() => aplicarOperacion('pago_proveedor')}>Pago a proveedor</button>
            <button type="button" className="boton boton-secundario" disabled={monto(montoOperacion) <= 0}
                    onClick={() => aplicarOperacion('compra_iva')}>Compra con IVA</button>
            <button type="button" className="boton boton-secundario" disabled={monto(montoOperacion) <= 0}
                    onClick={() => aplicarOperacion('gasto_banco')}>Gasto desde banco</button>
            <button type="button" className="boton boton-secundario" disabled={monto(montoOperacion) <= 0}
                    onClick={() => aplicarOperacion('cobro_administracion')}>Cobro administración</button>
            <button type="button" className="boton boton-secundario" disabled={monto(montoOperacion) <= 0}
                    onClick={() => aplicarOperacion('aporte_francisco')}>Aporte Francisco</button>
            <button type="button" className="boton boton-secundario" disabled={monto(montoOperacion) <= 0}
                    onClick={() => aplicarOperacion('aporte_osmar')}>Aporte Osmar</button>
          </div>
          <p className="micro apagado contabilidad-operaciones-nota">
            Compra con IVA calcula neto e IVA al 19% desde el total; debes seleccionar la cuenta de gasto o activo antes de contabilizar.
          </p>
        </div>

        <div className="contabilidad-lineas-titulo">
          <div>
            <h3 className="h3">Líneas del asiento</h3>
            <p className="micro apagado" style={{ margin: '3px 0 0' }}>
              Cada línea lleva importe solo en Debe o solo en Haber. El detalle es opcional; si la cuenta lo exige, selecciona un centro de costo.
            </p>
          </div>
          <button type="button" className="boton boton-secundario" onClick={agregarLinea}>+ Línea</button>
        </div>

        <div className="contabilidad-lineas">
          {lineas.map((linea, i) => (
            <div className="contabilidad-linea" key={linea.key}>
              <div className="contabilidad-linea-num">{i + 1}</div>
              <label className="campo">
                <span className="etiqueta-campo">Cuenta *</span>
                <select value={linea.cuenta_id} onChange={e => cambiarLinea(linea.key, 'cuenta_id', e.target.value)}>
                  <option value="">Seleccionar cuenta</option>
                  {grupos.map(([tipo, xs]) => (
                    <optgroup key={tipo} label={etiquetaTipo(tipo)}>
                      {xs.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.cuenta}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span className="etiqueta-campo">Debe</span>
                <input type="number" min="0" step="0.01" inputMode="decimal"
                       value={linea.debe} onChange={e => cambiarLinea(linea.key, 'debe', e.target.value)}
                       placeholder="0" />
              </label>
              <label className="campo">
                <span className="etiqueta-campo">Haber</span>
                <input type="number" min="0" step="0.01" inputMode="decimal"
                       value={linea.haber} onChange={e => cambiarLinea(linea.key, 'haber', e.target.value)}
                       placeholder="0" />
              </label>
              {usaCentrosCosto && (() => {
                const cuentaSeleccionada = cuentas.find(c => c.id === linea.cuenta_id);
                const requiere = Boolean(cuentaSeleccionada?.requiere_centro_costo
                  && ['4','5'].includes(String(cuentaSeleccionada?.codigo || '')[0]));
                return (
                  <label className="campo contabilidad-linea-centro">
                    <span className="etiqueta-campo">Centro de costo{requiere ? ' *' : ''}</span>
                    <select value={linea.centro_costo_id || ''}
                            onChange={e => cambiarLinea(linea.key, 'centro_costo_id', e.target.value)}>
                      <option value="">General / Sin asignar</option>
                      {centros.filter(x => x.activa).map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.codigo} · {cc.nombre}</option>
                      ))}
                    </select>
                  </label>
                );
              })()}
              <label className="campo contabilidad-linea-glosa">
                <span className="etiqueta-campo">Detalle</span>
                <input value={linea.glosa} onChange={e => cambiarLinea(linea.key, 'glosa', e.target.value)}
                       placeholder="Opcional" />
              </label>
              <div className="contabilidad-linea-acciones">
                {linea.cuenta_id && !linea.debe && !linea.haber && Math.abs(diferencia) >= 0.005 && (
                  <button type="button" className="boton boton-texto" onClick={() => igualarLinea(linea.key)}>
                    Cuadrar
                  </button>
                )}
                <button type="button" className="boton boton-texto" disabled={lineas.length <= 2}
                        onClick={() => quitarLinea(linea.key)}>
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={'contabilidad-cuadre ' + (Math.abs(diferencia) < 0.005 && totalDebe > 0 ? 'ok' : 'pendiente')}>
          <div><span>Debe</span><strong>{moneda(totalDebe)}</strong></div>
          <div><span>Haber</span><strong>{moneda(totalHaber)}</strong></div>
          <div>
            <span>Diferencia</span>
            <strong>{moneda(Math.abs(diferencia))}</strong>
          </div>
          <p>{Math.abs(diferencia) < 0.005 && totalDebe > 0 ? 'Asiento cuadrado' : 'Debe y Haber deben ser iguales'}</p>
        </div>

        <div className="fila-botones">
          <button type="button" className="boton boton-secundario boton-movil" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="boton boton-movil" disabled={!valido || guardando}>
            {guardando ? 'Guardando…' : 'Contabilizar asiento'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ReporteEerr({ detalle, sinClasificar }) {
  const r = armarEstadoResultados(detalle);

  return (
    <div className="contabilidad-reporte">
      <div className="contabilidad-reporte-intro">
        <div>
          <h3 className="h3">Estado de Resultados</h3>
          <p className="micro apagado">Ingresos, costos, gastos y resultado del período seleccionado.</p>
        </div>
      </div>

      <div className="contabilidad-reporte-resumen">
        <div><span>Ingresos</span><strong>{moneda(r.totalIngresos)}</strong></div>
        <div><span>Costos</span><strong>{moneda(r.totalCostos)}</strong></div>
        <div><span>Gastos administración</span><strong>{moneda(r.totalAdministracion)}</strong></div>
        <div><span>Resultado</span><strong className={r.utilidad < 0 ? 'negativo' : ''}>{moneda(r.utilidad)}</strong></div>
      </div>

      <div className="contabilidad-eerr">
        {r.filas.map((fila, i) => (
          <div key={fila.etiqueta + i}
               className={'contabilidad-eerr-fila ' + fila.tipo}>
            <span>{fila.etiqueta}</span>
            {fila.monto !== undefined && <strong>{moneda(fila.monto)}</strong>}
          </div>
        ))}
      </div>

      {sinClasificar.length > 0 && (
        <div className="aviso aviso-alerta">
          <strong>Cuentas con movimiento sin clasificación en el EERR base</strong>
          <p className="chico" style={{ margin: '5px 0 0' }}>
            {sinClasificar.map(x => `${x.codigo} ${x.cuenta} (${moneda(x.monto)})`).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

function SeccionBalanceGeneral({ titulo, descripcion, filas, total, etiquetaTotal }) {
  return (
    <section className="contabilidad-bg-seccion">
      <div className="contabilidad-bg-seccion-titulo">
        <div>
          <h4>{titulo}</h4>
          {descripcion && <p>{descripcion}</p>}
        </div>
      </div>
      <div className="contabilidad-bg-cuentas">
        {filas.map(x => (
          <div key={x.cuenta_id || x.cuenta} className={x.calculado ? 'calculado' : ''}>
            <span>
              {x.codigo && <small>{x.codigo}</small>}
              {x.cuenta}
            </span>
            <strong className={Number(x.monto) < 0 ? 'negativo' : ''}>{moneda(x.monto)}</strong>
          </div>
        ))}
        {!filas.length && <p className="micro apagado contabilidad-bg-vacio">Sin saldos en el período.</p>}
      </div>
      <div className="contabilidad-bg-total">
        <span>{etiquetaTotal}</span>
        <strong>{moneda(total)}</strong>
      </div>
    </section>
  );
}

function ReporteBalanceGeneral({ balance, cuentas, resultado }) {
  const bg = armarBalanceGeneral(balance, cuentas, resultado);

  return (
    <div className="contabilidad-balance-general">
      <div className="contabilidad-reporte-intro">
        <div>
          <h3 className="h3">Balance General</h3>
          <p className="micro apagado">
            Activos ordenados por liquidez, pasivos por exigibilidad y patrimonio con el resultado del ejercicio.
          </p>
        </div>
        <span className={'contabilidad-cuadratura-estado ' + (bg.cuadrado ? 'ok' : 'error')}>
          {bg.cuadrado ? 'Cuadrado' : 'Descuadrado'}
        </span>
      </div>

      <div className="contabilidad-bg-columnas">
        <div className="contabilidad-bg-columna">
          <div className="contabilidad-bg-bloque-titulo">
            <span>ACTIVO</span>
            <strong>{moneda(bg.totalActivo)}</strong>
          </div>
          <SeccionBalanceGeneral
            titulo="Activo Corriente"
            descripcion="Mayor liquidez"
            filas={bg.activoCorriente}
            total={bg.totalActivoCorriente}
            etiquetaTotal="Total Activo Corriente"
          />
          <SeccionBalanceGeneral
            titulo="Activo No Corriente"
            descripcion="Bienes y derechos de largo plazo"
            filas={bg.activoNoCorriente}
            total={bg.totalActivoNoCorriente}
            etiquetaTotal="Total Activo No Corriente"
          />
          <div className="contabilidad-bg-gran-total">
            <span>TOTAL ACTIVO</span>
            <strong>{moneda(bg.totalActivo)}</strong>
          </div>
        </div>

        <div className="contabilidad-bg-columna">
          <div className="contabilidad-bg-bloque-titulo">
            <span>PASIVO + PATRIMONIO</span>
            <strong>{moneda(bg.totalPasivoPatrimonio)}</strong>
          </div>
          <SeccionBalanceGeneral
            titulo="Pasivo Corriente"
            descripcion="Obligaciones de corto plazo"
            filas={bg.pasivoCorriente}
            total={bg.totalPasivoCorriente}
            etiquetaTotal="Total Pasivo Corriente"
          />
          <SeccionBalanceGeneral
            titulo="Pasivo No Corriente"
            descripcion="Obligaciones de largo plazo"
            filas={bg.pasivoNoCorriente}
            total={bg.totalPasivoNoCorriente}
            etiquetaTotal="Total Pasivo No Corriente"
          />
          <SeccionBalanceGeneral
            titulo="Patrimonio"
            descripcion="Capital, reservas y resultado"
            filas={[...bg.patrimonio, bg.resultadoFila]}
            total={bg.totalPatrimonio}
            etiquetaTotal="Total Patrimonio"
          />
          <div className="contabilidad-bg-gran-total">
            <span>TOTAL PASIVO + PATRIMONIO</span>
            <strong>{moneda(bg.totalPasivoPatrimonio)}</strong>
          </div>
        </div>
      </div>

      {!bg.cuadrado && (
        <div className="aviso aviso-critico">
          <strong>Balance descuadrado.</strong> Diferencia: {moneda(Math.abs(bg.diferencia))}.
        </div>
      )}
    </div>
  );
}

function ReporteBalance({ balance }) {
  const t = totalesBalance(balance);
  const resultado = t.ganancia - t.perdida;
  const totalPasivo = t.pasivo + resultado;
  const totalPerdida = t.perdida + Math.min(resultado, 0);
  const totalGanancia = t.ganancia - Math.max(resultado, 0);

  return (
    <div className="contabilidad-reporte">
      <div className="contabilidad-reporte-intro">
        <div>
          <h3 className="h3">Balance Tributario</h3>
          <p className="micro apagado">Balance de comprobación y saldos con sumas, saldos, inventario y resultado.</p>
        </div>
      </div>

      <div className="contabilidad-reporte-resumen">
        <div><span>Debe</span><strong>{moneda(t.debe)}</strong></div>
        <div><span>Haber</span><strong>{moneda(t.haber)}</strong></div>
        <div><span>Activo</span><strong>{moneda(t.activo)}</strong></div>
        <div><span>Pasivo + resultado</span><strong>{moneda(totalPasivo)}</strong></div>
      </div>

      <div className="contabilidad-balance-movil contabilidad-solo-movil">
        {balance.filter(x => Number(x.debe) || Number(x.haber)).map(x => (
          <article className="tarjeta contabilidad-reporte-card" key={x.cuenta_id}>
            <div className="contabilidad-reporte-card-cabecera">
              <div>
                <span className="micro apagado">{x.codigo}</span>
                <strong>{x.cuenta}</strong>
              </div>
            </div>
            <div className="contabilidad-reporte-card-grid">
              <div><span>Debe</span><strong>{moneda(x.debe)}</strong></div>
              <div><span>Haber</span><strong>{moneda(x.haber)}</strong></div>
              {Number(x.deudor) !== 0 && <div><span>Saldo deudor</span><strong>{moneda(x.deudor)}</strong></div>}
              {Number(x.acreedor) !== 0 && <div><span>Saldo acreedor</span><strong>{moneda(x.acreedor)}</strong></div>}
              {Number(x.activo) !== 0 && <div><span>Activo</span><strong>{moneda(x.activo)}</strong></div>}
              {Number(x.pasivo) !== 0 && <div><span>Pasivo</span><strong>{moneda(x.pasivo)}</strong></div>}
              {Number(x.perdida) !== 0 && <div><span>Pérdida</span><strong>{moneda(x.perdida)}</strong></div>}
              {Number(x.ganancia) !== 0 && <div><span>Ganancia</span><strong>{moneda(x.ganancia)}</strong></div>}
            </div>
          </article>
        ))}
      </div>

      <section className="contabilidad-reporte-panel contabilidad-solo-escritorio">
        <div className="contabilidad-reporte-panel-cabecera">
          <div>
            <h4>Detalle por cuenta</h4>
            <p>Sumas, saldos, inventario y resultado de todas las cuentas.</p>
          </div>
        </div>
        <div className="tabla-responsive">
          <table className="tabla contabilidad-balance-tabla contabilidad-tabla-reporte">
            <thead>
              <tr>
                <th rowSpan="2">Código</th>
                <th rowSpan="2">Cuenta</th>
                <th colSpan="2">Sumas</th>
                <th colSpan="2">Saldos</th>
                <th colSpan="2">Inventario</th>
                <th colSpan="2">Resultado</th>
              </tr>
              <tr>
                <th>Debe</th><th>Haber</th><th>Deudor</th><th>Acreedor</th>
                <th>Activo</th><th>Pasivo</th><th>Pérdida</th><th>Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {balance.map(x => (
                <tr key={x.cuenta_id}>
                  <td>{x.codigo}</td>
                  <td>{x.cuenta}</td>
                  <td className="numero">{moneda(x.debe)}</td>
                  <td className="numero">{moneda(x.haber)}</td>
                  <td className="numero">{Number(x.deudor) ? moneda(x.deudor) : ''}</td>
                  <td className="numero">{Number(x.acreedor) ? moneda(x.acreedor) : ''}</td>
                  <td className="numero">{Number(x.activo) ? moneda(x.activo) : ''}</td>
                  <td className="numero">{Number(x.pasivo) ? moneda(x.pasivo) : ''}</td>
                  <td className="numero">{Number(x.perdida) ? moneda(x.perdida) : ''}</td>
                  <td className="numero">{Number(x.ganancia) ? moneda(x.ganancia) : ''}</td>
                </tr>
              ))}
              <tr className="contabilidad-total">
                <td />
                <td>SUBTOTAL</td>
                <td className="numero">{moneda(t.debe)}</td>
                <td className="numero">{moneda(t.haber)}</td>
                <td className="numero">{moneda(t.deudor)}</td>
                <td className="numero">{moneda(t.acreedor)}</td>
                <td className="numero">{moneda(t.activo)}</td>
                <td className="numero">{moneda(t.pasivo)}</td>
                <td className="numero">{moneda(t.perdida)}</td>
                <td className="numero">{moneda(t.ganancia)}</td>
              </tr>
              <tr className="contabilidad-resultado">
                <td />
                <td>RESULTADO DEL EJERCICIO</td>
                <td colSpan="5" />
                <td className="numero">{resultado < 0 ? moneda(resultado) : ''}</td>
                <td className="numero">{resultado < 0 ? moneda(resultado) : ''}</td>
                <td className="numero">{resultado > 0 ? moneda(resultado) : ''}</td>
              </tr>
              <tr className="contabilidad-total">
                <td />
                <td>TOTAL</td>
                <td className="numero">{moneda(t.debe)}</td>
                <td className="numero">{moneda(t.haber)}</td>
                <td className="numero">{moneda(t.deudor)}</td>
                <td className="numero">{moneda(t.acreedor)}</td>
                <td className="numero">{moneda(t.activo + Math.max(resultado, 0))}</td>
                <td className="numero">{moneda(totalPasivo)}</td>
                <td className="numero">{moneda(totalPerdida)}</td>
                <td className="numero">{moneda(totalGanancia)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ListaMovimientosMovil({ filas }) {
  return (
    <div className="contabilidad-movimientos-movil contabilidad-solo-movil">
      {filas.map((x, i) => (
        <article className="tarjeta contabilidad-reporte-card" key={(x.asiento_id || '') + '-' + (x.cuenta_id || '') + '-' + i}>
          <div className="contabilidad-reporte-card-cabecera">
            <div>
              <span className="micro apagado">Asiento N° {x.numero} · {fechaCL(x.fecha)}</span>
              <strong>{[x.codigo, x.cuenta].filter(Boolean).join(' · ')}</strong>
            </div>
          </div>
          <div className="contabilidad-reporte-card-grid">
            {Number(x.debe) !== 0 && <div><span>Debe</span><strong>{moneda(x.debe)}</strong></div>}
            {Number(x.haber) !== 0 && <div><span>Haber</span><strong>{moneda(x.haber)}</strong></div>}
            {x.centro_costo && <div><span>Centro de costo</span><strong>{x.centro_costo}</strong></div>}
          </div>
          {(x.glosa_linea || x.glosa) && <p className="micro contabilidad-reporte-card-glosa">{x.glosa_linea || x.glosa}</p>}
        </article>
      ))}
      {!filas.length && <p className="vacio">No hay movimientos para el período seleccionado.</p>}
    </div>
  );
}
export default function Contabilidad() {
  const { perfil, cargando: cargandoSesion } = useSesion();
  const navegar = useNavigate();
  const location = useLocation();
  const vista = vistaDesdeRuta(location.pathname);
  const puedeGestionar = ['superadmin', 'admin'].includes(perfil?.rol);

  const [entidades, setEntidades] = useState([]);
  const [entidadId, setEntidadId] = useState('');
  const [cuentas, setCuentas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [asientos, setAsientos] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [balance, setBalance] = useState([]);
  const [diario, setDiario] = useState([]);
  const [eerrDetalle, setEerrDetalle] = useState([]);
  const [sinClasificar, setSinClasificar] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [reporte, setReporte] = useState('eerr');
  const [mayorCuentaId, setMayorCuentaId] = useState('');
  const [centroReporteId, setCentroReporteId] = useState('');
  const [busquedaAsiento, setBusquedaAsiento] = useState('');
  const [busquedaCuenta, setBusquedaCuenta] = useState('');

  const [editorAbierto, setEditorAbierto] = useState(false);
  const [asientoPorAnular, setAsientoPorAnular] = useState(null);
  const [cuentaEditando, setCuentaEditando] = useState(null);
  const [cuentaDesactivar, setCuentaDesactivar] = useState(null);
  const [cuentaEliminar, setCuentaEliminar] = useState(null);
  const [nuevaEntidad, setNuevaEntidad] = useState(false);
  const [entidadEditando, setEntidadEditando] = useState(null);
  const [entidadEliminar, setEntidadEliminar] = useState(null);
  const [exportando, setExportando] = useState(false);

  const entidad = entidades.find(x => x.id === entidadId) ?? null;

  useVolverGlobal(() => {
    if (vista !== 'resumen') {
      navegar('/contabilidad');
      return;
    }
    limpiarArea();
    navegar('/', { replace: true });
  });

  useEffect(() => {
    if (!puedeGestionar) return;
    let vigente = true;

    Promise.all([
      supabase.from('contabilidad_entidades').select('*').eq('activa', true).order('nombre'),
      supabase.from('proveedores').select('id,empresa').eq('lista_negra', false).order('empresa')
    ]).then(([re, rp]) => {
      if (!vigente) return;
      if (re.error) {
        setError(re.error.message);
        setCargando(false);
        return;
      }
      setEntidades(re.data ?? []);
      if (!rp.error) setProveedores(rp.data ?? []);

      const guardada = localStorage.getItem('coproactiva:contabilidad-entidad');
      const existe = (re.data ?? []).some(x => x.id === guardada);
      const preferida = (re.data ?? []).find(x => x.tipo === 'empresa') ?? re.data?.[0];
      setEntidadId(existe ? guardada : (preferida?.id ?? ''));
      setCargando(false);
    });

    return () => { vigente = false; };
  }, [puedeGestionar]);

  useEffect(() => {
    if (!entidadId) {
      setCuentas([]);
      setAsientos([]);
      return;
    }
    localStorage.setItem('coproactiva:contabilidad-entidad', entidadId);
    setCentroReporteId('');
    cargarEntidad(entidadId);
    cargarReportes(entidadId, desde, hasta, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadId]);

  useEffect(() => {
    if (vista === 'asientos' && new URLSearchParams(location.search).get('nuevo') === '1') {
      setEditorAbierto(true);
    }
  }, [vista, location.search]);

  useEffect(() => {
    const disponibles = cuentas.filter(x => x.activa && x.clase === 'movimiento' && x.imputable !== false);
    const preferida = ['1.1.01.002','1.1.02','1102']
      .map(codigo => disponibles.find(x => x.codigo === codigo))
      .find(Boolean);
    if (!mayorCuentaId && disponibles.length) {
      setMayorCuentaId(preferida?.id ?? disponibles[0].id);
    } else if (mayorCuentaId && !disponibles.some(x => x.id === mayorCuentaId)) {
      setMayorCuentaId(preferida?.id ?? disponibles[0]?.id ?? '');
    }
  }, [cuentas, mayorCuentaId]);

  async function cargarEntidad(id) {
    setError(null);
    const [rc, ra, rcc] = await Promise.all([
      supabase.from('contabilidad_cuentas')
        .select('*').eq('entidad_id', id).order('codigo'),
      supabase.from('contabilidad_asientos')
        .select('id,numero,fecha,glosa,estado,origen,referencia,proveedor_id,creado_en,motivo_anulacion,contabilidad_asiento_lineas(id,orden,debe,haber,glosa,cuenta_id,centro_costo_id,contabilidad_cuentas(codigo,cuenta),contabilidad_centros_costo(codigo,nombre))')
        .eq('entidad_id', id)
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .limit(250),
      supabase.from('contabilidad_centros_costo')
        .select('*').eq('entidad_id', id).order('codigo')
    ]);

    if (rc.error) setError(rc.error.message);
    else setCuentas(rc.data ?? []);

    if (rcc.error) setError(rcc.error.message);
    else setCentrosCosto(rcc.data ?? []);

    if (ra.error) setError(ra.error.message);
    else {
      const lista = (ra.data ?? []).map(a => ({
        ...a,
        contabilidad_asiento_lineas: [...(a.contabilidad_asiento_lineas ?? [])]
          .sort((x, y) => Number(x.orden || 0) - Number(y.orden || 0))
      }));
      setAsientos(lista);
    }
  }

  async function cargarReportes(id = entidadId, d = desde, h = hasta, centro = centroReporteId) {
    if (!id) return;
    setCargandoReportes(true);
    setError(null);
    const args = {
      p_entidad_id: id,
      p_desde: d || null,
      p_hasta: h || null,
      p_centro_costo_id: centro || null
    };
    const [rd, rb, re, rs] = await Promise.all([
      supabase.rpc('contabilidad_libro_diario_v2', args),
      supabase.rpc('contabilidad_balance_v2', args),
      supabase.rpc('contabilidad_eerr_detalle_v2', args),
      supabase.rpc('contabilidad_eerr_sin_clasificar_v2', args)
    ]);

    const fallo = [rd, rb, re, rs].find(x => x.error);
    if (fallo) setError(fallo.error.message);
    else {
      setDiario(rd.data ?? []);
      setBalance(rb.data ?? []);
      setEerrDetalle(re.data ?? []);
      setSinClasificar(rs.data ?? []);
    }
    setCargandoReportes(false);
  }

  function cerrarEditor() {
    setEditorAbierto(false);
    if (new URLSearchParams(location.search).get('nuevo') === '1') {
      navegar('/contabilidad/asientos', { replace: true });
    }
  }

  async function guardarAsiento(datos) {
    setGuardando(true);
    setError(null);
    const { data, error } = await supabase.rpc('contabilidad_registrar_asiento', {
      p_entidad_id: entidadId,
      p_fecha: datos.fecha,
      p_glosa: datos.glosa || null,
      p_lineas: datos.lineas,
      p_origen: 'manual',
      p_referencia: datos.referencia || null,
      p_proveedor_id: datos.proveedor_id,
      p_origen_id: null,
      p_numero: datos.numero
    });
    setGuardando(false);

    if (error) return setError(error.message);

    cerrarEditor();
    setAviso(`Asiento N° ${data?.numero ?? ''} contabilizado correctamente.`);
    await Promise.all([cargarEntidad(entidadId), cargarReportes(entidadId, desde, hasta)]);
  }

  async function anularAsiento({ motivo }) {
    const asiento = asientoPorAnular;
    if (!asiento) return;
    setAsientoPorAnular(null);
    setGuardando(true);
    setError(null);
    const { error } = await supabase.rpc('contabilidad_anular_asiento', {
      p_asiento_id: asiento.id,
      p_motivo: motivo?.trim() || null
    });
    setGuardando(false);
    if (error) return setError(error.message);
    setAviso(`Asiento N° ${asiento.numero} anulado.`);
    await Promise.all([cargarEntidad(entidadId), cargarReportes(entidadId, desde, hasta)]);
  }

  async function guardarCuenta(valores) {
    const editando = cuentaEditando?.id ? cuentaEditando : null;
    const tieneMovimientos = asientos.length > 0;
    const requiereCentro = valores.requiere_centro_costo === 'si';

    setGuardando(true);
    setError(null);

    let query;
    if (editando && tieneMovimientos) {
      query = supabase.from('contabilidad_cuentas')
        .update({
          cuenta: valores.cuenta.trim(),
          requiere_centro_costo: requiereCentro,
          editado_en: new Date().toISOString()
        })
        .eq('id', editando.id);
    } else {
      const parent = cuentas.find(x => x.id === (valores.parent_id || ''));
      const codigo = valores.codigo.trim();
      const tipoFormulario = parent ? parent.tipo_contable : valores.tipo_contable;
      const tipo = tipoFormulario === 'activo_contra' ? 'activo' : tipoFormulario;
      const naturaleza = parent?.naturaleza || (tipoFormulario === 'activo_contra'
        ? 'acreedora'
        : naturalezaDesdeTipo(tipo, codigo));
      const payload = {
        entidad_id: entidadId,
        parent_id: parent?.id || null,
        codigo,
        cuenta: valores.cuenta.trim(),
        clase: 'movimiento',
        tipo_contable: parent?.tipo_contable || tipo,
        grupo: parent?.grupo || valores.grupo?.trim() || 'Sin grupo',
        naturaleza,
        clasificacion_balance: parent?.clasificacion_balance || clasificacionDesdeCodigo(codigo),
        eerr_seccion: parent?.eerr_seccion || valores.eerr_seccion || null,
        eerr_orden: parent?.eerr_orden || (valores.eerr_seccion ? Number(valores.eerr_orden || 999) : null),
        nivel: parent ? Number(parent.nivel || 1) + 1 : Math.min(5, Math.max(1, codigo.split('.').length)),
        imputable: true,
        requiere_centro_costo: requiereCentro,
        activa: editando ? editando.activa : true,
        editado_en: new Date().toISOString()
      };
      query = editando
        ? supabase.from('contabilidad_cuentas').update(payload).eq('id', editando.id)
        : supabase.from('contabilidad_cuentas').insert(payload);
    }

    const { error } = await query;
    setGuardando(false);
    if (error) return setError(error.message);

    setCuentaEditando(null);
    setAviso(editando ? 'Cuenta actualizada.' : 'Cuenta creada.');
    await cargarEntidad(entidadId);
    await cargarReportes(entidadId, desde, hasta, centroReporteId);
  }

  async function desactivarCuenta() {
    const c = cuentaDesactivar;
    setCuentaDesactivar(null);
    if (!c) return;
    setGuardando(true);
    const { error } = await supabase.from('contabilidad_cuentas')
      .update({ activa: false, editado_en: new Date().toISOString() })
      .eq('id', c.id);
    setGuardando(false);
    if (error) return setError(error.message);
    setAviso('Cuenta desactivada. Los movimientos históricos se conservan.');
    await cargarEntidad(entidadId);
  }

  async function activarCuenta(cuenta) {
    setGuardando(true);
    setError(null);
    const { error } = await supabase.from('contabilidad_cuentas')
      .update({ activa: true, editado_en: new Date().toISOString() })
      .eq('id', cuenta.id);
    setGuardando(false);
    if (error) return setError(error.message);
    setAviso('Cuenta activada.');
    await cargarEntidad(entidadId);
  }

  async function eliminarCuenta() {
    const cuenta = cuentaEliminar;
    setCuentaEliminar(null);
    if (!cuenta) return;
    setGuardando(true);
    setError(null);
    const { error } = await supabase.rpc('contabilidad_eliminar_cuenta', { p_cuenta: cuenta.id });
    setGuardando(false);
    if (error) return setError(error.message);
    setAviso('Cuenta eliminada.');
    await cargarEntidad(entidadId);
  }

  async function recargarEntidades(preferidaId = null) {
    const { data: lista, error } = await supabase.from('contabilidad_entidades')
      .select('*').eq('activa', true).order('nombre');
    if (error) {
      setError(error.message);
      return [];
    }
    const xs = lista ?? [];
    setEntidades(xs);
    const siguiente = preferidaId && xs.some(x => x.id === preferidaId)
      ? preferidaId
      : (xs.find(x => x.tipo === 'empresa')?.id ?? xs[0]?.id ?? '');
    setEntidadId(siguiente);
    return xs;
  }

  async function crearEntidad({ nombre, rut, tipo }) {
    setNuevaEntidad(false);
    setGuardando(true);
    setError(null);
    const { data, error } = await supabase.from('contabilidad_entidades')
      .insert({
        nombre: nombre.trim(),
        rut: rut.trim() || null,
        tipo,
        moneda: 'CLP',
        creado_por: perfil.id
      })
      .select().single();
    setGuardando(false);
    if (error) return setError(error.message);

    await recargarEntidades(data.id);
    setAviso('Entidad creada. Ahora configura su plan de cuentas.');
    navegar('/contabilidad/configuracion');
  }

  async function guardarEntidad({ nombre, rut }) {
    const objetivo = entidadEditando;
    if (!objetivo) return;
    setEntidadEditando(null);
    setGuardando(true);
    setError(null);

    const { data, error } = await supabase.rpc('contabilidad_editar_entidad', {
      p_entidad_id: objetivo.id,
      p_nombre: nombre.trim(),
      p_rut: rut.trim() || null
    });

    setGuardando(false);
    if (error) return setError(error.message);

    await recargarEntidades(objetivo.id);
    setAviso(objetivo.comunidad_id
      ? 'Datos actualizados. El cambio también quedó reflejado en Comunidades.'
      : 'Entidad contable actualizada.');
  }

  async function eliminarEntidadContable() {
    const objetivo = entidadEliminar;
    if (!objetivo) return;
    setEntidadEliminar(null);
    setGuardando(true);
    setError(null);

    const { data, error } = await supabase.rpc('contabilidad_eliminar_entidad', {
      p_entidad_id: objetivo.id
    });

    setGuardando(false);
    if (error) return setError(error.message);

    const preferida = objetivo.id === entidadId ? null : entidadId;
    await recargarEntidades(preferida);
    setAviso(data?.mensaje || 'Entidad retirada.');
  }

  async function exportar(tipo) {
    if (!entidad) return;
    setExportando(true);
    setError(null);
    try {
      const centroCostoNombre = centroReporteId
        ? (centrosCosto.find(x => x.id === centroReporteId)?.nombre || '')
        : '';
      if (tipo === 'pdf') {
        descargarPDF({ entidad, desde, hasta, balance, cuentas, eerrDetalle, diario, sinClasificar, centroCostoNombre });
      } else {
        await descargarPPT({ entidad, desde, hasta, balance, cuentas, eerrDetalle, diario, sinClasificar, centroCostoNombre });
      }
    } catch (e) {
      setError(e?.message || 'No se pudo generar el archivo.');
    } finally {
      setExportando(false);
    }
  }

  if (cargandoSesion) return <div className="pantalla"><p className="cargando">Cargando…</p></div>;
  if (!puedeGestionar) return <Navigate to="/inicio" replace />;

  const tieneMovimientosEntidad = asientos.length > 0;
  const diarioAgrupado = useMemo(() => agruparAsientosDiario(diario), [diario]);
  const eerr = armarEstadoResultados(eerrDetalle);
  const tb = totalesBalance(balance);
  const pasivoPatrimonio = tb.pasivo + eerr.utilidad;
  const diferenciaBalance = tb.activo - pasivoPatrimonio;
  const balanceCuadrado = Math.abs(diferenciaBalance) < 0.005;
  const asientosVisibles = asientos.filter(a => {
    const q = normalizar(busquedaAsiento);
    if (!q) return true;
    const bolsa = [
      a.numero, a.fecha, a.glosa, a.referencia,
      ...(a.contabilidad_asiento_lineas ?? []).map(l => l.contabilidad_cuentas?.cuenta)
    ].join(' ');
    return normalizar(bolsa).includes(q);
  });

  const cuentasVisibles = cuentas.filter(c => {
    const q = normalizar(busquedaCuenta);
    return !q || normalizar([c.codigo, c.cuenta, c.tipo_contable, c.grupo].join(' ')).includes(q);
  });

  const mayor = diario.filter(x => x.cuenta_id === mayorCuentaId);
  const cuentaMayor = cuentas.find(x => x.id === mayorCuentaId);
  const mayorDebe = mayor.reduce((a, x) => a + Number(x.debe || 0), 0);
  const mayorHaber = mayor.reduce((a, x) => a + Number(x.haber || 0), 0);
  const mayorSaldo = mayorDebe - mayorHaber;

  return (
    <div className="pantalla contabilidad-pantalla">
      {editorAbierto && entidad?.plan_origen !== 'pendiente' && (
        <EditorAsiento
          cuentas={cuentas.filter(x => x.activa && x.clase === 'movimiento' && x.imputable !== false)}
          proveedores={proveedores}
          centros={centrosCosto}
          usaCentrosCosto={Boolean(entidad?.usa_centros_costo)}
          guardando={guardando}
          onGuardar={guardarAsiento}
          onCancelar={cerrarEditor}
        />
      )}

      {asientoPorAnular && (
        <DialogoCampos
          titulo={`Anular asiento N° ${asientoPorAnular.numero}`}
          mensaje="El asiento quedará marcado como anulado. No se elimina y se conserva la trazabilidad."
          campos={[{
            id: 'motivo',
            label: 'Motivo de la anulación',
            multiline: true,
            filas: 3,
            placeholder: 'Opcional'
          }]}
          textoConfirmar="Anular asiento"
          textoCancelar="Cancelar"
          onConfirmar={anularAsiento}
          onCancelar={() => setAsientoPorAnular(null)}
        />
      )}

      {cuentaEditando && (
        <DialogoCampos
          titulo={cuentaEditando.id ? 'Editar cuenta' : 'Nueva cuenta'}
          mensaje={tieneMovimientosEntidad
            ? 'El historial está protegido. Solo puedes cambiar el nombre y si la cuenta exige centro de costo.'
            : 'Puedes organizar el plan por niveles. Las cuentas con subcuentas pasan a ser agrupadoras y dejan de aceptar movimientos.'}
          campos={cuentaEditando.id && tieneMovimientosEntidad
            ? [
                { id: 'cuenta', label: 'Cuenta', valor: cuentaEditando.cuenta ?? '', obligatorio: true },
                {
                  id: 'requiere_centro_costo',
                  label: 'Centro de costo',
                  valor: cuentaEditando.requiere_centro_costo ? 'si' : 'no',
                  opciones: [['no','No requerido'],['si','Requerido para nuevos movimientos']]
                }
              ]
            : [
                {
                  id: 'parent_id',
                  label: 'Cuenta agrupadora',
                  valor: cuentaEditando.parent_id ?? '',
                  obligatorio: tieneMovimientosEntidad,
                  opciones: [
                    ['', tieneMovimientosEntidad ? 'Selecciona una cuenta agrupadora' : 'Sin cuenta agrupadora'],
                    ...cuentas
                      .filter(x => x.id !== cuentaEditando.id && x.activa && Number(x.nivel || 1) < 5)
                      .map(x => [x.id, x.codigo + ' · ' + x.cuenta])
                  ],
                  ayuda: 'Si eliges una agrupadora, el código debe depender de ella y se crea en el nivel siguiente.'
                },
                { id: 'codigo', label: 'Código', valor: cuentaEditando.codigo ?? '', obligatorio: true, ayuda: 'Los modelos base usan X.X.XX.XXX y permiten un quinto nivel .XXX.' },
                { id: 'cuenta', label: 'Cuenta', valor: cuentaEditando.cuenta ?? '', obligatorio: true },
                {
                  id: 'tipo_contable', label: 'Tipo', valor: tipoCuentaFormulario(cuentaEditando),
                  obligatorio: true, opciones: TIPOS_CUENTA_FORM
                },
                { id: 'grupo', label: 'Grupo', valor: cuentaEditando.grupo ?? '', obligatorio: true },
                {
                  id: 'eerr_seccion', label: 'Estado de Resultados', valor: cuentaEditando.eerr_seccion ?? '',
                  opciones: EERR_SECCIONES
                },
                {
                  id: 'eerr_orden', label: 'Orden dentro del EERR', tipo: 'number',
                  valor: cuentaEditando.eerr_orden ?? ''
                },
                {
                  id: 'requiere_centro_costo',
                  label: 'Centro de costo',
                  valor: cuentaEditando.requiere_centro_costo ? 'si' : 'no',
                  opciones: [['no','No requerido'],['si','Requerido si la entidad usa centros de costo']]
                }
              ]}
          textoConfirmar={cuentaEditando.id ? 'Guardar cambios' : 'Crear cuenta'}
          onConfirmar={guardarCuenta}
          onCancelar={() => setCuentaEditando(null)}
        />
      )}

      {cuentaDesactivar && (
        <Confirmar
          titulo="Desactivar cuenta"
          mensaje={`“${cuentaDesactivar.codigo} · ${cuentaDesactivar.cuenta}” dejará de estar disponible para nuevos asientos. Los movimientos históricos se conservan.`}
          textoConfirmar="Desactivar"
          textoCancelar="Cancelar"
          onConfirmar={desactivarCuenta}
          onCancelar={() => setCuentaDesactivar(null)}
        />
      )}

      {cuentaEliminar && (
        <Confirmar
          titulo="Eliminar cuenta"
          mensaje={`“${cuentaEliminar.codigo} · ${cuentaEliminar.cuenta}” se eliminará del plan. Esta acción solo está disponible antes del primer movimiento contable.`}
          textoConfirmar="Eliminar"
          textoCancelar="Cancelar"
          onConfirmar={eliminarCuenta}
          onCancelar={() => setCuentaEliminar(null)}
        />
      )}

      {entidadEditando && (
        <DialogoCampos
          titulo={entidadEditando.comunidad_id ? 'Editar comunidad' : 'Editar entidad'}
          mensaje={entidadEditando.comunidad_id
            ? 'Nombre y RUT pertenecen a la ficha de Comunidad. El cambio se reflejará automáticamente en ambos módulos.'
            : 'Actualiza los datos principales de esta entidad contable.'}
          campos={[
            { id: 'nombre', label: 'Nombre', valor: entidadEditando.nombre ?? '', obligatorio: true },
            { id: 'rut', label: 'RUT', valor: entidadEditando.rut ?? '', placeholder: 'Opcional' }
          ]}
          textoConfirmar="Guardar cambios"
          textoCancelar="Cancelar"
          onConfirmar={guardarEntidad}
          onCancelar={() => setEntidadEditando(null)}
        />
      )}

      {entidadEliminar && (
        <Confirmar
          titulo="Eliminar entidad"
          mensaje={entidadEliminar.comunidad_id
            ? `“${entidadEliminar.nombre}” también existe en Comunidades. Si no tiene historial se eliminará definitivamente; si tiene registros, quedará terminada y se conservará su historial.`
            : `“${entidadEliminar.nombre}” se eliminará definitivamente si no tiene asientos. Si tiene movimientos, se retirará de uso conservando su historial.`}
          textoConfirmar="Eliminar"
          textoCancelar="Cancelar"
          onConfirmar={eliminarEntidadContable}
          onCancelar={() => setEntidadEliminar(null)}
        />
      )}

      {nuevaEntidad && (
        <DialogoCampos
          titulo="Nueva entidad contable"
          mensaje="Cada entidad mantiene su propia numeración, plan de cuentas y libros."
          campos={[
            { id: 'nombre', label: 'Nombre', obligatorio: true },
            { id: 'rut', label: 'RUT', placeholder: 'Opcional' },
            {
              id: 'tipo', label: 'Tipo', valor: 'empresa', obligatorio: true,
              opciones: [['empresa','Empresa'],['otro','Otra entidad']]
            }
          ]}
          textoConfirmar="Crear entidad"
          onConfirmar={crearEntidad}
          onCancelar={() => setNuevaEntidad(false)}
        />
      )}

      <header className="encabezado contabilidad-encabezado">
        <div className="contabilidad-cabecera-principal">
          <div>
            <h1 className="h2">Contabilidad</h1>
            <p className="chico apagado" style={{ margin: '4px 0 0' }}>
              Asientos, libros y estados financieros por entidad.
            </p>
          </div>

          <div className="contabilidad-entidad-selector">
            <label className="etiqueta-campo" htmlFor="entidad-contable">Entidad</label>
            <select id="entidad-contable" value={entidadId} onChange={e => setEntidadId(e.target.value)}>
              {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>

        <nav className="contabilidad-nav" aria-label="Contabilidad">
          {VISTAS.map(([id, texto, ruta]) => (
            <Link key={id} to={ruta} className={vista === id ? 'activo' : ''}>{texto}</Link>
          ))}
        </nav>
      </header>

      <div className="cuerpo contabilidad-cuerpo">
        {error && <div className="aviso aviso-critico">{error}</div>}
        {aviso && (
          <div className="aviso aviso-ok">
            {aviso}
            <button type="button" className="boton boton-texto" onClick={() => setAviso(null)}>Cerrar</button>
          </div>
        )}

        {cargando && <p className="cargando">Cargando Contabilidad…</p>}

        {!cargando && entidad && vista === 'resumen' && (
          <>
            <section className="contabilidad-resumen-kpis">
              <div className={'tarjeta contabilidad-kpi-principal ' + (balanceCuadrado ? 'cuadrado' : 'descuadrado')}>
                <div className="contabilidad-kpi-cabecera">
                  <p className="micro apagado">Activo</p>
                  <span className={'contabilidad-cuadratura-estado ' + (balanceCuadrado ? 'ok' : 'error')}>
                    {balanceCuadrado ? 'Cuadrado' : 'Descuadrado'}
                  </span>
                </div>
                <strong>{moneda(tb.activo)}</strong>
              </div>

              <div className={'tarjeta contabilidad-kpi-principal ' + (balanceCuadrado ? 'cuadrado' : 'descuadrado')}>
                <div className="contabilidad-kpi-cabecera">
                  <p className="micro apagado">Pasivo + patrimonio</p>
                  <span className={'contabilidad-cuadratura-estado ' + (balanceCuadrado ? 'ok' : 'error')}>
                    {balanceCuadrado ? 'Cuadrado' : 'Descuadrado'}
                  </span>
                </div>
                <strong>{moneda(pasivoPatrimonio)}</strong>
                <span className="micro apagado contabilidad-kpi-formula">
                  Incluye resultado del ejercicio: {moneda(eerr.utilidad)}
                </span>
              </div>

              <div className="tarjeta contabilidad-kpi-secundario">
                <p className="micro apagado">Resultado del ejercicio</p>
                <strong className={eerr.utilidad < 0 ? 'negativo' : ''}>{moneda(eerr.utilidad)}</strong>
              </div>

              <div className="tarjeta contabilidad-kpi-secundario">
                <p className="micro apagado">Asientos</p>
                <strong>{asientos.filter(x => x.estado === 'contabilizado').length}</strong>
              </div>
            </section>

            <section className="contabilidad-acciones-principales">
              {entidad.plan_origen === 'pendiente' ? (
                <Link className="boton boton-movil" to="/contabilidad/configuracion">
                  Configurar plan
                </Link>
              ) : (
                <button type="button" className="boton boton-movil"
                        onClick={() => navegar('/contabilidad/asientos?nuevo=1')}>
                  + Nuevo asiento
                </button>
              )}
              <Link className="boton boton-secundario boton-movil" to="/contabilidad/reportes">
                Ver reportes
              </Link>
              <button type="button" className="boton boton-secundario boton-movil"
                      disabled={exportando || cargandoReportes} onClick={() => exportar('pdf')}>
                Generar PDF
              </button>
              <button type="button" className="boton boton-secundario boton-movil"
                      disabled={exportando || cargandoReportes} onClick={() => exportar('ppt')}>
                Generar PPT
              </button>
            </section>

            <div className="contabilidad-resumen-grid">
              <section className="tarjeta">
                <div className="fila">
                  <div>
                    <h2 className="h3">Últimos asientos</h2>
                    <p className="micro apagado" style={{ margin: '3px 0 0' }}>Movimientos recientes de {entidad.nombre}.</p>
                  </div>
                  <Link to="/contabilidad/asientos" className="boton boton-texto">Ver todos</Link>
                </div>
                <div className="contabilidad-lista-compacta">
                  {asientos.slice(0, 6).map(a => (
                    <div key={a.id}>
                      <div>
                        <strong>N° {a.numero} · {fechaCL(a.fecha)}</strong>
                        <span>{a.glosa || 'Sin glosa'}</span>
                      </div>
                      <span className={'chip ' + (a.estado === 'anulado' ? 'chip-critico' : 'chip-cumple')}>
                        {a.estado === 'anulado' ? 'Anulado' : moneda((a.contabilidad_asiento_lineas ?? []).reduce((s,l) => s + Number(l.debe || 0), 0))}
                      </span>
                    </div>
                  ))}
                  {!asientos.length && <p className="micro apagado">Todavía no hay asientos.</p>}
                </div>
              </section>

              <section className="tarjeta">
                <div className="fila">
                  <div>
                    <h2 className="h3">Estado de Resultados</h2>
                    <p className="micro apagado" style={{ margin: '3px 0 0' }}>Vista acumulada de todos los movimientos.</p>
                  </div>
                  <Link to="/contabilidad/reportes" className="boton boton-texto">Abrir</Link>
                </div>
                <div className="contabilidad-mini-eerr">
                  <div><span>Ingresos operacionales</span><strong>{moneda(eerr.totalIngresos)}</strong></div>
                  <div><span>Costos de prestación</span><strong>{moneda(eerr.totalCostos)}</strong></div>
                  <div><span>Resultado operacional</span><strong>{moneda(eerr.resultadoOperacional)}</strong></div>
                  <div className="resultado"><span>Utilidad del ejercicio</span><strong>{moneda(eerr.utilidad)}</strong></div>
                </div>
                {sinClasificar.length > 0 && (
                  <div className="aviso aviso-alerta" style={{ marginTop: 12 }}>
                    {sinClasificar.length} cuenta{sinClasificar.length === 1 ? '' : 's'} con movimiento sin clasificación en EERR.
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {!cargando && entidad && vista === 'asientos' && (
          <>
            {entidad.plan_origen === 'pendiente' && (
              <div className="aviso aviso-alerta contabilidad-plan-pendiente">
                <div>
                  <strong>Configura el plan de cuentas antes de contabilizar.</strong>
                  <p className="micro" style={{ margin: '4px 0 0' }}>
                    Puedes usar una plantilla, importar un plan o crearlo desde cero.
                  </p>
                </div>
                <Link to="/contabilidad/configuracion" className="boton boton-secundario">Configurar plan</Link>
              </div>
            )}
            <div className="contabilidad-toolbar">
              <label className="campo crece">
                <span className="etiqueta-campo">Buscar asiento</span>
                <input type="search" value={busquedaAsiento}
                       placeholder="Número, fecha, glosa o cuenta"
                       onChange={e => setBusquedaAsiento(e.target.value)} />
              </label>
              {entidad.plan_origen === 'pendiente' ? (
                <Link to="/contabilidad/configuracion" className="boton boton-movil">
                  Configurar plan
                </Link>
              ) : (
                <button type="button" className="boton boton-movil" onClick={() => setEditorAbierto(true)}>
                  + Nuevo asiento
                </button>
              )}
            </div>

            <div className="contabilidad-asientos-lista">
              {asientosVisibles.map(a => {
                const debe = (a.contabilidad_asiento_lineas ?? []).reduce((s,l) => s + Number(l.debe || 0), 0);
                return (
                  <article key={a.id} className={'tarjeta contabilidad-asiento-card ' + (a.estado === 'anulado' ? 'anulado' : '')}>
                    <div className="contabilidad-asiento-cabecera">
                      <div>
                        <p className="micro apagado" style={{ margin: 0 }}>{fechaCL(a.fecha)}</p>
                        <h2 className="h3" style={{ marginTop: 3 }}>Asiento N° {a.numero}</h2>
                        <p className="chico" style={{ margin: '5px 0 0' }}>{a.glosa || 'Sin glosa'}</p>
                      </div>
                      <div className="contabilidad-asiento-total">
                        <strong>{moneda(debe)}</strong>
                        <span className={'chip ' + (a.estado === 'anulado' ? 'chip-critico' : 'chip-cumple')}>
                          {a.estado === 'anulado' ? 'Anulado' : 'Contabilizado'}
                        </span>
                      </div>
                    </div>

                    <div className="contabilidad-asiento-lineas-vista">
                      {(a.contabilidad_asiento_lineas ?? []).map(l => (
                        <div key={l.id}>
                          <span className="codigo">{l.contabilidad_cuentas?.codigo}</span>
                          <span className="cuenta">{l.contabilidad_cuentas?.cuenta}</span>
                          <span className="debe">{Number(l.debe) ? moneda(l.debe) : ''}</span>
                          <span className="haber">{Number(l.haber) ? moneda(l.haber) : ''}</span>
                        </div>
                      ))}
                    </div>

                    <div className="contabilidad-asiento-pie">
                      <span className="micro apagado">
                        {[a.referencia, a.origen === 'importacion_excel' ? 'Importado desde Excel' : null].filter(Boolean).join(' · ')}
                      </span>
                      {a.estado !== 'anulado' && (
                        <button type="button" className="boton boton-texto" onClick={() => setAsientoPorAnular(a)}>
                          Anular
                        </button>
                      )}
                      {a.estado === 'anulado' && a.motivo_anulacion && (
                        <span className="micro apagado">Motivo: {a.motivo_anulacion}</span>
                      )}
                    </div>
                  </article>
                );
              })}
              {!asientosVisibles.length && <div className="contabilidad-vacio">No hay asientos que coincidan con la búsqueda.</div>}
            </div>
          </>
        )}

        {!cargando && entidad && vista === 'plan' && (
          <>
            {entidad.plan_origen === 'pendiente' && (
              <div className="aviso aviso-alerta contabilidad-plan-pendiente">
                <div>
                  <strong>Esta entidad todavía no tiene un plan de cuentas configurado.</strong>
                  <p className="micro" style={{ margin: '4px 0 0' }}>
                    Elige una plantilla, importa un plan existente o comienza desde cero.
                  </p>
                </div>
                <Link to="/contabilidad/configuracion" className="boton boton-secundario">Configurar plan</Link>
              </div>
            )}

            <div className="contabilidad-toolbar">
              <label className="campo crece">
                <span className="etiqueta-campo">Buscar cuenta</span>
                <input type="search" value={busquedaCuenta}
                       placeholder="Código, cuenta, tipo o grupo"
                       onChange={e => setBusquedaCuenta(e.target.value)} />
              </label>
              <div className="fila" style={{ gap: 8 }}>
                <Link to="/contabilidad/configuracion" className="boton boton-secundario">Configuración</Link>
                <button type="button" className="boton boton-movil"
                        disabled={entidad.plan_origen === 'pendiente'}
                        onClick={() => setCuentaEditando({
                          parent_id: '',
                          tipo_contable: 'gasto',
                          eerr_seccion: '',
                          requiere_centro_costo: false
                        })}>
                  + Nueva cuenta
                </button>
              </div>
            </div>

            {tieneMovimientosEntidad && (
              <div className="aviso contabilidad-plan-protegido">
                <strong>Plan protegido por historial.</strong> Puedes renombrar cuentas, crear subcuentas inferiores,
                configurar la exigencia de centro de costo y desactivar cuentas sin movimientos en el ejercicio actual.
                No puedes reemplazar el plan ni eliminar cuentas.
              </div>
            )}

            <div className="tabla-responsive">
              <table className="tabla contabilidad-plan-tabla">
                <thead>
                  <tr>
                    <th>Código</th><th>Cuenta</th><th>Nivel</th><th>Tipo</th><th>Grupo</th>
                    <th>Centro costo</th><th>Estado</th><th />
                  </tr>
                </thead>
                <tbody>
                  {cuentasVisibles.map(cuenta => (
                    <tr key={cuenta.id} className={!cuenta.activa ? 'inactiva' : (cuenta.imputable === false ? 'agrupadora' : '')}>
                      <td><strong>{cuenta.codigo}</strong></td>
                      <td>
                        <span className="contabilidad-cuenta-jerarquia"
                              style={{ paddingLeft: Math.max(0, Number(cuenta.nivel || 1) - 1) * 12 }}>
                          {cuenta.cuenta}
                        </span>
                        {cuenta.imputable === false && <span className="chip contabilidad-chip-agrupadora">Agrupadora</span>}
                      </td>
                      <td>{cuenta.nivel}</td>
                      <td>{etiquetaTipo(cuenta.tipo_contable, cuenta.naturaleza)}</td>
                      <td>{cuenta.grupo || '—'}</td>
                      <td>
                        {['4','5'].includes(String(cuenta.codigo || '')[0])
                          ? (cuenta.requiere_centro_costo ? <span className="chip chip-cumple">Requerido</span> : <span className="chip">Opcional</span>)
                          : <span className="micro apagado">No aplica</span>}
                      </td>
                      <td>{cuenta.activa ? <span className="chip chip-cumple">Activa</span> : <span className="chip">Inactiva</span>}</td>
                      <td>
                        <div className="fila contabilidad-plan-acciones" style={{ gap: 5 }}>
                          <button type="button" className="boton boton-texto" onClick={() => setCuentaEditando(cuenta)}>Editar</button>
                          {cuenta.activa ? (
                            <button type="button" className="boton boton-texto"
                                    onClick={() => setCuentaDesactivar(cuenta)}>Desactivar</button>
                          ) : (
                            <button type="button" className="boton boton-texto"
                                    onClick={() => activarCuenta(cuenta)}>Activar</button>
                          )}
                          {!tieneMovimientosEntidad && (
                            <button type="button" className="boton boton-texto boton-peligro"
                                    onClick={() => setCuentaEliminar(cuenta)}>Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!cuentasVisibles.length && (
                    <tr><td colSpan="8"><p className="vacio">No hay cuentas para mostrar.</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!cargando && entidad && vista === 'configuracion' && (
          <ContabilidadConfiguracion
            entidad={entidad}
            cuentas={cuentas}
            asientos={asientos}
            centros={centrosCosto}
            onError={setError}
            onAviso={setAviso}
            onRecargar={async () => {
              await recargarEntidades(entidadId);
              await cargarEntidad(entidadId);
              await cargarReportes(entidadId, desde, hasta, centroReporteId);
            }}
          />
        )}

        {!cargando && entidad && vista === 'reportes' && (
          <>
            <section className="tarjeta contabilidad-filtros-reporte">
              <div>
                <h2 className="h3">Período</h2>
                <p className="micro apagado" style={{ margin: '3px 0 0' }}>
                  Sin fechas se consideran todos los movimientos.
                </p>
              </div>
              <label className="campo">
                <span className="etiqueta-campo">Desde</span>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
              </label>
              <label className="campo">
                <span className="etiqueta-campo">Hasta</span>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
              </label>
              {centrosCosto.length > 0 && (
                <label className="campo">
                  <span className="etiqueta-campo">Centro de costo</span>
                  <select value={centroReporteId} onChange={e => setCentroReporteId(e.target.value)}>
                    <option value="">Todos los centros</option>
                    {centrosCosto.filter(x => x.activa).map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.codigo} · {cc.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className="boton boton-secundario" disabled={cargandoReportes}
                      onClick={() => cargarReportes(entidadId, desde, hasta, centroReporteId)}>
                {cargandoReportes ? 'Calculando…' : 'Aplicar filtros'}
              </button>
              <button type="button" className="boton boton-texto"
                      onClick={() => { setDesde(''); setHasta(''); setCentroReporteId(''); cargarReportes(entidadId, '', '', ''); }}>
                Ver todo
              </button>
            </section>

            <div className="contabilidad-reportes-cabecera">
              <div className="pestanas contabilidad-reportes-tabs contabilidad-solo-escritorio">
                {[
                  ['eerr','Estado de Resultados'],
                  ['balance_general','Balance General'],
                  ['balance','Balance Tributario'],
                  ['diario','Libro Diario'],
                  ['mayor','Libro Mayor']
                ].map(([id, texto]) => (
                  <button key={id} type="button" className={reporte === id ? 'activo' : ''}
                          onClick={() => setReporte(id)}>
                    {texto}
                  </button>
                ))}
              </div>

              <label className="campo contabilidad-reporte-selector-movil contabilidad-solo-movil">
                <span className="etiqueta-campo">Reporte</span>
                <select value={reporte} onChange={e => setReporte(e.target.value)}>
                  <option value="eerr">Estado de Resultados</option>
                  <option value="balance_general">Balance General</option>
                  <option value="balance">Balance Tributario</option>
                  <option value="diario">Libro Diario</option>
                  <option value="mayor">Libro Mayor</option>
                </select>
              </label>

              <div className="contabilidad-exportaciones">
                <button type="button" className="boton boton-secundario"
                        disabled={exportando || cargandoReportes} onClick={() => exportar('pdf')}>
                  PDF
                </button>
                <button type="button" className="boton boton-secundario"
                        disabled={exportando || cargandoReportes} onClick={() => exportar('ppt')}>
                  PPT
                </button>
              </div>
            </div>

            <p className="micro apagado contabilidad-periodo-actual">
              {textoPeriodo(desde, hasta)}
              {centroReporteId && ' · Centro de costo: ' + (centrosCosto.find(x => x.id === centroReporteId)?.nombre || '')}
            </p>

            {cargandoReportes && <p className="cargando">Calculando reporte…</p>}

            {!cargandoReportes && reporte === 'eerr' && (
              <ReporteEerr detalle={eerrDetalle} sinClasificar={sinClasificar} />
            )}

            {!cargandoReportes && reporte === 'balance_general' && (
              <ReporteBalanceGeneral balance={balance} cuentas={cuentas} resultado={eerr.utilidad} />
            )}

            {!cargandoReportes && reporte === 'balance' && (
              <ReporteBalance balance={balance} />
            )}

            {!cargandoReportes && reporte === 'diario' && (
              <div className="contabilidad-reporte">
                <div className="contabilidad-reporte-intro">
                  <div>
                    <h3 className="h3">Libro Diario</h3>
                    <p className="micro apagado">Asientos contables ordenados cronológicamente, con todas sus cuentas relacionadas.</p>
                  </div>
                </div>

                <div className="contabilidad-reporte-resumen">
                  <div><span>Asientos</span><strong>{diarioAgrupado.length}</strong></div>
                  <div><span>Debe</span><strong>{moneda(diario.reduce((s, x) => s + Number(x.debe || 0), 0))}</strong></div>
                  <div><span>Haber</span><strong>{moneda(diario.reduce((s, x) => s + Number(x.haber || 0), 0))}</strong></div>
                  <div><span>Estado</span><strong>{Math.abs(diario.reduce((s, x) => s + Number(x.debe || 0) - Number(x.haber || 0), 0)) < 0.005 ? 'Cuadrado' : 'Revisar'}</strong></div>
                </div>

                <ListaAsientosDiarioMovil asientos={diarioAgrupado} />

                <section className="contabilidad-reporte-panel contabilidad-solo-escritorio">
                  <div className="contabilidad-reporte-panel-cabecera">
                    <div>
                      <h4>Detalle por asiento</h4>
                      <p>Una fila por asiento, con sus cuentas involucradas y la glosa registrada una sola vez.</p>
                    </div>
                  </div>
                  <div className="tabla-responsive">
                    <table className="tabla contabilidad-diario-tabla contabilidad-tabla-reporte contabilidad-diario-agrupado">
                      <thead>
                        <tr><th>N° Asiento</th><th>Fecha</th><th>Cuentas involucradas</th><th>Debe</th><th>Haber</th><th>Glosa</th></tr>
                      </thead>
                      <tbody>
                        {diarioAgrupado.map(a => (
                          <tr key={a.asiento_id || a.numero}>
                            <td><strong>{a.numero}</strong></td>
                            <td>{fechaCL(a.fecha)}</td>
                            <td>
                              <div className="contabilidad-diario-cuentas">
                                {a.lineas.map((l, i) => (
                                  <div key={(l.cuenta_id || '') + '-' + i}>
                                    <span>
                                      <strong>{l.codigo}</strong> · {l.cuenta}
                                      {l.centro_costo && l.centro_costo !== 'General / Sin asignar'
                                        ? ' · CC: ' + l.centro_costo
                                        : ''}
                                    </span>
                                    <span className="numero">
                                      {Number(l.debe || 0) ? 'Debe ' + moneda(l.debe) : 'Haber ' + moneda(l.haber)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="numero">{moneda(a.debe)}</td>
                            <td className="numero">{moneda(a.haber)}</td>
                            <td>{a.glosa || 'Sin glosa'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {!cargandoReportes && reporte === 'mayor' && (
              <div className="contabilidad-reporte">
                <div className="contabilidad-reporte-intro">
                  <div>
                    <h3 className="h3">Libro Mayor</h3>
                    <p className="micro apagado">Movimientos y saldo acumulado de una cuenta contable.</p>
                  </div>
                </div>

                <div className="contabilidad-reporte-controles">
                  <label className="campo contabilidad-mayor-cuenta">
                    <span className="etiqueta-campo">Cuenta</span>
                    <select value={mayorCuentaId} onChange={e => setMayorCuentaId(e.target.value)}>
                      {cuentas.filter(x => x.activa && x.clase === 'movimiento' && x.imputable !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} · {c.cuenta}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="contabilidad-reporte-resumen">
                  <div><span>Debe</span><strong>{moneda(mayorDebe)}</strong></div>
                  <div><span>Haber</span><strong>{moneda(mayorHaber)}</strong></div>
                  <div><span>Saldo</span><strong>{moneda(Math.abs(mayorSaldo))}</strong></div>
                  <div><span>Tipo</span><strong>{mayorSaldo > 0 ? 'Deudor' : mayorSaldo < 0 ? 'Acreedor' : 'Cuenta saldada'}</strong></div>
                </div>

                <ListaMovimientosMovil filas={mayor.map(x => ({ ...x, cuenta: cuentaMayor?.cuenta }))} />

                <section className="contabilidad-reporte-panel contabilidad-solo-escritorio">
                  <div className="contabilidad-reporte-panel-cabecera">
                    <div>
                      <h4>{cuentaMayor ? cuentaMayor.codigo + ' · ' + cuentaMayor.cuenta : 'Movimientos de la cuenta'}</h4>
                      <p>Detalle de cargos y abonos del período seleccionado.</p>
                    </div>
                  </div>
                  <div className="tabla-responsive">
                    <table className="tabla contabilidad-tabla-reporte">
                      <thead><tr><th>N° Asiento</th><th>Fecha</th><th>Cuenta</th><th>Debe</th><th>Haber</th><th>Glosa</th></tr></thead>
                      <tbody>
                        {mayor.map((x, i) => (
                          <tr key={x.asiento_id + '-' + i}>
                            <td>{x.numero}</td><td>{fechaCL(x.fecha)}</td><td>{cuentaMayor?.cuenta}</td>
                            <td className="numero">{Number(x.debe) ? moneda(x.debe) : ''}</td>
                            <td className="numero">{Number(x.haber) ? moneda(x.haber) : ''}</td>
                            <td>{x.glosa_linea || x.glosa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        {!cargando && vista === 'entidades' && (
          <>
            <div className="contabilidad-toolbar">
              <div className="crece">
                <h2 className="h3">Entidades contables</h2>
                <p className="micro apagado" style={{ margin: '3px 0 0' }}>
                  Las comunidades se sincronizan con su ficha principal. Empresas y otras entidades se administran aquí.
                </p>
              </div>
              <button type="button" className="boton boton-movil" onClick={() => setNuevaEntidad(true)}>
                + Nueva entidad
              </button>
            </div>

            <div className="contabilidad-entidades-grid">
              {entidades.map(e => (
                <div key={e.id}
                     className={'tarjeta contabilidad-entidad-card ' + (e.id === entidadId ? 'activa' : '')}>
                  <button type="button" className="contabilidad-entidad-contenido"
                          onClick={() => {
                            setEntidadId(e.id);
                            navegar(e.plan_origen === 'pendiente' ? '/contabilidad/configuracion' : '/contabilidad');
                          }}>
                    <span className="micro apagado">{e.tipo === 'comunidad' ? 'Comunidad' : e.tipo === 'empresa' ? 'Empresa' : 'Otra entidad'}</span>
                    <strong>{e.nombre}</strong>
                    <span>{e.rut || 'Sin RUT informado'}</span>
                    <span className="micro apagado">Moneda: {e.moneda}</span>
                    <span className={'chip ' + (e.plan_origen === 'pendiente' ? 'chip-alerta' : 'chip-cumple')}>
                      {e.plan_origen === 'pendiente'
                        ? 'Plan pendiente'
                        : e.plan_origen === 'plantilla'
                        ? 'Plan predefinido'
                        : e.plan_origen === 'personalizada'
                        ? 'Plantilla personalizada'
                        : e.plan_origen === 'manual'
                        ? 'Plan manual'
                        : 'Plan importado / histórico'}
                    </span>
                  </button>
                  <div className="contabilidad-entidad-acciones">
                    {e.plan_origen === 'pendiente' && (
                      <button type="button" className="boton boton-texto"
                              onClick={() => { setEntidadId(e.id); navegar('/contabilidad/configuracion'); }}>
                        Configurar plan
                      </button>
                    )}
                    {e.comunidad_id && (
                      <Link className="boton boton-texto" to={`/comunidades/${e.comunidad_id}`}>
                        Ver comunidad
                      </Link>
                    )}
                    <button type="button" className="boton boton-texto" onClick={() => setEntidadEditando(e)}>
                      Editar
                    </button>
                    <button type="button" className="boton boton-texto boton-peligro" onClick={() => setEntidadEliminar(e)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
