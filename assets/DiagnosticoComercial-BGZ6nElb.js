import{u as me,r as $,j as e,s as w,d as pe}from"./index-9eJurJw6.js";function C(a){return String(a??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}const K=a=>a==null?{fondo:"var(--niebla)",borde:"var(--pizarra)",texto:"var(--pizarra)",etiqueta:"No aplica"}:a>=70?{fondo:"var(--ok-fondo)",borde:"var(--ok-borde)",texto:"var(--ok-texto)",etiqueta:"Bien"}:a>=40?{fondo:"var(--alerta-fondo)",borde:"var(--alerta-borde)",texto:"var(--alerta-texto)",etiqueta:"En riesgo"}:{fondo:"var(--critico-fondo)",borde:"var(--critico-borde)",texto:"var(--critico-texto)",etiqueta:"Crítico"},X={L1:{label:"Administración integral",desc:"La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes.",items:["Recepción y auditoría documental completa","Gestión financiera con rendiciones mensuales al comité","Coordinación de proveedores y mantención preventiva","Plataforma digital para cobro y comunicación","Informes de gestión mensuales con indicadores clave"],valMin:"600.000",valMax:"900.000"},L2:{label:"Nueva administración",desc:"La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión.",items:["Levantamiento del estado administrativo y financiero actual","Regularización legal, laboral y documental prioritaria","Implementación de plataforma de gestión y control de morosidad","Coordinación de equipamiento crítico y mantención preventiva","Informes periódicos al comité con plan de avance"],valMin:"800.000",valMax:"1.100.000"},L3:{label:"Asesoría externa",desc:"Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente.",items:["Auditoría documental con informe de hallazgos","Asesoría legal y normativa sobre Ley 21.442","Orientación para regularización laboral y previsional","Plan de acción priorizado por nivel de riesgo","Acompañamiento al comité en la toma de decisiones"],valMin:"300.000",valMax:"500.000"}},ue=`
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
`;function Z(a,s,o,c){const l=new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"});return`<div class="cab">
    ${`<img src="${C(c)}" alt="CoproActiva">`}
    <div class="pag">Pág. ${a} / ${s}</div>
    <h1>Informe de diagnóstico inicial</h1>
    <p class="sub">Diagnóstico preliminar de riesgo y propuesta de administración</p>
    <dl class="ficha">
      <div><dt>Condominio</dt><dd>${C(o.nombre_condominio||"—")}</dd></div>
      <div><dt>Fecha</dt><dd>${l}</dd></div>
      <div><dt>Comuna</dt><dd>${C(o.comuna||"—")}${o.unidades?` · ${o.unidades} unid.`:""}</dd></div>
      <div><dt>Elaborado por</dt><dd>CoproActiva</dd></div>
    </dl>
    <div class="barra"></div>
  </div>`}function ee(a){return`<p class="pie">coproactiva · Comunidades que funcionan. — Documento confidencial — ${a}</p>`}function ge(a){var b;const{prospecto:s,diagnostico:o,areas:c,notasAreas:l,lineaElegida:k,logo:g}=a,j=new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"}),n=X[k]??X.L2,y=K(o.nivel==="Crítico"?10:o.nivel==="En riesgo"||o.globalScore>=80&&o.hallazgosCriticos.length?45:o.globalScore),q=[...c].filter(d=>d.pct!=null).sort((d,h)=>d.pct-h.pct),N={};for(const d of o.hallazgosCriticos)(N[b=d.area]??(N[b]=[])).push(d.texto);const f=`<div class="hoja">
    ${Z(1,2,s,g)}
    <div class="cuerpo">
      <div class="seccion-titulo">Resultado del diagnóstico</div>
      <div class="resultado" style="background:${y.fondo};border-color:${y.borde}">
        <div class="aro"><div class="n" style="color:${y.texto}">${o.globalScore}</div><div class="s">%</div></div>
        <div class="txt">
          <div class="nivel" style="color:${y.texto}">${C(o.nivel)}</div>
          <p style="color:${y.texto}">${ve(o)}</p>
        </div>
      </div>

      <div class="seccion-titulo">Comparativo por área — de menor a mayor cumplimiento</div>
      ${q.map(d=>{const h=K(d.pct);return`<div class="area-fila">
          <div class="nombre">${C(d.label)}</div>
          <div class="barra-fondo">
            <div class="barra-rellena" style="width:${d.pct}%;background:${h.borde}"></div>
            <span class="pct" style="${d.pct>20?"right:4mm;color:#fff":`left:${d.pct}%;margin-left:2mm;color:${h.texto}`}">${d.pct}%</span>
          </div>
          <div class="estado" style="background:${h.fondo};color:${h.texto}">${h.etiqueta}</div>
        </div>`}).join("")}

      <div class="seccion-titulo">Observaciones por área</div>
      <div class="obs-grid">
        ${c.map(d=>{const h=K(d.pct),z=l==null?void 0:l[d.id];return`<div class="obs-tarjeta" style="border-left-color:${h.borde}">
            <div class="cab2">
              <span class="nombre">${C(d.label)}</span>
              ${d.pct!=null?`<span class="pct" style="color:${h.texto}">${d.pct}% · ${h.etiqueta}</span>`:""}
            </div>
            <div class="texto">${z?C(z):"<em>Sin observaciones registradas.</em>"}</div>
          </div>`}).join("")}
      </div>
    </div>
    ${ee(j)}
  </div>`,_=`<div class="hoja">
    ${Z(2,2,s,g)}
    <div class="cuerpo">
      ${o.hallazgosCriticos.length?`
        <div class="seccion-titulo">Ítems críticos faltantes · ${o.hallazgosCriticos.length} sin resolver</div>
        ${Object.entries(N).map(([d,h])=>`
          <div class="hallazgo-area">${C(d)}</div>
          ${h.map(z=>`<div class="hallazgo"><div class="x">×</div><div class="t">${C(z)}</div></div>`).join("")}
        `).join("")}
      `:""}

      <div class="seccion-titulo">Propuesta de servicio</div>
      <div class="propuesta">
        <div class="banda"><span>${C(n.label)}</span></div>
        <div class="contenido">
          <div class="desc">${C(n.desc)}</div>
          ${n.items.map(d=>`<div class="item"><div class="ok">OK</div><div class="txt">${C(d)}</div></div>`).join("")}
          <div class="valor">
            <div><div class="et">Valor mensual estimado del servicio</div><div class="sub">Sujeto a confirmación en reunión presencial</div></div>
            <div><div class="monto">$${n.valMin} – $${n.valMax}</div><div class="cur" style="text-align:right">CLP / mes</div></div>
          </div>
        </div>
      </div>

      <div class="seccion-titulo">Próximo paso</div>
      <div class="proximo">
        <div class="t">Próximo paso</div>
        <div class="d">CoproActiva los invita a una reunión de presentación con el comité, donde se revisará este diagnóstico en detalle y se confirmará el valor definitivo del servicio. Para coordinar fecha y hora, contáctenos a través de nuestros canales habituales.</div>
      </div>
    </div>
    ${ee(j)}
  </div>`;return`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Diagnóstico — ${C(s.nombre_condominio||"")}</title>
<style>${ue}</style>
</head>
<body>${f}${_}</body>
</html>`}function ve(a){var s;if(a.nivel==="Estable")return"La comunidad presenta una gestión ordenada en todas las áreas. CoproActiva puede optimizarla de manera continua.";if(a.nivel==="Estable con observaciones"){const o=[];return(s=a.areasBajo60)!=null&&s.length&&o.push("focos de riesgo en: "+a.areasBajo60.map(c=>{var l;return((l=c.area)==null?void 0:l.label)??c.label}).join(", ")),a.hasCritFail&&o.push(`${a.hallazgosCriticos.length} ítem(s) crítico(s) sin resolver`),`El puntaje global es satisfactorio, pero se identifican: ${o.join(" y ")}. Estos aspectos requieren atención aunque el resultado global sea positivo.`}return a.nivel==="En riesgo"?"Existen aspectos que requieren intervención moderada o incumplimientos en ítems críticos. Sin acción oportuna pueden derivar en problemas administrativos, legales o financieros de mayor envergadura.":"Se detectan deficiencias graves en una o más áreas. Se requiere intervención urgente para evitar consecuencias legales y financieras significativas."}const A=[{id:"legal",label:"Legal"},{id:"financiero",label:"Financiero"},{id:"laboral",label:"Laboral",condArea:"trabajadores"},{id:"tecnico",label:"Técnico"},{id:"seguridad",label:"Seguridad"},{id:"documental",label:"Documental"}],ae={3:"Crítico",2:"Importante",1:"Básico"},fe=[{valor:0,etiqueta:"No cumple",clase:"critico"},{valor:.25,etiqueta:"No sabe",clase:"neutro"},{valor:.5,etiqueta:"Parcial",clase:"observacion"},{valor:1,etiqueta:"Cumple",clase:"cumple"}],be={L1:{label:"Administración integral",desc:"La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes."},L2:{label:"Nueva administración",desc:"La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión."},L3:{label:"Asesoría externa",desc:"Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente."}};function he(a,s,o){return a<40?"L3":a>=75&&s.length===0&&!o?"L1":"L2"}function Se({id:a}){const s=me(),[o,c]=$.useState(null),[l,k]=$.useState(null),[g,j]=$.useState(null),[n,y]=$.useState({}),[q,N]=$.useState({}),[f,_]=$.useState(null),[b,d]=$.useState("contexto"),[h,z]=$.useState(null),[ie,L]=$.useState(!1);async function oe(){var v;z(null);const{data:i,error:t}=await w.from("controles").select("*").eq("id",a).maybeSingle();if(t)return z(t.message);if(!i)return z("Este diagnóstico no existe o no tienes acceso.");c(i);const[r,m,x]=await Promise.all([i.prospecto_id?w.from("prospectos").select("*").eq("id",i.prospecto_id).maybeSingle():Promise.resolve({data:null,error:null}),w.from("control_items").select("*").eq("control_id",a).order("orden"),w.from("diagnosticos_resultado").select("*").eq("control_id",a).maybeSingle()]);if(m.error)return z(m.error.message);k(r.data??null),j(m.data??[]),_(x.data??null);const p={};for(const S of m.data??[])S.respuesta&&typeof S.respuesta=="object"&&"valor"in S.respuesta&&(p[S.id]=S.respuesta.valor);y(p),N(((v=x.data)==null?void 0:v.notas_areas)??{})}$.useEffect(()=>{oe()},[a]);const D=$.useMemo(()=>{const i=new Map;for(const t of g??[])i.has(t.grupo)||i.set(t.grupo,[]),i.get(t.grupo).push(t);return i},[g]),te=$.useMemo(()=>{var t;const i=new Map;for(const r of g??[]){const m=(t=r.config)==null?void 0:t.clave;m&&i.set(m,r)}return i},[g]),Q=$.useMemo(()=>(g??[]).find(i=>i.grupo==="contexto"&&i.texto==="Trabajadores contratados"),[g]),R=Q?Number(n[Q.id]||0):0;function Y(i){if(i==="trabajadores")return R>0;if(i==="menosDiez")return R>0&&R<10;if(i==="diezOMas")return R>=10;const t=te.get(i);return t?!!n[t.id]:!1}function T(i){var r;const t=(r=i.config)==null?void 0:r.condicion;return!(t&&!Y(t))}function B(i){return i.condArea?Y(i.condArea):!0}function F(i){var p;if(!B(i))return null;const t=(D.get(i.id)??[]).filter(T);if(t.length===0)return null;let r=0,m=0,x=0;for(const v of t){const S=((p=v.config)==null?void 0:p.peso)??1;m+=S;const u=n[v.id];u!=null&&(r+=S*Number(u)),S===3&&(u===0||u===.25)&&(x+=1)}return m===0?null:{pct:Math.round(r/m*100),criticosFallidos:x,evaluados:t.filter(v=>n[v.id]!=null).length,total:t.length}}const E=$.useMemo(()=>{var S;const i=A.map(u=>({area:u,score:F(u)})).filter(u=>u.score),t=i.length?Math.round(i.reduce((u,O)=>u+O.score.pct,0)/i.length):0,r=[];for(const u of A)if(B(u))for(const O of(D.get(u.id)??[]).filter(T)){if((((S=O.config)==null?void 0:S.peso)??1)!==3)continue;const U=n[O.id];(U===0||U===.25)&&r.push({area:u.label,texto:O.texto,tipo:U===0?"no_cumple":"no_sabe"})}const m=r.length>0,x=i.filter(u=>u.score.pct<60),p=i.filter(u=>u.score.pct<40);let v;return t>=80&&x.length===0&&!m?v="Estable":t>=80?v="Estable con observaciones":t>=50?v="En riesgo":v="Crítico",{globalScore:t,hallazgosCriticos:r,hasCritFail:m,areasBajo60:x,areasRed:p,nivel:v,linea:he(t,p,m)}},[g,n]);function V(i,t){y(r=>({...r,[i]:r[i]===t?void 0:t}))}async function J(i){L(!0),z(null);const t=(g??[]).map(p=>({id:p.id,respuesta:{valor:n[p.id]??null},evaluado_en:n[p.id]!==void 0?new Date().toISOString():p.evaluado_en}));for(const p of t){const{error:v}=await w.from("control_items").update({respuesta:p.respuesta,evaluado_en:p.evaluado_en}).eq("id",p.id);if(v)return L(!1),z(v.message)}const r={control_id:a,score:E.globalScore,nivel:E.nivel,linea_sugerida:E.linea,linea_elegida:(f==null?void 0:f.linea_elegida)??E.linea,hallazgos_criticos:E.hallazgosCriticos,notas_areas:q},{data:m,error:x}=f?await w.from("diagnosticos_resultado").update(r).eq("control_id",a).select().single():await w.from("diagnosticos_resultado").insert(r).select().single();if(x||!m)return L(!1),z((x==null?void 0:x.message)||"No se pudo guardar el resultado.");if(_(m),i&&(o==null?void 0:o.estado)!=="enviado"){const{error:p}=await w.from("controles").update({estado:"enviado",enviado_en:new Date().toISOString()}).eq("id",a);if(p)return L(!1),z(p.message);c(v=>({...v,estado:"enviado",enviado_en:new Date().toISOString()}))}L(!1)}async function se(i){if(!f)return;L(!0);const{data:t,error:r}=await w.from("diagnosticos_resultado").update({linea_elegida:i}).eq("control_id",a).select().single();if(L(!1),r||!t)return z((r==null?void 0:r.message)||"No se pudo guardar la línea elegida.");_(t)}function ne(){const i=(f==null?void 0:f.linea_elegida)??E.linea,t=A.map(m=>{var x;return{id:m.id,label:m.label,pct:((x=F(m))==null?void 0:x.pct)??null}}),r=ge({prospecto:l,diagnostico:E,areas:t,notasAreas:q,lineaElegida:i,logo:"/cotizador-coproactiva/logo-coproactiva.svg"});pe(r)||z("El navegador bloqueó la ventana del informe. Permite las ventanas emergentes para este sitio.")}if($.useEffect(()=>{var i;(i=document.querySelector(".pestanas .activo"))==null||i.scrollIntoView({block:"nearest",inline:"nearest"})},[b]),h)return e.jsx("div",{className:"pantalla",children:e.jsx("div",{className:"cuerpo",children:e.jsx("div",{className:"aviso aviso-critico",children:h})})});if(!o||!l||g===null)return e.jsx("p",{className:"cargando",children:"Cargando…"});const re=D.get("contexto")??[],le=D.get("instalaciones")??[],P=["contexto","instalaciones",...A.map(i=>i.id),"revision"],I=P.indexOf(b),G=A.filter(B).flatMap(i=>(D.get(i.id)??[]).filter(T)),W=G.filter(i=>n[i.id]!=null).length,ce=G.length?Math.round(W/G.length*100):0;function de(i){const t=A.find(m=>m.id===i);if(!t||!B(t))return!1;const r=F(t);return!!(r&&r.evaluados===r.total)}return e.jsxs("div",{className:"pantalla pantalla-angosta",children:[e.jsxs("header",{className:"encabezado",children:[e.jsxs("div",{className:"fila",style:{marginBottom:8},children:[e.jsx("button",{className:"boton boton-texto",style:{padding:"4px 8px 4px 0"},onClick:()=>s("/pipeline"),children:"‹ Pipeline"}),e.jsx("span",{className:"crece"}),o.estado==="enviado"&&e.jsx("span",{className:"chip chip-cumple",children:"Enviado"})]}),e.jsx("h1",{className:"h3",children:l.nombre_condominio}),e.jsxs("p",{className:"chico apagado",style:{margin:"3px 0 12px"},children:["Diagnóstico comercial",l.comuna?` · ${l.comuna}`:""]}),e.jsxs("div",{className:"fila",style:{marginBottom:5},children:[e.jsx("span",{className:"etiqueta-campo crece",style:{margin:0},children:"Avance"}),e.jsxs("span",{className:"etiqueta-campo",style:{margin:0,color:"var(--texto-titulo)"},children:[W," de ",G.length]})]}),e.jsx("div",{className:"barra",children:e.jsx("div",{style:{width:ce+"%"}})})]}),e.jsxs("div",{className:"cuerpo",children:[o.estado==="enviado"&&e.jsx("div",{className:"aviso",style:{marginBottom:14},children:"Este diagnóstico ya fue enviado. Los cambios se siguen guardando si lo editas."}),e.jsx("nav",{className:"pestanas","aria-label":"Pasos del diagnóstico",children:P.map(i=>e.jsx("button",{type:"button",className:(i===b?"activo":"")+(de(i)?" completo":""),"aria-current":i===b?"step":void 0,onClick:()=>d(i),children:xe(i)},i))}),b==="contexto"&&e.jsx(je,{prospecto:l,items:re,respuestas:n,onResponder:V}),b==="instalaciones"&&e.jsx(Ne,{items:le,respuestas:n,onResponder:V}),A.map(i=>b===i.id&&e.jsx(ze,{area:i,items:D.get(i.id)??[],respuestas:n,notas:q,setNotas:N,itemAplica:T,areaAplica:B,scoreArea:F,onResponder:V},i.id)),b==="revision"&&e.jsx($e,{diagnostico:E,resultado:f,guardando:ie,onGuardar:()=>J(!1),onEnviar:()=>J(!0),onElegirLinea:se,onGenerarPdf:ne}),e.jsxs("nav",{className:"pasos","aria-label":`Paso ${I+1} de ${P.length}`,style:{marginTop:20},children:[e.jsx("button",{type:"button",className:"boton boton-secundario",disabled:I===0,onClick:()=>d(P[I-1]),children:"‹ Anterior"}),e.jsx("div",{className:"conteo",children:e.jsxs("span",{children:[I+1," de ",P.length]})}),e.jsx("button",{type:"button",className:"boton",style:I===P.length-1?{visibility:"hidden"}:void 0,onClick:()=>d(P[I+1]),children:"Siguiente ›"})]})]})]})}function xe(a){var o;return{contexto:"Datos",instalaciones:"Instalaciones",revision:"Revisión"}[a]??((o=A.find(c=>c.id===a))==null?void 0:o.label)??a}function M({children:a,extra:s}){return e.jsxs("div",{className:"fila",style:{marginBottom:10},children:[e.jsx("h2",{className:"etiqueta-grupo crece",style:{margin:0},children:a}),s]})}function je({prospecto:a,items:s,respuestas:o,onResponder:c}){return e.jsxs("section",{className:"diag-seccion",children:[e.jsx(M,{children:"Datos de la comunidad"}),e.jsxs("div",{className:"tarjeta diag-prospecto",children:[e.jsx("p",{className:"micro",style:{margin:0},children:"Estos datos vienen del prospecto y se editan desde el Pipeline."}),e.jsxs("div",{className:"diag-datos-prospecto",children:[e.jsx(H,{etiqueta:"Condominio",valor:a.nombre_condominio}),e.jsx(H,{etiqueta:"Dirección",valor:[a.direccion,a.comuna].filter(Boolean).join(", ")||"—"}),e.jsx(H,{etiqueta:"Unidades",valor:a.unidades??"—"}),e.jsx(H,{etiqueta:"Contacto",valor:a.nombre_contacto?`${a.nombre_contacto}${a.cargo_contacto?" · "+a.cargo_contacto:""}`:"—"})]})]}),e.jsx("div",{className:"diag-lista diag-lista-doble",children:s.map(l=>e.jsx(ye,{item:l,valor:o[l.id],onResponder:c},l.id))})]})}function ye({item:a,valor:s,onResponder:o}){var c,l,k,g;if(a.tipo_ingreso==="seleccion"){const j=((c=a.config)==null?void 0:c.opciones)??[];return e.jsxs("div",{className:"campo",children:[e.jsx("label",{className:"etiqueta-campo",htmlFor:"diag-"+a.id,children:a.texto}),e.jsxs("select",{id:"diag-"+a.id,value:s??"",onChange:n=>o(a.id,n.target.value||void 0),children:[e.jsx("option",{value:"",children:"Sin definir"}),j.map(n=>e.jsx("option",{value:n.valor,children:n.etiqueta},n.valor))]})]})}return a.tipo_ingreso==="numero"?e.jsxs("div",{className:"campo",children:[e.jsx("label",{className:"etiqueta-campo",htmlFor:"diag-"+a.id,children:a.texto}),e.jsxs("div",{className:"campo-medida",children:[e.jsx("input",{id:"diag-"+a.id,type:"number",inputMode:"numeric",min:((l=a.config)==null?void 0:l.min)??0,value:s??"",placeholder:"0",onChange:j=>o(a.id,j.target.value===""?void 0:Number(j.target.value))}),((k=a.config)==null?void 0:k.unidad)&&e.jsx("span",{className:"unidad",children:a.config.unidad})]}),((g=a.config)==null?void 0:g.hint)&&e.jsx("span",{className:"micro",children:a.config.hint})]}):e.jsxs("label",{className:"marca diag-marca"+(s?" activa":""),children:[e.jsx("input",{type:"checkbox",checked:!!s,onChange:j=>o(a.id,j.target.checked)}),e.jsx("span",{children:a.texto})]})}function Ne({items:a,respuestas:s,onResponder:o}){return e.jsxs("section",{className:"diag-seccion",children:[e.jsx(M,{children:"Instalaciones y equipamiento"}),e.jsx("p",{className:"micro",style:{margin:"-4px 0 10px"},children:"Marca lo que tiene el edificio: define qué puntos aplican en el diagnóstico."}),e.jsx("div",{className:"tarjeta lista-marcas diag-marcas",children:a.map(c=>e.jsxs("label",{className:"marca"+(s[c.id]?" activa":""),children:[e.jsx("input",{type:"checkbox",checked:!!s[c.id],onChange:l=>o(c.id,l.target.checked)}),e.jsx("span",{children:c.texto})]},c.id))})]})}function ze({area:a,items:s,respuestas:o,notas:c,setNotas:l,itemAplica:k,areaAplica:g,scoreArea:j,onResponder:n}){const y=g(a),q=j(a);return y?e.jsxs("section",{className:"diag-seccion",children:[e.jsx(M,{extra:q&&e.jsxs("span",{className:"chip",children:[q.pct,"% · ",q.evaluados," de ",q.total]}),children:a.label}),e.jsx("div",{className:"diag-lista",children:s.filter(k).map(N=>{var _;const f=(_=N.config)==null?void 0:_.peso;return e.jsxs("article",{className:"tarjeta punto",children:[e.jsxs("div",{className:"fila",style:{alignItems:"flex-start",gap:10,marginBottom:12},children:[e.jsx("p",{className:"crece",style:{margin:0},children:N.texto}),ae[f]&&e.jsx("span",{className:"chip"+(f===3?" chip-critico":""),children:ae[f]})]}),e.jsx("div",{className:"selector",children:fe.map(b=>e.jsx("button",{type:"button",className:b.clase,"aria-pressed":o[N.id]===b.valor,onClick:()=>n(N.id,b.valor),children:b.etiqueta},b.valor))})]},N.id)})}),e.jsxs("div",{className:"campo",style:{marginTop:14},children:[e.jsx("label",{className:"etiqueta-campo",htmlFor:"notas-"+a.id,children:"Observaciones del área"}),e.jsx("textarea",{id:"notas-"+a.id,value:c[a.id]??"",onChange:N=>l(f=>({...f,[a.id]:N.target.value}))})]})]}):e.jsxs("section",{className:"diag-seccion",children:[e.jsx(M,{children:a.label}),e.jsxs("div",{className:"vacio",children:["Esta comunidad no tiene personal contratado, por lo que el área ",a.label," no se evalúa."]})]})}function H({etiqueta:a,valor:s}){return e.jsxs("div",{children:[e.jsx("span",{className:"etiqueta-campo",children:a}),e.jsx("span",{className:"chico diag-dato",children:s})]})}function $e({diagnostico:a,resultado:s,guardando:o,onGuardar:c,onEnviar:l,onElegirLinea:k,onGenerarPdf:g}){const j=(s==null?void 0:s.linea_elegida)??a.linea;return e.jsxs("section",{className:"diag-seccion",children:[e.jsx(M,{children:"Resultado"}),e.jsxs("div",{className:"tablero diag-tablero",children:[e.jsxs("div",{className:a.globalScore>=80?"ok":a.globalScore>=50?"alerta":"critico",children:[e.jsxs("p",{className:"n",children:[a.globalScore,"%"]}),e.jsx("p",{className:"r",children:"Puntaje global"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"n texto",children:a.nivel}),e.jsx("p",{className:"r",children:"Nivel"})]}),e.jsxs("div",{className:a.hasCritFail?"critico":"",children:[e.jsx("p",{className:"n",children:a.hallazgosCriticos.length}),e.jsx("p",{className:"r",children:"Hallazgos críticos"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"n",children:a.areasBajo60.length}),e.jsx("p",{className:"r",children:"Áreas bajo 60%"})]})]}),a.hallazgosCriticos.length>0&&e.jsxs("div",{className:"diag-bloque",children:[e.jsx(M,{children:"Hallazgos críticos"}),e.jsx("div",{className:"diag-lista",children:a.hallazgosCriticos.map((n,y)=>e.jsxs("div",{className:"tarjeta punto",children:[e.jsxs("div",{className:"fila",style:{marginBottom:6},children:[e.jsx("span",{className:"etiqueta-campo crece",style:{margin:0},children:n.area}),e.jsx("span",{className:"chip"+(n.tipo==="no_cumple"?" chip-critico":""),children:n.tipo==="no_cumple"?"No cumple":"No sabe"})]}),e.jsx("p",{className:"chico",style:{margin:0},children:n.texto})]},y))})]}),e.jsxs("div",{className:"diag-bloque",children:[e.jsx(M,{children:"Línea de servicio"}),e.jsx("div",{className:"diag-lineas",children:Object.entries(be).map(([n,y])=>e.jsxs("button",{type:"button",className:"tarjeta diag-linea","aria-pressed":j===n,onClick:()=>k(n),disabled:!s,children:[e.jsxs("span",{className:"fila",style:{gap:8},children:[e.jsx("span",{className:"dato-chico crece",children:y.label}),a.linea===n&&e.jsx("span",{className:"chip chip-pendiente",children:"Sugerida"})]}),e.jsx("span",{className:"micro",children:y.desc})]},n))}),!s&&e.jsx("p",{className:"micro",style:{margin:"8px 0 0"},children:"Guarda el diagnóstico para poder elegir la línea."})]}),e.jsxs("div",{className:"fila-botones",style:{marginTop:20},children:[e.jsx("button",{type:"button",className:"boton boton-secundario boton-movil crece",onClick:c,disabled:o,children:"Guardar avance"}),e.jsx("button",{type:"button",className:"boton boton-movil crece",onClick:l,disabled:o,children:"Guardar y enviar"})]}),s&&e.jsx("button",{type:"button",className:"boton boton-secundario boton-movil boton-ancho",style:{marginTop:8},onClick:g,children:"Ver informe / Guardar PDF"})]})}export{Se as default};
