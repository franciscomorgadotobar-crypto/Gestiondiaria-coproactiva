import{u as ue,b as ge,r as z,j as e,s as _,d as ve}from"./index-B6NChBeE.js";function $(a){return String(a??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}const Q=a=>a==null?{fondo:"var(--niebla)",borde:"var(--pizarra)",texto:"var(--pizarra)",etiqueta:"No aplica"}:a>=70?{fondo:"var(--ok-fondo)",borde:"var(--ok-borde)",texto:"var(--ok-texto)",etiqueta:"Bien"}:a>=40?{fondo:"var(--alerta-fondo)",borde:"var(--alerta-borde)",texto:"var(--alerta-texto)",etiqueta:"En riesgo"}:{fondo:"var(--critico-fondo)",borde:"var(--critico-borde)",texto:"var(--critico-texto)",etiqueta:"Crítico"},ee={L1:{label:"Administración integral",desc:"La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes.",items:["Recepción y auditoría documental completa","Gestión financiera con rendiciones mensuales al comité","Coordinación de proveedores y mantención preventiva","Plataforma digital para cobro y comunicación","Informes de gestión mensuales con indicadores clave"],valMin:"600.000",valMax:"900.000"},L2:{label:"Nueva administración",desc:"La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión.",items:["Levantamiento del estado administrativo y financiero actual","Regularización legal, laboral y documental prioritaria","Implementación de plataforma de gestión y control de morosidad","Coordinación de equipamiento crítico y mantención preventiva","Informes periódicos al comité con plan de avance"],valMin:"800.000",valMax:"1.100.000"},L3:{label:"Asesoría externa",desc:"Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente.",items:["Auditoría documental con informe de hallazgos","Asesoría legal y normativa sobre Ley 21.442","Orientación para regularización laboral y previsional","Plan de acción priorizado por nivel de riesgo","Acompañamiento al comité en la toma de decisiones"],valMin:"300.000",valMax:"500.000"}},fe=`
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
`;function ae(a,s,o,r){const l=new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"});return`<div class="cab">
    ${`<img src="${$(r)}" alt="CoproActiva">`}
    <div class="pag">Pág. ${a} / ${s}</div>
    <h1>Informe de diagnóstico inicial</h1>
    <p class="sub">Diagnóstico preliminar de riesgo y propuesta de administración</p>
    <dl class="ficha">
      <div><dt>Condominio</dt><dd>${$(o.nombre_condominio||"—")}</dd></div>
      <div><dt>Fecha</dt><dd>${l}</dd></div>
      <div><dt>Comuna</dt><dd>${$(o.comuna||"—")}${o.unidades?` · ${o.unidades} unid.`:""}</dd></div>
      <div><dt>Elaborado por</dt><dd>CoproActiva</dd></div>
    </dl>
    <div class="barra"></div>
  </div>`}function ie(a){return`<p class="pie">coproactiva · Comunidades que funcionan. — Documento confidencial — ${a}</p>`}function be(a){var h;const{prospecto:s,diagnostico:o,areas:r,notasAreas:l,lineaElegida:k,logo:f}=a,y=new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"}),d=ee[k]??ee.L2,b=Q(o.nivel==="Crítico"?10:o.nivel==="En riesgo"||o.globalScore>=80&&o.hallazgosCriticos.length?45:o.globalScore),m=[...r].filter(c=>c.pct!=null).sort((c,u)=>c.pct-u.pct),N={};for(const c of o.hallazgosCriticos)(N[h=c.area]??(N[h]=[])).push(c.texto);const q=`<div class="hoja">
    ${ae(1,2,s,f)}
    <div class="cuerpo">
      <div class="seccion-titulo">Resultado del diagnóstico</div>
      <div class="resultado" style="background:${b.fondo};border-color:${b.borde}">
        <div class="aro"><div class="n" style="color:${b.texto}">${o.globalScore}</div><div class="s">%</div></div>
        <div class="txt">
          <div class="nivel" style="color:${b.texto}">${$(o.nivel)}</div>
          <p style="color:${b.texto}">${he(o)}</p>
        </div>
      </div>

      <div class="seccion-titulo">Comparativo por área — de menor a mayor cumplimiento</div>
      ${m.map(c=>{const u=Q(c.pct);return`<div class="area-fila">
          <div class="nombre">${$(c.label)}</div>
          <div class="barra-fondo">
            <div class="barra-rellena" style="width:${c.pct}%;background:${u.borde}"></div>
            <span class="pct" style="${c.pct>20?"right:4mm;color:#fff":`left:${c.pct}%;margin-left:2mm;color:${u.texto}`}">${c.pct}%</span>
          </div>
          <div class="estado" style="background:${u.fondo};color:${u.texto}">${u.etiqueta}</div>
        </div>`}).join("")}

      <div class="seccion-titulo">Observaciones por área</div>
      <div class="obs-grid">
        ${r.map(c=>{const u=Q(c.pct),w=l==null?void 0:l[c.id];return`<div class="obs-tarjeta" style="border-left-color:${u.borde}">
            <div class="cab2">
              <span class="nombre">${$(c.label)}</span>
              ${c.pct!=null?`<span class="pct" style="color:${u.texto}">${c.pct}% · ${u.etiqueta}</span>`:""}
            </div>
            <div class="texto">${w?$(w):"<em>Sin observaciones registradas.</em>"}</div>
          </div>`}).join("")}
      </div>
    </div>
    ${ie(y)}
  </div>`,P=`<div class="hoja">
    ${ae(2,2,s,f)}
    <div class="cuerpo">
      ${o.hallazgosCriticos.length?`
        <div class="seccion-titulo">Ítems críticos faltantes · ${o.hallazgosCriticos.length} sin resolver</div>
        ${Object.entries(N).map(([c,u])=>`
          <div class="hallazgo-area">${$(c)}</div>
          ${u.map(w=>`<div class="hallazgo"><div class="x">×</div><div class="t">${$(w)}</div></div>`).join("")}
        `).join("")}
      `:""}

      <div class="seccion-titulo">Propuesta de servicio</div>
      <div class="propuesta">
        <div class="banda"><span>${$(d.label)}</span></div>
        <div class="contenido">
          <div class="desc">${$(d.desc)}</div>
          ${d.items.map(c=>`<div class="item"><div class="ok">OK</div><div class="txt">${$(c)}</div></div>`).join("")}
          <div class="valor">
            <div><div class="et">Valor mensual estimado del servicio</div><div class="sub">Sujeto a confirmación en reunión presencial</div></div>
            <div><div class="monto">$${d.valMin} – $${d.valMax}</div><div class="cur" style="text-align:right">CLP / mes</div></div>
          </div>
        </div>
      </div>

      <div class="seccion-titulo">Próximo paso</div>
      <div class="proximo">
        <div class="t">Próximo paso</div>
        <div class="d">CoproActiva los invita a una reunión de presentación con el comité, donde se revisará este diagnóstico en detalle y se confirmará el valor definitivo del servicio. Para coordinar fecha y hora, contáctenos a través de nuestros canales habituales.</div>
      </div>
    </div>
    ${ie(y)}
  </div>`;return`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Diagnóstico — ${$(s.nombre_condominio||"")}</title>
<style>${fe}</style>
</head>
<body>${q}${P}</body>
</html>`}function he(a){var s;if(a.nivel==="Estable")return"La comunidad presenta una gestión ordenada en todas las áreas. CoproActiva puede optimizarla de manera continua.";if(a.nivel==="Estable con observaciones"){const o=[];return(s=a.areasBajo60)!=null&&s.length&&o.push("focos de riesgo en: "+a.areasBajo60.map(r=>{var l;return((l=r.area)==null?void 0:l.label)??r.label}).join(", ")),a.hasCritFail&&o.push(`${a.hallazgosCriticos.length} ítem(s) crítico(s) sin resolver`),`El puntaje global es satisfactorio, pero se identifican: ${o.join(" y ")}. Estos aspectos requieren atención aunque el resultado global sea positivo.`}return a.nivel==="En riesgo"?"Existen aspectos que requieren intervención moderada o incumplimientos en ítems críticos. Sin acción oportuna pueden derivar en problemas administrativos, legales o financieros de mayor envergadura.":"Se detectan deficiencias graves en una o más áreas. Se requiere intervención urgente para evitar consecuencias legales y financieras significativas."}const A=[{id:"legal",label:"Legal"},{id:"financiero",label:"Financiero"},{id:"laboral",label:"Laboral",condArea:"trabajadores"},{id:"tecnico",label:"Técnico"},{id:"seguridad",label:"Seguridad"},{id:"documental",label:"Documental"}],oe={3:"Crítico",2:"Importante",1:"Básico"},xe=[{valor:0,etiqueta:"No cumple",clase:"critico"},{valor:.25,etiqueta:"No sabe",clase:"neutro"},{valor:.5,etiqueta:"Parcial",clase:"observacion"},{valor:1,etiqueta:"Cumple",clase:"cumple"}],je={L1:{label:"Administración integral",desc:"La comunidad tiene base. CoproActiva asume la administración completa y optimiza los procesos existentes."},L2:{label:"Nueva administración",desc:"La comunidad necesita restructuración. CoproActiva ordena cada área desde cero y regulariza la gestión."},L3:{label:"Asesoría externa",desc:"Diagnóstico y orientación sin cambio de administración. Apoyo técnico al comité vigente."}};function ye(a,s,o){return a<40?"L3":a>=75&&s.length===0&&!o?"L1":"L2"}function _e({id:a}){const s=ue(),{perfil:o}=ge(),r=(o==null?void 0:o.rol)!=="superadmin",[l,k]=z.useState(null),[f,y]=z.useState(null),[d,b]=z.useState(null),[m,N]=z.useState({}),[q,P]=z.useState({}),[h,c]=z.useState(null),[u,w]=z.useState("contexto"),[Y,C]=z.useState(null),[te,L]=z.useState(!1);async function se(){var x;C(null);const{data:i,error:t}=await _.from("controles").select("*").eq("id",a).maybeSingle();if(t)return C(t.message);if(!i)return C("Este diagnóstico no existe o no tienes acceso.");if(!i.prospecto_id)return C("Este diagnóstico no está ligado a un prospecto del Pipeline.");k(i);const[n,p,j]=await Promise.all([i.prospecto_id?_.from("prospectos").select("*").eq("id",i.prospecto_id).maybeSingle():Promise.resolve({data:null,error:null}),_.from("control_items").select("*").eq("control_id",a).order("orden"),_.from("diagnosticos_resultado").select("*").eq("control_id",a).maybeSingle()]);if(p.error)return C(p.error.message);if(n.error||!n.data)return C("No tienes acceso al prospecto de este diagnóstico.");y(n.data),b(p.data??[]),c(j.data??null);const g={};for(const S of p.data??[])S.respuesta&&typeof S.respuesta=="object"&&"valor"in S.respuesta&&(g[S.id]=S.respuesta.valor);N(g),P(((x=j.data)==null?void 0:x.notas_areas)??{})}z.useEffect(()=>{se()},[a]);const I=z.useMemo(()=>{const i=new Map;for(const t of d??[])i.has(t.grupo)||i.set(t.grupo,[]),i.get(t.grupo).push(t);return i},[d]),ne=z.useMemo(()=>{var t;const i=new Map;for(const n of d??[]){const p=(t=n.config)==null?void 0:t.clave;p&&i.set(p,n)}return i},[d]),J=z.useMemo(()=>(d??[]).find(i=>i.grupo==="contexto"&&i.texto==="Trabajadores contratados"),[d]),T=J?Number(m[J.id]||0):0;function W(i){if(i==="trabajadores")return T>0;if(i==="menosDiez")return T>0&&T<10;if(i==="diezOMas")return T>=10;const t=ne.get(i);return t?!!m[t.id]:!1}function F(i){var n;const t=(n=i.config)==null?void 0:n.condicion;return!(t&&!W(t))}function O(i){return i.condArea?W(i.condArea):!0}function G(i){var g;if(!O(i))return null;const t=(I.get(i.id)??[]).filter(F);if(t.length===0)return null;let n=0,p=0,j=0;for(const x of t){const S=((g=x.config)==null?void 0:g.peso)??1;p+=S;const v=m[x.id];v!=null&&(n+=S*Number(v)),S===3&&(v===0||v===.25)&&(j+=1)}return p===0?null:{pct:Math.round(n/p*100),criticosFallidos:j,evaluados:t.filter(x=>m[x.id]!=null).length,total:t.length}}const E=z.useMemo(()=>{var S;const i=A.map(v=>({area:v,score:G(v)})).filter(v=>v.score),t=i.length?Math.round(i.reduce((v,R)=>v+R.score.pct,0)/i.length):0,n=[];for(const v of A)if(O(v))for(const R of(I.get(v.id)??[]).filter(F)){if((((S=R.config)==null?void 0:S.peso)??1)!==3)continue;const K=m[R.id];(K===0||K===.25)&&n.push({area:v.label,texto:R.texto,tipo:K===0?"no_cumple":"no_sabe"})}const p=n.length>0,j=i.filter(v=>v.score.pct<60),g=i.filter(v=>v.score.pct<40);let x;return t>=80&&j.length===0&&!p?x="Estable":t>=80?x="Estable con observaciones":t>=50?x="En riesgo":x="Crítico",{globalScore:t,hallazgosCriticos:n,hasCritFail:p,areasBajo60:j,areasRed:g,nivel:x,linea:ye(t,g,p)}},[d,m]);function U(i,t){r||N(n=>({...n,[i]:n[i]===t?void 0:t}))}async function X(i){L(!0),C(null);const t=(d??[]).map(g=>({id:g.id,respuesta:{valor:m[g.id]??null},evaluado_en:m[g.id]!==void 0?new Date().toISOString():g.evaluado_en}));for(const g of t){const{error:x}=await _.from("control_items").update({respuesta:g.respuesta,evaluado_en:g.evaluado_en}).eq("id",g.id);if(x)return L(!1),C(x.message)}const n={control_id:a,score:E.globalScore,nivel:E.nivel,linea_sugerida:E.linea,linea_elegida:(h==null?void 0:h.linea_elegida)??E.linea,hallazgos_criticos:E.hallazgosCriticos,notas_areas:q},{data:p,error:j}=h?await _.from("diagnosticos_resultado").update(n).eq("control_id",a).select().single():await _.from("diagnosticos_resultado").insert(n).select().single();if(j||!p)return L(!1),C((j==null?void 0:j.message)||"No se pudo guardar el resultado.");if(c(p),i&&(l==null?void 0:l.estado)!=="enviado"){const{error:g}=await _.from("controles").update({estado:"enviado",enviado_en:new Date().toISOString()}).eq("id",a);if(g)return L(!1),C(g.message);k(x=>({...x,estado:"enviado",enviado_en:new Date().toISOString()}))}L(!1)}async function re(i){if(!h)return;L(!0);const{data:t,error:n}=await _.from("diagnosticos_resultado").update({linea_elegida:i}).eq("control_id",a).select().single();if(L(!1),n||!t)return C((n==null?void 0:n.message)||"No se pudo guardar la línea elegida.");c(t)}function le(){const i=(h==null?void 0:h.linea_elegida)??E.linea,t=A.map(p=>{var j;return{id:p.id,label:p.label,pct:((j=G(p))==null?void 0:j.pct)??null}}),n=be({prospecto:f,diagnostico:E,areas:t,notasAreas:q,lineaElegida:i,logo:"/cotizador-coproactiva/logo-coproactiva.svg"});ve(n)||C("El navegador bloqueó la ventana del informe. Permite las ventanas emergentes para este sitio.")}if(z.useEffect(()=>{var i;(i=document.querySelector(".pestanas .activo"))==null||i.scrollIntoView({block:"nearest",inline:"nearest"})},[u]),Y)return e.jsx("div",{className:"pantalla",children:e.jsx("div",{className:"cuerpo",children:e.jsx("div",{className:"aviso aviso-critico",children:Y})})});if(!l||!f||d===null)return e.jsx("p",{className:"cargando",children:"Cargando…"});const ce=I.get("contexto")??[],de=I.get("instalaciones")??[],M=["contexto","instalaciones",...A.map(i=>i.id),"revision"],B=M.indexOf(u),H=A.filter(O).flatMap(i=>(I.get(i.id)??[]).filter(F)),Z=H.filter(i=>m[i.id]!=null).length,me=H.length?Math.round(Z/H.length*100):0;function pe(i){const t=A.find(p=>p.id===i);if(!t||!O(t))return!1;const n=G(t);return!!(n&&n.evaluados===n.total)}return e.jsxs("div",{className:"pantalla pantalla-angosta",children:[e.jsxs("header",{className:"encabezado",children:[e.jsxs("div",{className:"fila",style:{marginBottom:8},children:[e.jsx("button",{className:"boton boton-texto",style:{padding:"4px 8px 4px 0"},onClick:()=>s(f.comunidad_id?`/comunidades/${f.comunidad_id}`:"/pipeline"),children:f.comunidad_id?"‹ Comunidad":"‹ Pipeline"}),e.jsx("span",{className:"crece"}),l.estado==="enviado"&&e.jsx("span",{className:"chip chip-cumple",children:"Enviado"})]}),e.jsx("h1",{className:"h3",children:f.nombre_condominio}),e.jsxs("p",{className:"chico apagado",style:{margin:"3px 0 12px"},children:["Diagnóstico comercial",f.comuna?` · ${f.comuna}`:""]}),e.jsxs("div",{className:"fila",style:{marginBottom:5},children:[e.jsx("span",{className:"etiqueta-campo crece",style:{margin:0},children:"Avance"}),e.jsxs("span",{className:"etiqueta-campo",style:{margin:0,color:"var(--texto-titulo)"},children:[Z," de ",H.length]})]}),e.jsx("div",{className:"barra",children:e.jsx("div",{style:{width:me+"%"}})})]}),e.jsxs("div",{className:"cuerpo",children:[l.estado==="enviado"&&e.jsx("div",{className:"aviso",style:{marginBottom:14},children:"Este diagnóstico ya fue enviado. Los cambios se siguen guardando si lo editas."}),e.jsx("nav",{className:"pestanas","aria-label":"Pasos del diagnóstico",children:M.map(i=>e.jsx("button",{type:"button",className:(i===u?"activo":"")+(pe(i)?" completo":""),"aria-current":i===u?"step":void 0,onClick:()=>w(i),children:Ne(i)},i))}),r&&e.jsx("div",{className:"aviso",style:{marginBottom:14},children:"Solo lectura: las respuestas y el resultado los registra un superadministrador."}),e.jsxs("fieldset",{className:"diag-campos",disabled:r,children:[u==="contexto"&&e.jsx(ze,{prospecto:f,items:ce,respuestas:m,onResponder:U}),u==="instalaciones"&&e.jsx(Ce,{items:de,respuestas:m,onResponder:U}),A.map(i=>u===i.id&&e.jsx(Se,{area:i,items:I.get(i.id)??[],respuestas:m,notas:q,setNotas:P,itemAplica:F,areaAplica:O,scoreArea:G,onResponder:U},i.id))]}),u==="revision"&&e.jsx(ke,{diagnostico:E,resultado:h,guardando:te,soloLectura:r,onGuardar:()=>X(!1),onEnviar:()=>X(!0),onElegirLinea:re,onGenerarPdf:le}),e.jsxs("nav",{className:"pasos","aria-label":`Paso ${B+1} de ${M.length}`,style:{marginTop:20},children:[e.jsx("button",{type:"button",className:"boton boton-secundario",disabled:B===0,onClick:()=>w(M[B-1]),children:"‹ Anterior"}),e.jsx("div",{className:"conteo",children:e.jsxs("span",{children:[B+1," de ",M.length]})}),e.jsx("button",{type:"button",className:"boton",style:B===M.length-1?{visibility:"hidden"}:void 0,onClick:()=>w(M[B+1]),children:"Siguiente ›"})]})]})]})}function Ne(a){var o;return{contexto:"Datos",instalaciones:"Instalaciones",revision:"Revisión"}[a]??((o=A.find(r=>r.id===a))==null?void 0:o.label)??a}function D({children:a,extra:s}){return e.jsxs("div",{className:"fila",style:{marginBottom:10},children:[e.jsx("h2",{className:"etiqueta-grupo crece",style:{margin:0},children:a}),s]})}function ze({prospecto:a,items:s,respuestas:o,onResponder:r}){return e.jsxs("section",{className:"diag-seccion",children:[e.jsx(D,{children:"Datos de la comunidad"}),e.jsxs("div",{className:"tarjeta diag-prospecto",children:[e.jsx("p",{className:"micro",style:{margin:0},children:"Estos datos vienen del prospecto y se editan desde el Pipeline."}),e.jsxs("div",{className:"diag-datos-prospecto",children:[e.jsx(V,{etiqueta:"Condominio",valor:a.nombre_condominio}),e.jsx(V,{etiqueta:"Dirección",valor:[a.direccion,a.comuna].filter(Boolean).join(", ")||"—"}),e.jsx(V,{etiqueta:"Unidades",valor:a.unidades??"—"}),e.jsx(V,{etiqueta:"Contacto",valor:a.nombre_contacto?`${a.nombre_contacto}${a.cargo_contacto?" · "+a.cargo_contacto:""}`:"—"})]})]}),e.jsx("div",{className:"diag-lista diag-lista-doble",children:s.map(l=>e.jsx($e,{item:l,valor:o[l.id],onResponder:r},l.id))})]})}function $e({item:a,valor:s,onResponder:o}){var r,l,k,f;if(a.tipo_ingreso==="seleccion"){const y=((r=a.config)==null?void 0:r.opciones)??[];return e.jsxs("div",{className:"campo",children:[e.jsx("label",{className:"etiqueta-campo",htmlFor:"diag-"+a.id,children:a.texto}),e.jsxs("select",{id:"diag-"+a.id,value:s??"",onChange:d=>o(a.id,d.target.value||void 0),children:[e.jsx("option",{value:"",children:"Sin definir"}),y.map(d=>e.jsx("option",{value:d.valor,children:d.etiqueta},d.valor))]})]})}return a.tipo_ingreso==="numero"?e.jsxs("div",{className:"campo",children:[e.jsx("label",{className:"etiqueta-campo",htmlFor:"diag-"+a.id,children:a.texto}),e.jsxs("div",{className:"campo-medida",children:[e.jsx("input",{id:"diag-"+a.id,type:"number",inputMode:"numeric",min:((l=a.config)==null?void 0:l.min)??0,value:s??"",placeholder:"0",onChange:y=>o(a.id,y.target.value===""?void 0:Number(y.target.value))}),((k=a.config)==null?void 0:k.unidad)&&e.jsx("span",{className:"unidad",children:a.config.unidad})]}),((f=a.config)==null?void 0:f.hint)&&e.jsx("span",{className:"micro",children:a.config.hint})]}):e.jsxs("label",{className:"marca diag-marca"+(s?" activa":""),children:[e.jsx("input",{type:"checkbox",checked:!!s,onChange:y=>o(a.id,y.target.checked)}),e.jsx("span",{children:a.texto})]})}function Ce({items:a,respuestas:s,onResponder:o}){return e.jsxs("section",{className:"diag-seccion",children:[e.jsx(D,{children:"Instalaciones y equipamiento"}),e.jsx("p",{className:"micro",style:{margin:"-4px 0 10px"},children:"Marca lo que tiene el edificio: define qué puntos aplican en el diagnóstico."}),e.jsx("div",{className:"tarjeta lista-marcas diag-marcas",children:a.map(r=>e.jsxs("label",{className:"marca"+(s[r.id]?" activa":""),children:[e.jsx("input",{type:"checkbox",checked:!!s[r.id],onChange:l=>o(r.id,l.target.checked)}),e.jsx("span",{children:r.texto})]},r.id))})]})}function Se({area:a,items:s,respuestas:o,notas:r,setNotas:l,itemAplica:k,areaAplica:f,scoreArea:y,onResponder:d}){const b=f(a),m=y(a);return b?e.jsxs("section",{className:"diag-seccion",children:[e.jsx(D,{extra:m&&e.jsxs("span",{className:"chip",children:[m.pct,"% · ",m.evaluados," de ",m.total]}),children:a.label}),e.jsx("div",{className:"diag-lista",children:s.filter(k).map(N=>{var P;const q=(P=N.config)==null?void 0:P.peso;return e.jsxs("article",{className:"tarjeta punto",children:[e.jsxs("div",{className:"fila",style:{alignItems:"flex-start",gap:10,marginBottom:12},children:[e.jsx("p",{className:"crece",style:{margin:0},children:N.texto}),oe[q]&&e.jsx("span",{className:"chip"+(q===3?" chip-critico":""),children:oe[q]})]}),e.jsx("div",{className:"selector",children:xe.map(h=>e.jsx("button",{type:"button",className:h.clase,"aria-pressed":o[N.id]===h.valor,onClick:()=>d(N.id,h.valor),children:h.etiqueta},h.valor))})]},N.id)})}),e.jsxs("div",{className:"campo",style:{marginTop:14},children:[e.jsx("label",{className:"etiqueta-campo",htmlFor:"notas-"+a.id,children:"Observaciones del área"}),e.jsx("textarea",{id:"notas-"+a.id,value:r[a.id]??"",onChange:N=>l(q=>({...q,[a.id]:N.target.value}))})]})]}):e.jsxs("section",{className:"diag-seccion",children:[e.jsx(D,{children:a.label}),e.jsxs("div",{className:"vacio",children:["Esta comunidad no tiene personal contratado, por lo que el área ",a.label," no se evalúa."]})]})}function V({etiqueta:a,valor:s}){return e.jsxs("div",{children:[e.jsx("span",{className:"etiqueta-campo",children:a}),e.jsx("span",{className:"chico diag-dato",children:s})]})}function ke({diagnostico:a,resultado:s,guardando:o,soloLectura:r,onGuardar:l,onEnviar:k,onElegirLinea:f,onGenerarPdf:y}){const d=(s==null?void 0:s.linea_elegida)??a.linea;return e.jsxs("section",{className:"diag-seccion",children:[e.jsx(D,{children:"Resultado"}),e.jsxs("div",{className:"tablero diag-tablero",children:[e.jsxs("div",{className:a.globalScore>=80?"ok":a.globalScore>=50?"alerta":"critico",children:[e.jsxs("p",{className:"n",children:[a.globalScore,"%"]}),e.jsx("p",{className:"r",children:"Puntaje global"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"n texto",children:a.nivel}),e.jsx("p",{className:"r",children:"Nivel"})]}),e.jsxs("div",{className:a.hasCritFail?"critico":"",children:[e.jsx("p",{className:"n",children:a.hallazgosCriticos.length}),e.jsx("p",{className:"r",children:"Hallazgos críticos"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"n",children:a.areasBajo60.length}),e.jsx("p",{className:"r",children:"Áreas bajo 60%"})]})]}),a.hallazgosCriticos.length>0&&e.jsxs("div",{className:"diag-bloque",children:[e.jsx(D,{children:"Hallazgos críticos"}),e.jsx("div",{className:"diag-lista",children:a.hallazgosCriticos.map((b,m)=>e.jsxs("div",{className:"tarjeta punto",children:[e.jsxs("div",{className:"fila",style:{marginBottom:6},children:[e.jsx("span",{className:"etiqueta-campo crece",style:{margin:0},children:b.area}),e.jsx("span",{className:"chip"+(b.tipo==="no_cumple"?" chip-critico":""),children:b.tipo==="no_cumple"?"No cumple":"No sabe"})]}),e.jsx("p",{className:"chico",style:{margin:0},children:b.texto})]},m))})]}),e.jsxs("div",{className:"diag-bloque",children:[e.jsx(D,{children:"Línea de servicio"}),e.jsx("div",{className:"diag-lineas",children:Object.entries(je).map(([b,m])=>e.jsxs("button",{type:"button",className:"tarjeta diag-linea","aria-pressed":d===b,onClick:()=>f(b),disabled:!s||r,children:[e.jsxs("span",{className:"fila",style:{gap:8},children:[e.jsx("span",{className:"dato-chico crece",children:m.label}),a.linea===b&&e.jsx("span",{className:"chip chip-pendiente",children:"Sugerida"})]}),e.jsx("span",{className:"micro",children:m.desc})]},b))}),!s&&!r&&e.jsx("p",{className:"micro",style:{margin:"8px 0 0"},children:"Guarda el diagnóstico para poder elegir la línea."})]}),!r&&e.jsxs("div",{className:"fila-botones",style:{marginTop:20},children:[e.jsx("button",{type:"button",className:"boton boton-secundario boton-movil crece",onClick:l,disabled:o,children:"Guardar avance"}),e.jsx("button",{type:"button",className:"boton boton-movil crece",onClick:k,disabled:o,children:"Guardar y enviar"})]}),s&&e.jsx("button",{type:"button",className:"boton boton-secundario boton-movil boton-ancho",style:{marginTop:8},onClick:y,children:"Ver informe / Guardar PDF"})]})}export{_e as default};
