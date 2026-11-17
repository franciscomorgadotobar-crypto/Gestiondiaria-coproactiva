import {supabase} from './supabase';

// El portal expone exclusivamente el PDF, generado desde datos autorizados
// por la RPC y fotografías firmadas del bucket privado "evidencia".
function fechaChile(valor) {
  if(!valor)return 'Sin fecha';
  const d=new Date(valor);
  return Number.isNaN(d.getTime())?'Sin fecha':d.toLocaleString('es-CL',{
    timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit'
  });
}
function texto(valor) {
  if(valor===null||valor===undefined||valor==='')return '';
  if(typeof valor==='string')return valor;
  if(Array.isArray(valor))return valor.map(texto).filter(Boolean).join(', ');
  if(typeof valor==='object')return Object.entries(valor)
    .map(([clave,contenido])=>clave+': '+texto(contenido)).join('; ');
  return String(valor);
}
function nombreArchivo(valor) {
  return String(valor||'Levantamiento').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_')
    .slice(0,65);
}
async function fotoEnJpeg(blob, dimensionMaxima=1100) {
  const url=URL.createObjectURL(blob);
  try {
    const img=await new Promise((resolve,reject)=>{
      const imagen=new Image();
      imagen.onload=()=>resolve(imagen);
      imagen.onerror=()=>reject(new Error('No se pudo leer una fotografía.'));
      imagen.src=url;
    });
    const escala=Math.min(1,dimensionMaxima/Math.max(img.naturalWidth,img.naturalHeight));
    const ancho=Math.max(1,Math.round(img.naturalWidth*escala));
    const alto=Math.max(1,Math.round(img.naturalHeight*escala));
    const canvas=document.createElement('canvas');
    canvas.width=ancho;canvas.height=alto;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('No se pudo preparar una fotografía.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,ancho,alto);
    ctx.drawImage(img,0,0,ancho,alto);
    const jpeg=canvas.toDataURL('image/jpeg',0.68);
    canvas.width=0;canvas.height=0;
    return {jpeg,ancho,alto};
  } finally {URL.revokeObjectURL(url);}
}
export async function generarPdfLevantamientoCliente(controlId,clienteId=null,progreso=()=>{}) {
  if(!controlId)throw new Error('No se ha seleccionado un levantamiento.');
  progreso('Cargando el levantamiento…');
  const {data,error}=await supabase.rpc('portal_levantamiento_detalle',{
    p_control_id:controlId,p_usuario_cliente:clienteId||null
  });
  if(error)throw new Error('No fue posible consultar el levantamiento autorizado: '+error.message);
  if(!data?.levantamiento)throw new Error('El levantamiento no está disponible.');

  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  pdf.setProperties({title:'Informe de levantamiento - '+data.levantamiento.plantilla_nombre,
    subject:'Levantamiento de comunidad - Coproactiva',author:'Coproactiva'});
  const m=15,w=180,limite=280;
  let y=15,pagina=1;
  const azul=[27,50,87],cafe=[159,86,36],gris=[93,105,119];
  function page() {pdf.addPage();pagina++;y=15;}
  function espacio(altura=8){if(y+altura>limite)page();}
  function linea(textoLinea,op={}) {
    const textoFinal=String(textoLinea||'');
    if(!textoFinal)return;
    const tamano=op.size||10;
    pdf.setFont('helvetica',op.bold?'bold':'normal');
    pdf.setFontSize(tamano);
    pdf.setTextColor(...(op.color||azul));
    const lines=pdf.splitTextToSize(textoFinal,op.width||w);
    const alto=Math.max(5,tamano*0.45+1.8);
    for(const l of lines){
      espacio(alto);
      pdf.text(l,op.x||m,y);
      y+=alto;
    }
    if(op.gap)y+=op.gap;
  }
  function seccion(titulo){
    espacio(15);y+=4;
    pdf.setDrawColor(220,204,187);pdf.line(m,y,w+m,y);y+=8;
    linea(titulo,{size:12,bold:true,color:cafe,gap:2});
  }
  function inicio(){
    pdf.setFillColor(...azul);pdf.rect(0,0,210,31,'F');
    pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(18);
    pdf.text('COPROACTIVA',m,14);
    pdf.setFontSize(9);pdf.setFont('helvetica','normal');
    pdf.text('INFORME DE LEVANTAMIENTO',m,23);
    y=41;
    linea(data.levantamiento.plantilla_nombre||'Levantamiento',{size:16,bold:true,gap:2});
    linea('Estado: '+(data.levantamiento.estado==='enviado'?'Finalizado':texto(data.levantamiento.estado)),{size:10});
    if(data.levantamiento.periodo)linea('Periodo: '+data.levantamiento.periodo);
    linea('Fecha del informe: '+fechaChile(data.levantamiento.enviado_en||data.levantamiento.creado_en),{color:gris,gap:3});
    linea('Documento de consulta. Registro elaborado por Coproactiva.',{size:9,color:gris});
  }
  inicio();
  const items=data.items||[];
  seccion('RESULTADOS DEL LEVANTAMIENTO');
  linea(items.length+' puntos de revisión',{size:10,color:gris,gap:2});
  let grupoActual=null;
  const estados={cumple:'Cumple',observacion:'Con observación',critico:'Crítico',
    sin_evaluar:'Sin evaluación'};
  for(let index=0;index<items.length;index++){
    const item=items[index];
    if(item.grupo!==grupoActual){
      grupoActual=item.grupo;
      espacio(17);y+=2;
      linea(grupoActual||'Sin categoría',{size:11,bold:true,color:cafe,gap:1});
    }
    espacio(12);
    linea((index+1)+'. '+(item.texto||'Punto de revisión'),{size:10,bold:true});
    const respuesta=texto(item.respuesta);
    if(respuesta)linea('Respuesta: '+respuesta,{size:9,color:gris});
    if(item.nota)linea('Observación: '+item.nota,{size:9,color:gris});
    if(!respuesta && !item.nota)linea('Estado: '+(estados[item.estado]||item.estado||'Sin evaluación'),{size:9,color:gris});
    y+=2;
  }
  const fotos=(data.adjuntos||[]).filter(a=>a.storage_path);
  if(fotos.length) {
    seccion('REGISTRO FOTOGRÁFICO Y EVIDENCIAS');
    linea(fotos.length+' evidencias asociadas al levantamiento.',{size:9,color:gris,gap:4});
    const paths=[...new Set(fotos.map(f=>f.storage_path))];
    const urls=new Map();
    for(let i=0;i<paths.length;i+=25){
      progreso('Autorizando evidencias '+Math.min(i+25,paths.length)+'/'+paths.length+'…');
      const batch=paths.slice(i,i+25);
      const {data:firmadas,error:fallo}=await supabase.storage.from('evidencia')
        .createSignedUrls(batch,60*60);
      if(fallo)throw new Error('No se pudo autorizar el acceso a las evidencias.');
      for(const foto of firmadas||[]){
        if(foto.signedUrl&&foto.path)urls.set(foto.path,foto.signedUrl);
      }
    }
    if(urls.size<paths.length)throw new Error('Algunas evidencias no están disponibles para la cuenta.');
    // Dos fotografías por fila; una fotografía fallida impide generar un PDF incompleto.
    const colW=85,alto=74,gap=10;
    let columna=0,filaY=y;
    for(let i=0;i<fotos.length;i++){
      const foto=fotos[i];
      progreso('Preparando PDF: fotografía '+(i+1)+' de '+fotos.length+'…');
      if(columna===0){espacio(alto+3);filaY=y;}
      const url=urls.get(foto.storage_path);
      const resp=await fetch(url);
      if(!resp.ok)throw new Error('No fue posible obtener una de las fotografías del levantamiento.');
      const blob=await resp.blob();
      if(!blob.type.startsWith('image/'))throw new Error('Una evidencia requiere un formato de imagen compatible.');
      const {jpeg,ancho,alto:altoImg}=await fotoEnJpeg(blob);
      const x=m+columna*(colW+gap),imgH=Math.min(57,altoImg*(colW/ancho));
      const imgW=Math.min(colW,ancho*(imgH/altoImg));
      pdf.setFillColor(247,247,247);pdf.roundedRect(x,filaY,colW,alto-2,2,2,'F');
      pdf.addImage(jpeg,'JPEG',x+(colW-imgW)/2,filaY+1,imgW,imgH,undefined,'FAST');
      pdf.setFontSize(8);pdf.setFont('helvetica','normal');pdf.setTextColor(...gris);
      const nombre=String(foto.descripcion||foto.nombre||'Evidencia '+(i+1)).slice(0,110);
      const legend=pdf.splitTextToSize(nombre,colW-5).slice(0,2);
      pdf.text(legend,x+2.5,filaY+61);
      columna=(columna+1)%2;
      if(columna===0||i===fotos.length-1)y=filaY+alto;
      if((i+1)%6===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  const paginas=pdf.getNumberOfPages();
  for(let p=1;p<=paginas;p++){
    pdf.setPage(p);
    pdf.setDrawColor(225,229,233);pdf.line(m,285,195,285);
    pdf.setTextColor(...gris);pdf.setFontSize(8);pdf.setFont('helvetica','normal');
    pdf.text('Coproactiva · Documento de consulta',m,290);
    pdf.text('Página '+p+' de '+paginas,195,290,{align:'right'});
  }
  progreso('PDF preparado.');
  return {blob:pdf.output('blob'),nombre:nombreArchivo(data.levantamiento.plantilla_nombre)+'.pdf'};
}
