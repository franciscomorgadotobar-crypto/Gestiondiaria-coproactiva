import { useState } from 'react';
import './CopiasCorreo.css';

/** Campos locales de composición. Nunca se completan por defecto. */
export default function CopiasCorreo({cc,cco,onCC,onCCO,errores=[]}) {
  const [expandido,setExpandido]=useState(Boolean(cc||cco));
  return <div className="copias-correo" aria-label="Destinatarios en copia">
    {!expandido ? <button type="button" className="copias-correo-desplegar"
      onClick={()=>setExpandido(true)}>+ Agregar CC / CCO (opcional)</button> : <>
      <div className="copias-correo-campos">
        <label className="campo">
          <span className="etiqueta-campo">CC · Con copia</span>
          <input type="text" inputMode="email" autoComplete="off" spellCheck={false}
            placeholder="correo@ejemplo.cl (opcional)"
            value={cc} maxLength={2048} onChange={e=>onCC(e.target.value)}/>
        </label>
        <label className="campo">
          <span className="etiqueta-campo">CCO · Copia oculta</span>
          <input type="text" inputMode="email" autoComplete="off" spellCheck={false}
            placeholder="correo@ejemplo.cl (opcional)"
            value={cco} maxLength={2048} onChange={e=>onCCO(e.target.value)}/>
        </label>
      </div>
      <p className="micro apagado">Sin destinatarios por defecto. Para agregar varios, sepáralos con coma o punto y coma. CCO no será visible para otros destinatarios.</p>
    </>}
    {errores.map((e,i)=><p key={i} role="alert" className="chico pipeline-correo-error">{e}</p>)}
  </div>;
}
