import{u as se,r as z,j as e,s as q,d as ne}from"./index-BEG387zm.js";function $(a){return String(a??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}const U=a=>a==null?{fondo:"var(--niebla)",borde:"var(--pizarra)",texto:"var(--pizarra)",etiqueta:"No aplica"}:a>=70?{fondo:"var(--ok-fondo)",borde:"var(--ok-borde)",texto:"var(--ok-texto)",etiqueta:"Bien"}:a>=40?{fondo:"var(--alerta-fondo)",borde:"var(--alerta-borde)",texto:"var(--alerta-texto)",etiqueta:"En riesgo"}:{fondo:"var(--critico-fondo)",borde:"var(--critico-borde)",texto:"var(--critico-texto)",etiqueta:"Crítico"},Y={L1:{label:"Administración integral",desc:"La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes.",items:["Recepción y auditoría documental completa","Gestión financiera con rendiciones mensuales al comité","Coordinación de proveedores y mantención preventiva","Plataforma digital para cobro y comunicación","Informes de gestión mensuales con indicadores clave"],valMin:"600.000",valMax:"900.000"},L2:{label:"Nueva administración",desc:"La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión.",items:["Levantamiento del estado administrativo y financiero actual","Regularización legal, laboral y documental prioritaria","Implementación de plataforma de gestión y control de morosidad","Coordinación de equipamiento crítico y mantención preventiva","Informes periódicos al comité con plan de avance"],valMin:"800.000",valMax:"1.100.000"},L3:{label:"Asesoría externa",desc:"Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente.",items:["Auditoría documental con informe de hallazgos","Asesoría legal y normativa sobre Ley 21.442","Orientación para regularización laboral y previsional","Plan de acción priorizado por nivel de riesgo","Acompañamiento al comité en la toma de decisiones"],valMin:"300.000",valMax:"500.000"}},re=`
  @page { size: A4; margin: 0; }
  :root {
    --naranja: #d5863b; --pizarra: #4a5a68; --tinta: #2b3138; --papel: #f7f4f0; --niebla: #e9e6e2;
    --ok-texto: #4e6b4a; --ok-fondo: #eef1e9; --ok-borde: #d8e0cf;
    --alerta-texto: #8a5f22; --alerta-fondo: #fdf3e6; --alerta-borde: #f0dcbd;
    --critico-texto: #93392b; --critico-fondo: #fbeeeb; --critico-borde: #edd2cb;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 9pt/1.5 'Source Sans Pro', -apple-system, system-ui, sans-serif; color: var(--tinta); background: #fff; }
  h1, h2, h3 { font-family: 'Montserrat', -apple-system, system-ui, sans-serif; margin: 0; }
  .hoja { width: 210mm; min-height: 297mm; position: relative; padding: 0 0 16mm; page-break-after: always; }
  .hoja:last-child { page-break-after: auto; }

  .cab { background: var(--tinta); padding: 10mm 16mm 6mm; position: relative; }
  .cab img { height: 22px; margin-bottom: 5mm; filter: brightness(0) invert(1); }
  .cab .pag { position: absolute; top: 10mm; right: 16mm; font-size: 7pt; color: #aab3ba; }
  .cab h1 { font-size: 17pt; font-weight: 700; color: #fff; margin-bottom: 1.5mm; }
  .cab .sub { font-size: 8pt; color: #c9ceD2; margin-bottom: 5mm; }
  .cab .ficha { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .cab .ficha dt { font-size: 6.5pt; letter-spacing: .1em; text-transform: uppercase; color: #9ba3aa; margin-bottom: 1mm; }
  .cab .ficha dd { margin: 0; font-size: 8.5pt; font-weight: 700; color: #fff; }
  .cab .barra { position: absolute; bottom: 0; left: 0; right: 0; height: 1mm; background: var(--naranja); }

  .cuerpo { padding: 6mm 16mm 0; }
  .seccion-titulo {
    font-size: 7.5pt; font-weight: 700; color: var(--naranja); text-transform: uppercase;
    letter-spacing: .1em; border-bottom: 0.5mm solid var(--naranja); padding-bottom: 1.5mm; margin: 6mm 0 3.5mm;
  }
  .seccion-titulo:first-child { margin-top: 0; }

  .resultado { display: flex; align-items: center; gap: 5mm; padding: 4mm 5mm; border-radius: 2mm; border: 0.5mm solid; }
  .resultado .aro { width: 16mm; height: 16mm; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .resultado .aro .n { font-size: 14pt; font-weight: 700; line-height: 1; }
  .resultado .aro .s { font-size: 6pt; color: var(--pizarra); }
  .resultado .txt .nivel { font-family: 'Montserrat', sans-serif; font-size: 11pt; font-weight: 700; margin-bottom: 1.5mm; }
  .resultado .txt p { margin: 0; font-size: 8pt; line-height: 1.5; opacity: .9; }

  .area-fila { display: flex; align-items: center; gap: 3mm; margin-bottom: 2.5mm; }
  .area-fila .nombre { width: 26mm; font-size: 8pt; color: var(--pizarra); }
  .area-fila .barra-fondo { flex: 1; height: 4.5mm; background: var(--niebla); border-radius: 1mm; position: relative; overflow: hidden; }
  .area-fila .barra-rellena { height: 100%; border-radius: 1mm; }
  .area-fila .pct { position: absolute; top: 50%; transform: translateY(-50%); font-size: 7pt; font-weight: 700; }
  .area-fila .estado { width: 16mm; height: 4.5mm; border-radius: 1mm; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; font-weight: 700; }

  .obs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; }
  .obs-tarjeta { border: 0.3mm solid var(--niebla); border-radius: 2mm; padding: 2.5mm 3mm; background: #fff; border-left: 1.5mm solid; }
  .obs-tarjeta .cab2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5mm; }
  .obs-tarjeta .nombre { font-size: 8pt; font-weight: 700; color: var(--tinta); }
  .obs-tarjeta .pct { font-size: 7pt; font-weight: 700; }
  .obs-tarjeta .texto { font-size: 7.5pt; color: var(--pizarra); line-height: 1.5; }
  .obs-tarjeta .texto em { color: #9ba3aa; }

  .hallazgo { display: flex; align-items: flex-start; gap: 3mm; padding: 2mm 3mm; background: var(--critico-fondo); border-radius: 1.5mm; border-left: 1.5mm solid var(--critico-texto); margin-bottom: 1.5mm; }
  .hallazgo .x { font-size: 9pt; font-weight: 700; color: var(--critico-texto); line-height: 1; }
  .hallazgo .t { font-size: 7.5pt; color: var(--tinta); line-height: 1.4; }
  .hallazgo-area { font-size: 7.5pt; font-weight: 700; color: var(--pizarra); border-bottom: 0.3mm solid var(--pizarra); display: inline-block; margin-bottom: 2mm; }

  .propuesta { background: var(--ok-fondo); border: 0.7mm solid var(--ok-borde); border-radius: 2mm; overflow: hidden; margin-bottom: 3mm; }
  .propuesta .banda { background: #1d5c38; padding: 3mm 5mm; }
  .propuesta .banda span { font-size: 9.5pt; font-weight: 700; color: #fff; }
  .propuesta .contenido { padding: 4mm 5mm; }
  .propuesta .desc { font-size: 8pt; color: var(--pizarra); line-height: 1.5; margin-bottom: 3mm; }
  .propuesta .item { display: flex; align-items: flex-start; gap: 3mm; margin-bottom: 2.5mm; }
  .propuesta .item .ok { width: 5mm; height: 5mm; background: #6fa885; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: 700; color: #fff; flex-shrink: 0; margin-top: .5mm; }
  .propuesta .item .txt { font-size: 8.5pt; color: var(--tinta); line-height: 1.4; }
  .propuesta .valor { background: #fff; border: 0.5mm solid var(--ok-borde); border-radius: 2mm; padding: 3mm 4mm; display: flex; align-items: center; justify-content: space-between; margin-top: 3mm; }
  .propuesta .valor .et { font-size: 7.5pt; color: var(--pizarra); margin-bottom: 1mm; }
  .propuesta .valor .sub { font-size: 6.5pt; color: #9ba3aa; }
  .propuesta .valor .monto { text-align: right; font-size: 13pt; font-weight: 700; color: #1d5c38; }
  .propuesta .valor .cur { font-size: 6.5pt; color: #9ba3aa; }

  .proximo { background: var(--tinta); border-radius: 2mm; padding: 4mm 5mm 4mm 8mm; position: relative; overflow: hidden; }
  .proximo::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2.5mm; background: var(--naranja); }
  .proximo .t { font-size: 8.5pt; font-weight: 700; color: var(--naranja); margin-bottom: 2mm; }
  .proximo .d { font-size: 7.5pt; color: #ccd2d6; line-height: 1.6; }

  .pie { margin-top: 8mm; padding: 0 16mm; font-size: 7.5pt; color: var(--pizarra); }

  @media screen { body { background: #eceae7; padding: 20px 0; } .hoja { margin: 0 auto 20px; box-shadow: 0 0 0 1px var(--niebla); } }
`;function J(a,s,o,l){const n=new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"});return`<div class="cab">
    ${`<img src="${$(l)}" alt="CoproActiva">`}
    <div class="pag">Pág. ${a} / ${s}</div>
    <h1>Informe de diagnóstico inicial</h1>
    <p class="sub">Diagnóstico preliminar de riesgo y propuesta de administración</p>
    <dl class="ficha">
      <div><dt>Condominio</dt><dd>${$(o.nombre_condominio||"—")}</dd></div>
      <div><dt>Fecha</dt><dd>${n}</dd></div>
      <div><dt>Comuna</dt><dd>${$(o.comuna||"—")}${o.unidades?` · ${o.unidades} unid.`:""}</dd></div>
      <div><dt>Elaborado por</dt><dd>CoproActiva</dd></div>
    </dl>
    <div class="barra"></div>
  </div>`}function W(a){return`<p class="pie">coproactiva · Comunidades que funcionan. — Documento confidencial — ${a}</p>`}function le(a){var _;const{prospecto:s,diagnostico:o,areas:l,notasAreas:n,lineaElegida:k,logo:m}=a,N=new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"}),r=Y[k]??Y.L2,x=U(o.nivel==="Crítico"?10:o.nivel==="En riesgo"||o.globalScore>=80&&o.hallazgosCriticos.length?45:o.globalScore),S=[...l].filter(c=>c.pct!=null).sort((c,b)=>c.pct-b.pct),j={};for(const c of o.hallazgosCriticos)(j[_=c.area]??(j[_]=[])).push(c.texto);const f=`<div class="hoja">
    ${J(1,2,s,m)}
    <div class="cuerpo">
      <div class="seccion-titulo">Resultado del diagnóstico</div>
      <div class="resultado" style="background:${x.fondo};border-color:${x.borde}">
        <div class="aro"><div class="n" style="color:${x.texto}">${o.globalScore}</div><div class="s">%</div></div>
        <div class="txt">
          <div class="nivel" style="color:${x.texto}">${$(o.nivel)}</div>
          <p style="color:${x.texto}">${ce(o)}</p>
        </div>
      </div>

      <div class="seccion-titulo">Comparativo por área — de menor a mayor cumplimiento</div>
      ${S.map(c=>{const b=U(c.pct);return`<div class="area-fila">
          <div class="nombre">${$(c.label)}</div>
          <div class="barra-fondo">
            <div class="barra-rellena" style="width:${c.pct}%;background:${b.borde}"></div>
            <span class="pct" style="${c.pct>20?"right:4mm;color:#fff":`left:${c.pct}%;margin-left:2mm;color:${b.texto}`}">${c.pct}%</span>
          </div>
          <div class="estado" style="background:${b.fondo};color:${b.texto}">${b.etiqueta}</div>
        </div>`}).join("")}

      <div class="seccion-titulo">Observaciones por área</div>
      <div class="obs-grid">
        ${l.map(c=>{const b=U(c.pct),y=n==null?void 0:n[c.id];return`<div class="obs-tarjeta" style="border-left-color:${b.borde}">
            <div class="cab2">
              <span class="nombre">${$(c.label)}</span>
              ${c.pct!=null?`<span class="pct" style="color:${b.texto}">${c.pct}% · ${b.etiqueta}</span>`:""}
            </div>
            <div class="texto">${y?$(y):"<em>Sin observaciones registradas.</em>"}</div>
          </div>`}).join("")}
      </div>
    </div>
    ${W(N)}
  </div>`,w=`<div class="hoja">
    ${J(2,2,s,m)}
    <div class="cuerpo">
      ${o.hallazgosCriticos.length?`
        <div class="seccion-titulo">Ítems críticos faltantes · ${o.hallazgosCriticos.length} sin resolver</div>
        ${Object.entries(j).map(([c,b])=>`
          <div class="hallazgo-area">${$(c)}</div>
          ${b.map(y=>`<div class="hallazgo"><div class="x">×</div><div class="t">${$(y)}</div></div>`).join("")}
        `).join("")}
      `:""}

      <div class="seccion-titulo">Propuesta de servicio</div>
      <div class="propuesta">
        <div class="banda"><span>${$(r.label)}</span></div>
        <div class="contenido">
          <div class="desc">${$(r.desc)}</div>
          ${r.items.map(c=>`<div class="item"><div class="ok">OK</div><div class="txt">${$(c)}</div></div>`).join("")}
          <div class="valor">
            <div><div class="et">Valor mensual estimado del servicio</div><div class="sub">Sujeto a confirmación en reunión presencial</div></div>
            <div><div class="monto">$${r.valMin} – $${r.valMax}</div><div class="cur" style="text-align:right">CLP / mes</div></div>
          </div>
        </div>
      </div>

      <div class="seccion-titulo">Próximo paso</div>
      <div class="proximo">
        <div class="t">Próximo paso</div>
        <div class="d">CoproActiva los invita a una reunión de presentación con el comité, donde se revisará este diagnóstico en detalle y se confirmará el valor definitivo del servicio. Para coordinar fecha y hora, contáctenos a través de nuestros canales habituales.</div>
      </div>
    </div>
    ${W(N)}
  </div>`;return`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Diagnóstico — ${$(s.nombre_condominio||"")}</title>
<style>${re}</style>
</head>
<body>${f}${w}</body>
</html>`}function ce(a){var s;if(a.nivel==="Estable")return"La comunidad presenta una gestión ordenada en todas las áreas. CoproActiva puede optimizarla de manera continua.";if(a.nivel==="Estable con observaciones"){const o=[];return(s=a.areasBajo60)!=null&&s.length&&o.push("focos de riesgo en: "+a.areasBajo60.map(l=>{var n;return((n=l.area)==null?void 0:n.label)??l.label}).join(", ")),a.hasCritFail&&o.push(`${a.hallazgosCriticos.length} ítem(s) crítico(s) sin resolver`),`El puntaje global es satisfactorio, pero se identifican: ${o.join(" y ")}. Estos aspectos requieren atención aunque el resultado global sea positivo.`}return a.nivel==="En riesgo"?"Existen aspectos que requieren intervención moderada o incumplimientos en ítems críticos. Sin acción oportuna pueden derivar en problemas administrativos, legales o financieros de mayor envergadura.":"Se detectan deficiencias graves en una o más áreas. Se requiere intervención urgente para evitar consecuencias legales y financieras significativas."}const L=[{id:"legal",label:"Legal"},{id:"financiero",label:"Financiero"},{id:"laboral",label:"Laboral",condArea:"trabajadores"},{id:"tecnico",label:"Técnico"},{id:"seguridad",label:"Seguridad"},{id:"documental",label:"Documental"}],de={3:"Crítico",2:"Importante",1:"Básico"},me=[{valor:0,etiqueta:"No cumple"},{valor:.25,etiqueta:"No sabe"},{valor:.5,etiqueta:"Parcial"},{valor:1,etiqueta:"Cumple"}],pe={L1:{label:"Administración integral",desc:"La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes."},L2:{label:"Nueva administración",desc:"La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión."},L3:{label:"Asesoría externa",desc:"Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente."}};function ue(a,s,o){return a<40?"L3":a>=75&&s.length===0&&!o?"L1":"L2"}function ye({id:a}){const s=se(),[o,l]=z.useState(null),[n,k]=z.useState(null),[m,N]=z.useState(null),[r,x]=z.useState({}),[S,j]=z.useState({}),[f,w]=z.useState(null),[_,c]=z.useState("contexto"),[b,y]=z.useState(null),[X,E]=z.useState(!1);async function Z(){var v;y(null);const{data:i,error:t}=await q.from("controles").select("*").eq("id",a).maybeSingle();if(t)return y(t.message);if(!i)return y("Este diagnóstico no existe o no tienes acceso.");l(i);const[d,p,h]=await Promise.all([i.prospecto_id?q.from("prospectos").select("*").eq("id",i.prospecto_id).maybeSingle():Promise.resolve({data:null,error:null}),q.from("control_items").select("*").eq("control_id",a).order("orden"),q.from("diagnosticos_resultado").select("*").eq("control_id",a).maybeSingle()]);if(p.error)return y(p.error.message);k(d.data??null),N(p.data??[]),w(h.data??null);const u={};for(const C of p.data??[])C.respuesta&&typeof C.respuesta=="object"&&"valor"in C.respuesta&&(u[C.id]=C.respuesta.valor);x(u),j(((v=h.data)==null?void 0:v.notas_areas)??{})}z.useEffect(()=>{Z()},[a]);const P=z.useMemo(()=>{const i=new Map;for(const t of m??[])i.has(t.grupo)||i.set(t.grupo,[]),i.get(t.grupo).push(t);return i},[m]),ee=z.useMemo(()=>{var t;const i=new Map;for(const d of m??[]){const p=(t=d.config)==null?void 0:t.clave;p&&i.set(p,d)}return i},[m]),K=z.useMemo(()=>(m??[]).find(i=>i.grupo==="contexto"&&i.texto==="Trabajadores contratados"),[m]),T=K?Number(r[K.id]||0):0;function Q(i){if(i==="trabajadores")return T>0;if(i==="menosDiez")return T>0&&T<10;if(i==="diezOMas")return T>=10;const t=ee.get(i);return t?!!r[t.id]:!1}function B(i){var d;const t=(d=i.config)==null?void 0:d.condicion;return!(t&&!Q(t))}function R(i){return i.condArea?Q(i.condArea):!0}function F(i){var u;if(!R(i))return null;const t=(P.get(i.id)??[]).filter(B);if(t.length===0)return null;let d=0,p=0,h=0;for(const v of t){const C=((u=v.config)==null?void 0:u.peso)??1;p+=C;const g=r[v.id];g!=null&&(d+=C*Number(g)),C===3&&(g===0||g===.25)&&(h+=1)}return p===0?null:{pct:Math.round(d/p*100),criticosFallidos:h,evaluados:t.filter(v=>r[v.id]!==void 0).length,total:t.length}}const A=z.useMemo(()=>{var C;const i=L.map(g=>({area:g,score:F(g)})).filter(g=>g.score),t=i.length?Math.round(i.reduce((g,I)=>g+I.score.pct,0)/i.length):0,d=[];for(const g of L)if(R(g))for(const I of(P.get(g.id)??[]).filter(B)){if((((C=I.config)==null?void 0:C.peso)??1)!==3)continue;const H=r[I.id];(H===0||H===.25)&&d.push({area:g.label,texto:I.texto,tipo:H===0?"no_cumple":"no_sabe"})}const p=d.length>0,h=i.filter(g=>g.score.pct<60),u=i.filter(g=>g.score.pct<40);let v;return t>=80&&h.length===0&&!p?v="Estable":t>=80?v="Estable con observaciones":t>=50?v="En riesgo":v="Crítico",{globalScore:t,hallazgosCriticos:d,hasCritFail:p,areasBajo60:h,areasRed:u,nivel:v,linea:ue(t,u,p)}},[m,r]);function G(i,t){x(d=>({...d,[i]:d[i]===t?void 0:t}))}async function V(i){E(!0),y(null);const t=(m??[]).map(u=>({id:u.id,respuesta:{valor:r[u.id]??null},evaluado_en:r[u.id]!==void 0?new Date().toISOString():u.evaluado_en}));for(const u of t){const{error:v}=await q.from("control_items").update({respuesta:u.respuesta,evaluado_en:u.evaluado_en}).eq("id",u.id);if(v)return E(!1),y(v.message)}const d={control_id:a,score:A.globalScore,nivel:A.nivel,linea_sugerida:A.linea,linea_elegida:(f==null?void 0:f.linea_elegida)??A.linea,hallazgos_criticos:A.hallazgosCriticos,notas_areas:S},{data:p,error:h}=f?await q.from("diagnosticos_resultado").update(d).eq("control_id",a).select().single():await q.from("diagnosticos_resultado").insert(d).select().single();if(h||!p)return E(!1),y((h==null?void 0:h.message)||"No se pudo guardar el resultado.");if(w(p),i&&(o==null?void 0:o.estado)!=="enviado"){const{error:u}=await q.from("controles").update({estado:"enviado",enviado_en:new Date().toISOString()}).eq("id",a);if(u)return E(!1),y(u.message);l(v=>({...v,estado:"enviado",enviado_en:new Date().toISOString()}))}E(!1)}async function ae(i){if(!f)return;E(!0);const{data:t,error:d}=await q.from("diagnosticos_resultado").update({linea_elegida:i}).eq("control_id",a).select().single();if(E(!1),d||!t)return y((d==null?void 0:d.message)||"No se pudo guardar la línea elegida.");w(t)}function ie(){const i=(f==null?void 0:f.linea_elegida)??A.linea,t=L.map(p=>{var h;return{id:p.id,label:p.label,pct:((h=F(p))==null?void 0:h.pct)??null}}),d=le({prospecto:n,diagnostico:A,areas:t,notasAreas:S,lineaElegida:i,logo:"/cotizador-coproactiva/logo-coproactiva.svg"});ne(d)||y("El navegador bloqueó la ventana del informe. Permite las ventanas emergentes para este sitio.")}if(b)return e.jsx("div",{className:"pantalla",children:e.jsx("div",{className:"cuerpo",children:e.jsx("div",{className:"aviso aviso-critico",children:b})})});if(!o||!n||m===null)return e.jsx("p",{className:"cargando",children:"Cargando…"});const oe=P.get("contexto")??[],te=P.get("instalaciones")??[],D=["contexto","instalaciones",...L.map(i=>i.id),"revision"],M=D.indexOf(_);return e.jsxs("div",{className:"pantalla",children:[e.jsxs("header",{className:"encabezado",children:[e.jsx("button",{className:"boton boton-texto",style:{padding:"4px 8px 8px 0"},onClick:()=>s("/pipeline"),children:"‹ Pipeline"}),e.jsx("h1",{className:"h3",children:"Diagnóstico comercial"}),e.jsxs("p",{className:"chico apagado",style:{margin:"4px 0 0"},children:[n.nombre_condominio,n.comuna?` · ${n.comuna}`:""]})]}),e.jsxs("div",{className:"cuerpo",children:[o.estado==="enviado"&&e.jsx("div",{className:"aviso",style:{marginBottom:14},children:"Este diagnóstico ya fue enviado. Los cambios se siguen guardando si lo editas."}),e.jsx("nav",{className:"diag-pasos","aria-label":"Pasos del diagnóstico",children:D.map((i,t)=>e.jsx("button",{type:"button",className:"diag-paso"+(i===_?" activo":"")+(t<M?" hecho":""),onClick:()=>c(i),children:ge(i)},i))}),_==="contexto"&&e.jsx(ve,{prospecto:n,items:oe,respuestas:r,onResponder:G}),_==="instalaciones"&&e.jsx(be,{items:te,respuestas:r,onResponder:G}),L.map(i=>_===i.id&&e.jsx(he,{area:i,items:P.get(i.id)??[],respuestas:r,notas:S,setNotas:j,itemAplica:B,areaAplica:R,scoreArea:F,onResponder:G},i.id)),_==="revision"&&e.jsx(xe,{diagnostico:A,resultado:f,guardando:X,onGuardar:()=>V(!1),onEnviar:()=>V(!0),onElegirLinea:ae,onGenerarPdf:ie}),e.jsxs("div",{className:"fila-botones",style:{marginTop:20},children:[e.jsx("button",{type:"button",className:"boton boton-secundario",disabled:M===0,onClick:()=>c(D[M-1]),children:"← Anterior"}),M<D.length-1&&e.jsx("button",{type:"button",className:"boton",onClick:()=>c(D[M+1]),children:"Siguiente →"})]})]})]})}function ge(a){var o;return{contexto:"Datos",instalaciones:"Instal.",revision:"Revisión"}[a]??((o=L.find(l=>l.id===a))==null?void 0:o.label)??a}function ve({prospecto:a,items:s,respuestas:o,onResponder:l}){return e.jsxs("section",{className:"diag-seccion",children:[e.jsx("h2",{className:"h4",style:{marginTop:0},children:"Datos de la comunidad"}),e.jsxs("div",{className:"tarjeta",style:{padding:14,marginBottom:16},children:[e.jsx("p",{className:"micro apagado",style:{margin:0},children:"Estos datos vienen del prospecto y se editan desde el Pipeline."}),e.jsxs("div",{className:"diag-datos-prospecto",children:[e.jsx(O,{etiqueta:"Condominio",valor:a.nombre_condominio}),e.jsx(O,{etiqueta:"Dirección",valor:[a.direccion,a.comuna].filter(Boolean).join(", ")||"—"}),e.jsx(O,{etiqueta:"Unidades",valor:a.unidades??"—"}),e.jsx(O,{etiqueta:"Contacto",valor:a.nombre_contacto?`${a.nombre_contacto}${a.cargo_contacto?" · "+a.cargo_contacto:""}`:"—"})]})]}),e.jsx("div",{className:"diag-lista",children:s.map(n=>e.jsx(fe,{item:n,valor:o[n.id],onResponder:l},n.id))})]})}function fe({item:a,valor:s,onResponder:o}){var l,n,k;if(a.tipo_ingreso==="seleccion"){const m=((l=a.config)==null?void 0:l.opciones)??[];return e.jsxs("div",{className:"campo",children:[e.jsx("label",{className:"etiqueta-campo",children:a.texto}),e.jsxs("select",{value:s??"",onChange:N=>o(a.id,N.target.value||void 0),children:[e.jsx("option",{value:"",children:"Sin definir"}),m.map(N=>e.jsx("option",{value:N.valor,children:N.etiqueta},N.valor))]})]})}return a.tipo_ingreso==="numero"?e.jsxs("div",{className:"campo",children:[e.jsx("label",{className:"etiqueta-campo",children:a.texto}),e.jsx("input",{type:"number",min:((n=a.config)==null?void 0:n.min)??0,value:s??"",onChange:m=>o(a.id,m.target.value===""?void 0:Number(m.target.value))}),((k=a.config)==null?void 0:k.hint)&&e.jsx("span",{className:"micro apagado",children:a.config.hint})]}):e.jsxs("label",{className:"diag-toggle"+(s?" on":""),children:[e.jsx("input",{type:"checkbox",checked:!!s,onChange:m=>o(a.id,m.target.checked)}),e.jsx("span",{children:a.texto})]})}function be({items:a,respuestas:s,onResponder:o}){return e.jsxs("section",{className:"diag-seccion",children:[e.jsx("h2",{className:"h4",style:{marginTop:0},children:"Instalaciones y equipamiento"}),e.jsx("p",{className:"chico apagado",children:"Marca todo lo que tiene el edificio — determina qué ítems aplican en el diagnóstico."}),e.jsx("div",{className:"diag-lista",children:a.map(l=>e.jsxs("label",{className:"diag-toggle"+(s[l.id]?" on":""),children:[e.jsx("input",{type:"checkbox",checked:!!s[l.id],onChange:n=>o(l.id,n.target.checked)}),e.jsx("span",{children:l.texto})]},l.id))})]})}function he({area:a,items:s,respuestas:o,notas:l,setNotas:n,itemAplica:k,areaAplica:m,scoreArea:N,onResponder:r}){const x=m(a),S=N(a);return x?e.jsxs("section",{className:"diag-seccion",children:[e.jsxs("div",{className:"fila",style:{marginBottom:4},children:[e.jsx("h2",{className:"h4 crece",style:{margin:0},children:a.label}),S&&e.jsxs("span",{className:"chip chip-tipo",children:[S.pct,"% · ",S.evaluados,"/",S.total," evaluados"]})]}),e.jsx("div",{className:"diag-lista",children:s.filter(k).map(j=>{var f;return e.jsxs("div",{className:"tarjeta diag-item",children:[e.jsxs("div",{className:"fila",style:{alignItems:"flex-start",marginBottom:8},children:[e.jsx("p",{className:"diag-item-texto crece",style:{margin:0},children:j.texto}),e.jsx("span",{className:"micro apagado",children:de[(f=j.config)==null?void 0:f.peso]??""})]}),e.jsx("div",{className:"diag-escala",children:me.map(w=>e.jsx("button",{type:"button",className:"diag-escala-boton"+(o[j.id]===w.valor?" activo":""),onClick:()=>r(j.id,w.valor),children:w.etiqueta},w.valor))})]},j.id)})}),e.jsxs("div",{className:"campo",style:{marginTop:14},children:[e.jsx("label",{className:"etiqueta-campo",children:"Observaciones del área"}),e.jsx("textarea",{value:l[a.id]??"",onChange:j=>n(f=>({...f,[a.id]:j.target.value}))})]})]}):e.jsxs("section",{className:"diag-seccion",children:[e.jsx("h2",{className:"h4",style:{marginTop:0},children:a.label}),e.jsxs("div",{className:"vacio",children:["Esta comunidad no tiene personal contratado, por lo que el área ",a.label," no se evalúa."]})]})}function O({etiqueta:a,valor:s}){return e.jsxs("div",{className:"diag-resumen-dato",children:[e.jsx("span",{className:"micro apagado",children:a}),e.jsx("strong",{className:"micro",children:s})]})}function xe({diagnostico:a,resultado:s,guardando:o,onGuardar:l,onEnviar:n,onElegirLinea:k,onGenerarPdf:m}){const N=(s==null?void 0:s.linea_elegida)??a.linea;return e.jsxs("section",{className:"diag-seccion",children:[e.jsx("h2",{className:"h4",style:{marginTop:0},children:"Revisión"}),e.jsxs("div",{className:"tablero",children:[e.jsxs("div",{className:a.globalScore>=80?"ok":a.globalScore>=50?"alerta":"critico",children:[e.jsxs("p",{className:"n",children:[a.globalScore,"%"]}),e.jsx("p",{className:"r",children:"Puntaje global"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"n",children:a.nivel}),e.jsx("p",{className:"r",children:"Nivel"})]}),e.jsxs("div",{className:a.hasCritFail?"critico":"",children:[e.jsx("p",{className:"n",children:a.hallazgosCriticos.length}),e.jsx("p",{className:"r",children:"Hallazgos críticos"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"n",children:a.areasBajo60.length}),e.jsx("p",{className:"r",children:"Áreas bajo 60%"})]})]}),a.hallazgosCriticos.length>0&&e.jsxs("div",{className:"diag-seccion",style:{marginTop:0},children:[e.jsx("h3",{className:"h4",children:"Hallazgos críticos"}),e.jsx("div",{className:"diag-lista",children:a.hallazgosCriticos.map((r,x)=>e.jsxs("div",{className:"tarjeta diag-item",style:{padding:12},children:[e.jsx("span",{className:"micro apagado",children:r.area}),e.jsx("p",{className:"micro",style:{margin:"2px 0 0"},children:r.texto})]},x))})]}),e.jsxs("div",{className:"diag-seccion",style:{marginTop:0},children:[e.jsx("h3",{className:"h4",children:"Línea sugerida"}),e.jsx("div",{className:"diag-lineas",children:Object.entries(pe).map(([r,x])=>e.jsxs("button",{type:"button",className:"tarjeta diag-linea"+(N===r?" seleccionada":"")+(a.linea===r?" sugerida":""),onClick:()=>k(r),disabled:!s,children:[e.jsxs("strong",{className:"micro",children:[x.label,a.linea===r?" — sugerida":""]}),e.jsx("span",{className:"micro apagado",children:x.desc})]},r))}),!s&&e.jsx("p",{className:"micro apagado",style:{marginTop:8},children:"Guarda el diagnóstico para poder elegir la línea."})]}),e.jsxs("div",{className:"fila-botones",children:[e.jsx("button",{type:"button",className:"boton boton-secundario",onClick:l,disabled:o,children:"Guardar avance"}),e.jsx("button",{type:"button",className:"boton",onClick:n,disabled:o,children:"Guardar y enviar"})]}),s&&e.jsx("button",{type:"button",className:"boton boton-texto",style:{marginTop:10},onClick:m,children:"Generar PDF del informe"})]})}export{ye as default};
