import {jsPDF} from 'jspdf';
import {CAMPOS_POR_TIPO,TIPOS_DOCUMENTO,ETIQUETAS_ESTADO} from './plantillasDocumentales';

/** Exporta un PDF real con paginación A4, sin depender de capturas de pantalla. */
export function generarPdfDocumento(documento){
 const tipo=TIPOS_DOCUMENTO.find(t=>t.id===documento.tipo);
 if(!tipo||!CAMPOS_POR_TIPO[documento.tipo])
  throw new Error('Este tipo todavía requiere utilizar su generador de propuestas');
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const ancho=210,alto=297,margen=18,max=ancho-2*margen;
 const contenido=documento.contenido||{};
 let y=24,pagina=1;
 const paginaBase=()=>{
  doc.setDrawColor(222,217,211);doc.setLineWidth(.3);
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(237,113,48);
  doc.text('coproactiva',margen,17);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(105,105,105);
  doc.text(tipo.titulo,ancho-margen,15,{align:'right'});
  doc.line(margen,20,ancho-margen,20);
  doc.setDrawColor(222,217,211);doc.line(margen,alto-19,ancho-margen,alto-19);
  doc.setFontSize(8);doc.setTextColor(105,105,105);
  doc.text('Coproactiva Administración SpA',margen,alto-14);
  doc.text('www.coproactiva.cl',ancho-margen,alto-14,{align:'right'});
  y=29;
 };
 const nuevaPagina=()=>{doc.addPage();pagina++;paginaBase();};
 const asegurar=espacio=>{if(y+espacio>alto-26)nuevaPagina();};
 const escribir=(texto,opts={})=>{
  const fontSize=opts.size||10;const altoLinea=fontSize*.45;
  doc.setFont('helvetica',opts.bold?'bold':'normal');doc.setFontSize(fontSize);
  doc.setTextColor(...(opts.color||[48,54,61]));
  const lineas=doc.splitTextToSize(String(texto||''),max);
  for(const linea of lineas){
   asegurar(altoLinea+1);
   doc.text(linea,margen,y);y+=altoLinea+1;
  }
 };
 paginaBase();
 y=35;escribir('DOCUMENTO CORPORATIVO',{size:9,bold:true,color:[201,121,42]});y+=4;
 escribir(documento.titulo||tipo.titulo,{size:19,bold:true,color:[43,49,56]});y+=5;
 doc.setDrawColor(43,49,56);doc.setLineWidth(.6);doc.line(margen,y,ancho-margen,y);y+=9;
 const meta=[
  ['Fecha',contenido.fecha||new Date().toLocaleDateString('es-CL')],
  ['Estado',ETIQUETAS_ESTADO[documento.estado]||'Borrador'],
  ['Responsable',contenido.responsable||'Coproactiva Administración SpA']
 ];
 for(const [clave,valor] of meta){escribir(clave+': '+valor,{size:9});y+=1;}
 y+=7;
 for(const [i,[clave,nombre]] of CAMPOS_POR_TIPO[documento.tipo].entries()){
  asegurar(21);
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(237,113,48);
  doc.text(String(i+1).padStart(2,'0'),margen,y);
  doc.setFontSize(11);doc.setTextColor(43,49,56);
  doc.text(nombre.toUpperCase(),margen+13,y);
  y+=9;
  const texto=String(contenido[clave]||'Pendiente de completar.');
  const bloques=texto.split(/\r?\n/);
  for(const bloque of bloques){if(!bloque.trim()){asegurar(4);y+=4;}else{escribir(bloque,{size:10});y+=1;}}
  y+=9;
 }
 asegurar(25);doc.setDrawColor(160,160,160);doc.line(margen,y,75,y);y+=6;
 escribir(contenido.responsable||'Coproactiva Administración SpA',{bold:true,size:10});
 escribir('Responsable del documento',{size:9,color:[105,105,105]});
 const total=doc.getNumberOfPages();
 for(let p=1;p<=total;p++){
  doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(105,105,105);
  doc.text(p+' / '+total,ancho/2,alto-14,{align:'center'});
 }
 return doc.output('blob');
}
export function nombrePdfDocumento(titulo){
 return (String(titulo||'Documento').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9 _.-]/g,'').replace(/\s+/g,'_').slice(0,96)||'Documento')+'.pdf';
}
export function descargarPdfDocumento(documento){
 const blob=generarPdfDocumento(documento),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=nombrePdfDocumento(documento.titulo);
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
 return blob;
}
