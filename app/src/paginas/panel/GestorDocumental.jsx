import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import {TIPOS_DOCUMENTO} from '../../lib/plantillasDocumentales';
import './GestorDocumental.css';

/**
 * Primera etapa del Gestor documental independiente.
 * Solo Propuesta comercial tiene editor y persistencia listos.
 * Las demás plantillas permanecen claramente en preparación.
 */
export default function GestorDocumental(){
 const [params]=useSearchParams();
 const [recientes,setRecientes]=useState([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const desdeCorreo=params.get('origen')==='correo';
 const prospecto=params.get('prospecto');
 useEffect(()=>{
   let activo=true;
   supabase.from('propuestas_comerciales')
     .select('id,nombre,actualizado_en,prospecto_id')
     .order('actualizado_en',{ascending:false}).limit(12)
     .then(({data,error:e})=>{
       if(!activo)return;
       if(e)setError('No se pudieron consultar los documentos: '+e.message);
       else setRecientes(data||[]);
       setCargando(false);
     });
   return()=>{activo=false;};
 },[]);
 const rutaNueva=prospecto?'/propuestas?prospecto='+encodeURIComponent(prospecto):'/propuestas';
 return <main className="documentos-gestor">
  <header className="documentos-gestor-cabecera">
   <div><span className="documentos-kicker">COPROACTIVA / DOCUMENTOS</span>
    <h1>Gestor documental</h1>
    <p>Crea, organiza y recupera documentos corporativos sin salir del sistema.</p>
   </div>
   <Link className="boton" to={rutaNueva}>+ Nueva propuesta</Link>
  </header>
  {desdeCorreo&&<div className="documentos-origen-correo">
   <strong>Acceso desde el editor de correos</strong>
   <p>Selecciona o prepara documentos aquí. Los PDF guardados en la biblioteca interna se pueden adjuntar desde el correo como archivos reales. La vinculación automática de documentos generados al correo aún está en desarrollo.</p>
   {prospecto&&<Link to={'/pipeline?prospecto='+encodeURIComponent(prospecto)+'&accion=correo'}>
    Volver al correo del prospecto
   </Link>}
  </div>}
  <section className="documentos-seccion" aria-labelledby="documentos-plantillas">
   <div className="documentos-titulo">
    <h2 id="documentos-plantillas">Crear desde plantilla</h2>
    <p>Un formato corporativo coherente para cada tipo de documento.</p>
   </div>
   <div className="documentos-plantillas">
    {TIPOS_DOCUMENTO.map((t,i)=><article className="documentos-plantilla" key={t.id}>
      <div className="documentos-plantilla-num">0{i+1}</div>
      <div className="documentos-plantilla-contenido">
       <h3>{t.titulo}</h3><p>{t.descripcion}</p>
       <small>Referencia: {t.referencias}</small>
      </div>
      {t.disponible
        ?<Link className="boton boton-secundario" to={rutaNueva}>Crear documento</Link>
        :<span className="documentos-pendiente">Plantilla en preparación</span>}
    </article>)}
   </div>
  </section>
  <section className="documentos-seccion" aria-labelledby="documentos-recientes">
   <div className="documentos-titulo">
    <h2 id="documentos-recientes">Propuestas guardadas</h2>
    <p>Documentos del generador comercial que ya se encuentran en Supabase.</p>
   </div>
   {cargando?<p>Cargando documentos...</p>:
    error?<p role="alert" className="aviso aviso-critico">{error}</p>:
    recientes.length===0?<p className="documentos-vacio">Todavía no hay propuestas guardadas en este repositorio. Las propuestas de Netlify se importarán sin sobrescribir los originales.</p>:
    <div className="documentos-recientes">
     {recientes.map(doc=><article key={doc.id} className="documentos-reciente">
      <div><strong>{doc.nombre}</strong>
       <span>Propuesta comercial - {new Date(doc.actualizado_en).toLocaleDateString('es-CL')}</span>
      </div>
      <Link className="boton boton-secundario" to={'/propuestas?documento='+encodeURIComponent(doc.id)}>Abrir</Link>
     </article>)}
    </div>}
  </section>
 </main>;
}
