import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO,ESTILO_DOCUMENTO_COPROACTIVA} from './plantillasDocumentales';

const limpio=texto=>String(texto??'').replace(/[\u2013\u2014]/g,'-').trim();
const lineas=texto=>limpio(texto).split(/\r?\n/).map(x=>x.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
const fecha=valor=>valor?new Date(valor).toLocaleDateString('es-CL'):'';
const hex=s=>s.replace('#','');

/** PDF editable generado con datos reales, sin reconstruir ni atribuir hechos.
 * Sólo en el navegador: se entrega PDF real que puede adjuntarse al correo.
 */
export async function generarPdfDocumento(documento){
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 const A4=210, margen=20, ancho=A4-margen*2;
 const C=ESTILO_DOCUMENTO_COPROACTIVA;
 let pagina=1,y=35;
 const nueva=()=>{pdf.addPage();pagina++;y=32;encabezado();};
 const pie=()=>{const n=pdf.getNumberOfPages();for(let p=1;p<=n;p++){
  pdf.setPage(p);pdf.setDrawColor(hex(C.naranja));pdf.line(margen,283,A4-margen,283);
  pdf.setTextColor(hex(C.gris));pdf.setFont('helvetica','normal');pdf.setFontSize(8);
  pdf.text('COPROACTIVA ADMINISTRACIÓN SPA  |  DOCUMENTO DE GESTIÓN',margen,290);
  pdf.text(String(p)+' / '+n,A4-margen,290,{align:'right'});
 }};
 const asegurar=altura=>{if(y+altura>276)nueva();};
 const encabezado=()=>{
  pdf.setFillColor(hex(C.grafito));pdf.rect(0,0,A4,22,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.setTextColor(hex(C.naranja));
  pdf.text('coproactiva',margen,14);
  pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(255,255,255);
  pdf.text('GESTIÓN DOCUMENTAL',A4-margen,14,{align:'right'});
  pdf.setDrawColor(hex(C.naranja));pdf.setLineWidth(.6);pdf.line(margen,25,A4-margen,25);
 };
 const parrafo=(texto,{tamano=10,negrita=false,espacio=5}={})=>{
  const valor=limpio(texto);if(!valor)return;
  pdf.setFont('helvetica',negrita?'bold':'normal');
  pdf.setFontSize(tamano);pdf.setTextColor(hex(C.grafito));
  const bloques=pdf.splitTextToSize(valor,ancho);
  for(const bloque of bloques){
   asegurar(tamano*.38+2);
   pdf.text(bloque,margen,y);
   y+=tamano*.38+2;
  }y+=espacio;
 };
 const seccion=(n,titulo,contenido)=>{
  if(!limpio(contenido))return;
  asegurar(18);
  pdf.setFont('helvetica','bold');pdf.setFontSize(12);
  pdf.setTextColor(hex(C.naranja));pdf.text(String(n).padStart(2,'0'),margen,y);
  pdf.setTextColor(hex(C.grafito));pdf.text(titulo,margen+13,y);
  y+=8;
  const items=lineas(contenido);
  if(items.length>1){
   for(const item of items){
     const partes=pdf.splitTextToSize(item,ancho-10);
     asegurar(partes.length*5+4);
     pdf.setFillColor(248,245,241);
     pdf.rect(margen,y-4,ancho,partes.length*5+5,'F');
     pdf.setTextColor(hex(C.naranja));pdf.setFontSize(9);pdf.text('•',margen+3,y);
     pdf.setTextColor(hex(C.grafito));pdf.setFontSize(9);
     pdf.text(partes,margen+9,y);
     y+=partes.length*5+6;
   }y+=4;
  }else parrafo(contenido);
 };
 encabezado();
 const tipo=TIPOS_DOCUMENTO.find(t=>t.id===documento.tipo);
 pdf.setFont('helvetica','bold');pdf.setFontSize(20);pdf.setTextColor(hex(C.grafito));
 const titulo=limpio(documento.titulo||tipo?.titulo||'Documento');
 const t=pdf.splitTextToSize(titulo,ancho);
 for(const l of t){asegurar(11);pdf.text(l,margen,y);y+=10;}
 y+=4;
 pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(hex(C.gris));
 if(documento.contexto_nombre){pdf.text(limpio(documento.contexto_nombre),margen,y);y+=6;}
 pdf.text('Versión '+(documento.version||1)+'  |  '+limpio(documento.estado||'Borrador')+
  '  |  '+fecha(documento.actualizado_en||new Date()),margen,y);y+=12;
 pdf.setDrawColor(224,218,210);pdf.line(margen,y-5,A4-margen,y-5);
 if(documento.contenido?.periodo)parrafo('Periodo: '+documento.contenido.periodo,{negrita:true});
 if(documento.contenido?.introduccion)parrafo(documento.contenido.introduccion);
 (CAMPOS_POR_TIPO[documento.tipo]||[]).forEach(([id,etiqueta],i)=>seccion(i+1,etiqueta,documento.contenido?.[id]));
 pie();
 pdf.setProperties({title:titulo,author:'Coproactiva Administración SpA',subject:tipo?.titulo||'Gestión documental'});
 return {blob:pdf.output('blob'),nombre:titulo.replace(/[\\/:*?"<>|]+/g,'_').slice(0,90)+'.pdf'};
}
