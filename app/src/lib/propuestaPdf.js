import {jsPDF} from 'jspdf';
import {LOGO_PNG} from './logoCoproactiva.js';
import {nombreArchivoDePlantilla} from './nombresDocumentales.js';

// Exporta el mismo contenido interpolado de PropuestaDocumento, sin abrir
// la ventana de impresión. Las tablas y los párrafos se paginan como texto.
export async function generarPdfPropuesta(vista,cliente){
 if(!vista?.querySelector('.propuesta-presentacion'))throw new Error('La vista previa aún no está disponible.');
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter',compress:true});
 const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight();
 const m=18,max=W-2*m,lim=H-23;
 const tinta=[43,49,56],naranja=[213,134,59],gris=[90,99,108];
 const logo='data:image/png;base64,'+LOGO_PNG;
 let y=24;
 const texto=n=>String(n?.textContent||'').replace(/\u00a0/g,' ').trim();
 const tipografia=(size,bold=false,color=tinta)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);};
 function pie(){
  doc.setDrawColor(230,226,222);doc.line(m,H-17,W-m,H-17);
  tipografia(8,false,gris);doc.text('Coproactiva Administración SpA',m,H-12);
  const etiqueta=doc.splitTextToSize(cliente||'Propuesta comercial',max*.46)[0];
  doc.text(etiqueta,W-m,H-12,{align:'right'});
 }
 function pagina(){pie();doc.addPage();y=24;}
 function asegurar(h){if(y+h>lim&&y>24)pagina();}
 function escribir(str,{size=11,bold=false,color=tinta,gap=3,indent=0}={}){
  if(!str)return;
  tipografia(size,bold,color);const alto=size*.42+1;
  const lineas=doc.splitTextToSize(str,max-indent);
  for(const l of lineas){asegurar(alto);tipografia(size,bold,color);doc.text(l,m+indent,y);y+=alto;}
  y+=gap;
 }
 function tabla(el){
  const rows=[...el.querySelectorAll('tr')].filter(r=>r.cells.length);
  if(!rows.length)return;
  const n=rows[0].cells.length;
  const ratios=n===2?[.34,.66]:n===4?[.17,.48,.15,.20]:Array(n).fill(1/n);
  const widths=ratios.map(v=>v*max);
  const head=rows[0].querySelector('th')?rows.shift():null;
  function preparar(row,header){
   const cells=[...row.cells].map((c,i)=>{
    const size=header?9:10;
    const bold=header||i===0||Number(c.style.fontWeight)>=600;
    tipografia(size,bold);
    return {lines:doc.splitTextToSize(texto(c),widths[i]-5),size,bold};
   });
   return {cells,lines:Math.max(1,...cells.map(c=>c.lines.length))};
  }
  function segmento(r,offset,count,header,idx){
   const h=count*4.6+4;let x=m;
   r.cells.forEach((c,i)=>{
    doc.setFillColor(...(header?tinta:idx%2?[255,255,255]:[250,248,245]));
    doc.setDrawColor(232,228,224);doc.rect(x,y-3,widths[i],h,'FD');
    tipografia(c.size,c.bold,header?[255,255,255]:tinta);
    c.lines.slice(offset,offset+count).forEach((l,k)=>doc.text(l,x+2.5,y+1+k*4.6));
    x+=widths[i];
   });y+=h;
  }
  const cab=head?preparar(head,true):null;
  function cabecera(){if(cab)segmento(cab,0,cab.lines,true,0);}
  if(cab){asegurar(cab.lines*4.6+4+10);cabecera();}
  rows.forEach((row,i)=>{
   const r=preparar(row,false);let offset=0;
   const cabH=cab?cab.lines*4.6+4:0;
   if(y+r.lines*4.6+4>lim&&r.lines*4.6+4<=lim-24-cabH){pagina();cabecera();}
   while(offset<r.lines){
    let caben=Math.floor((lim-y-4)/4.6);
    if(caben<1){pagina();cabecera();caben=Math.floor((lim-y-4)/4.6);}
    const cantidad=Math.min(caben,r.lines-offset);
    segmento(r,offset,cantidad,false,i);offset+=cantidad;
    if(offset<r.lines){pagina();cabecera();}
   }
  });y+=6;
 }
 async function logoDesdeImagen(img){
  if(!img?.src)return null;
  const i=new Image();i.src=img.src;await i.decode();
  const canvas=document.createElement('canvas');
  const escala=Math.min(3,900/Math.max(i.naturalWidth,i.naturalHeight));
  canvas.width=Math.max(1,Math.round(i.naturalWidth*escala));canvas.height=Math.max(1,Math.round(i.naturalHeight*escala));
  canvas.getContext('2d').drawImage(i,0,0,canvas.width,canvas.height);
  return {data:canvas.toDataURL('image/png'),ratio:canvas.width/canvas.height};
 }
 async function recorrer(n){
  const tag=n.tagName;
  if(tag==='TABLE'){tabla(n);return;}
  if(tag==='IMG'){doc.addImage(logo,'PNG',m,y-3,50,10);y+=20;return;}
  if(n.classList.contains('propuesta-cierre')){
   const img=await logoDesdeImagen(n.querySelector('img'));
   const w=72,h=img?w/img.ratio:14.4;
   doc.addImage(img?.data||logo,'PNG',(W-w)/2,(H-h)/2,w,h);return;
  }
  if(n.classList.contains('propuesta-firma')){
   const firma=texto(n);
   if(firma){
    await document.fonts?.load?.("400 39px 'Retro Signature'");
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=150;
    const ctx=canvas.getContext('2d');ctx.font="78px 'Retro Signature', cursive";ctx.fillStyle='#2b3138';
    const ancho=ctx.measureText(firma).width;ctx.fillText(firma,5,105,980);
    const w=Math.min(max,Math.max(30,ancho*.18));asegurar(26);
    // Recorta el margen derecho sin cambiar la proporción de la firma.
    const crop=document.createElement('canvas');crop.width=Math.min(1000,Math.ceil(ancho+20));crop.height=150;
    crop.getContext('2d').drawImage(canvas,0,0);doc.addImage(crop.toDataURL('image/png'),'PNG',m,y-3,w,w*150/crop.width);y+=w*150/crop.width+4;
   }return;
  }
  if(tag==='H1'||tag==='H2'||tag==='H3'){
   asegurar(22);escribir(texto(n),{size:tag==='H1'?29:tag==='H2'?17:10,bold:tag!=='H1',color:tag==='H3'?naranja:tinta,gap:5});return;
  }
  if(tag==='UL'||tag==='OL'){
   for(const li of n.children)escribir(texto(li),{indent:3,gap:2});return;
  }
  if(tag==='P'){escribir(texto(n));return;}
  // El encabezado de sección incluye el número y el título.
  if(n.querySelector(':scope > h2')){
   asegurar(26);escribir([...n.children].map(texto).join('  '),{size:17,bold:true,gap:5});
   doc.setDrawColor(...tinta);doc.line(m,y-3,W-m,y-3);y+=3;return;
  }
  if(!n.children.length){escribir(texto(n),{size:10,color:gris,gap:2});return;}
  for(const child of n.children)await recorrer(child);
 }
 // El footer está en un slot; se reconstruye como pie repetido.
 const bloques=[...vista.children].filter(n=>n.getAttribute('slot')!=='footer');
 for(const b of bloques){
  if(b.style.breakBefore==='page'||b.style.pageBreakBefore==='always'){if(y>24)pagina();}
  await recorrer(b);
  if(b.classList.contains('propuesta-cierre'))continue;
  if(b.style.breakAfter==='page'||b.style.pageBreakAfter==='always')pagina();
  else y+=4;
 }
 pie();doc.setProperties({title:'Propuesta comercial - '+cliente,author:'Coproactiva Administración SpA'});
 return new File([doc.output('blob')],nombreArchivoDePlantilla('propuesta_comercial',cliente),{type:'application/pdf'});
}
