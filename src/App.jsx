import { useState, useEffect } from "react";
const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const MEALS = ["Desayuno","Comida","Cena"];
const CONDITIONS = ["Tensión alta","Hipotiroidismo","SIBO","Diabetes tipo 2","Celiaquía","Intolerancia lactosa","Alergia al gluten","Colesterol alto","Reflujo","Vegetariano","Vegano"];
const MENU_TYPES = [
  { id:"normal", label:"Menú equilibrado", icon:"◎", desc:"Variado y nutritivo" },
  { id:"infantil", label:"Menú infantil", icon:"★", desc:"Pensado para niños" },
  { id:"peso", label:"Perder peso", icon:"◈", desc:"Bajo en calorías" },
  { id:"antiinflamatorio", label:"Antiinflamatorio", icon:"◇", desc:"Reduce la inflamación" },
  { id:"deportivo", label:"Deportivo", icon:"▲", desc:"Alto en proteínas" },
  { id:"mediterraneo", label:"Mediterráneo", icon:"◉", desc:"Dieta mediterránea" },
  { id:"digestivo", label:"Digestivo suave", icon:"○", desc:"Fácil digestión" },
  { id:"personalizado", label:"Personalizado", icon:"✦", desc:"Escribe tu preferencia" },
];
const STORAGE_KEY = "imclermeals_v1";
const emptyMember = () => ({ name:"", conditions:[], extra:"", active:true });
const emptyMenu = () => { const m={}; DAYS.forEach(d=>{m[d]={};MEALS.forEach(ml=>{m[d][ml]="";})}); return m; };
function loadState() { try { const r=localStorage.getItem(STORAGE_KEY); if(r) return JSON.parse(r); } catch{} return null; }
function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch{} }
export default function App() {
  const [tab, setTab] = useState("menu");
  const [family, setFamily] = useState([{...emptyMember(), name:"Persona 1"}]);
  const [menu, setMenu] = useState(emptyMenu());
  const [shopping, setShopping] = useState({});
  const [recipes, setRecipes] = useState([]);
  const [guests, setGuests] = useState([]);
  const [checked, setChecked] = useState({});
  const [portions, setPortions] = useState(1);
  const [menuType, setMenuType] = useState("normal");
  const [customRequest, setCustomRequest] = useState("");
  const [showMenuConfig, setShowMenuConfig] = useState(true);
  const [loading, setLoading] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [guestDay, setGuestDay] = useState("Sábado");
  const [guestMeal, setGuestMeal] = useState("Comida");
  const [editingMember, setEditingMember] = useState(null);
  const [printPreview, setPrintPreview] = useState(null);
  const activeFamily = family.filter(m => m.active !== false);
  const hasMenu = DAYS.some(d => MEALS.some(m => menu[d]?.[m]));
  useEffect(() => {
    const s = loadState();
    if (s) {
      if (s.family) setFamily(s.family);
      if (s.menu) setMenu(s.menu);
      if (s.shopping) setShopping(s.shopping);
      if (s.recipes) setRecipes(s.recipes);
      if (s.guests) setGuests(s.guests);
      if (s.checked) setChecked(s.checked);
      if (s.portions) setPortions(s.portions);
      if (s.menuType) setMenuType(s.menuType);
    }
  }, []);
  useEffect(() => { saveState({ family, menu, shopping, recipes, guests, checked, portions, menuType }); }, [family, menu, shopping, recipes, guests, checked, portions, menuType]);
  useEffect(() => { setPortions(activeFamily.length || 1); }, [family]);
  async function callClaude(prompt, sys="Eres nutricionista experto. Responde en español.", temp=1) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system: sys, temperature: temp })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
    const text = d.content?.[0]?.text || "";
    if (!text) throw new Error("Respuesta vacía");
    return text;
  }
  function parseJSON(text) { return JSON.parse(text.trim().replace(/^```json|^```|```$/gm,"").trim()); }
  async function generateFullMenu() {
    if (!activeFamily.length) return alert("Activa al menos un miembro de la familia.");
    setLoading("menu");
    const typeLabel = MENU_TYPES.find(t=>t.id===menuType)?.label||menuType;
    const extra = menuType==="personalizado"&&customRequest?`Petición especial: "${customRequest}".`:`Tipo de menú: ${typeLabel}.`;
    const membersDetail = activeFamily.map(m=>`- ${m.name}: ${m.conditions.length?`PROHIBIDO: ${m.conditions.join(", ")}`:"sin restricciones"}${m.extra?`. Notas: ${m.extra}`:""}`).join("\n");
    const hasRestrictions = activeFamily.some(m=>m.conditions.length>0);
    const seed = Math.floor(Math.random()*99999);
    const p1 = `Eres nutricionista experto. Genera menú semanal NUEVO (id:${seed}) para ${activeFamily.length} persona(s). ${extra}\nPERFILES:\n${membersDetail}\n- Plato base apto para todos cuando sea posible.\n- Si no es apto para alguien, añade alternativa entre paréntesis.\n- Platos variados, específicos, diferentes cada vez.\nSOLO JSON sin backticks:\n{"Lunes":{"Desayuno":"...","Comida":"...","Cena":"..."},"Martes":{"Desayuno":"...","Comida":"...","Cena":"..."},"Miércoles":{"Desayuno":"...","Comida":"...","Cena":"..."},"Jueves":{"Desayuno":"...","Comida":"...","Cena":"..."},"Viernes":{"Desayuno":"...","Comida":"...","Cena":"..."},"Sábado":{"Desayuno":"...","Comida":"...","Cena":"..."},"Domingo":{"Desayuno":"...","Comida":"...","Cena":"..."}}`;
    try {
      const json1 = parseJSON(await callClaude(p1,"Responde SOLO con JSON válido, sin backticks ni texto."));
      let finalJson = json1;
      if (hasRestrictions) {
        setLoading("verify");
        const p2 = `Auditor nutricional: revisa este menú plato por plato.\nRESTRICCIONES:\n${membersDetail}\nGUÍA: Gluten(trigo,pan,pasta normal,cuscús), Lactosa(leche,queso,yogur,nata,mantequilla), SIBO(legumbres,cebolla,ajo,lácteos,gluten,fermentados), Tensión alta(sal exceso,embutidos), Hipotiroidismo(soja,col cruda,brócoli crudo), Diabetes(azúcar,harinas refinadas), Colesterol(grasas saturadas,embutidos,fritos)\nMENÚ: ${JSON.stringify(json1)}\nCorrige ingredientes prohibidos. SOLO JSON corregido sin backticks.`;
        finalJson = parseJSON(await callClaude(p2,"Responde SOLO con JSON válido corregido.",0.3));
      }
      const nm = emptyMenu();
      DAYS.forEach(d=>{if(finalJson[d])MEALS.forEach(m=>{if(finalJson[d][m])nm[d][m]=finalJson[d][m];});});
      setMenu(nm); setShowMenuConfig(false);
    } catch(e) { alert(`Error: ${e.message}`); }
    setLoading("");
  }
  async function generateShoppingList() {
    setLoading("shopping");
    const menuText = DAYS.map(d=>`${d}: ${MEALS.map(m=>menu[d][m]||"-").join(", ")}`).join("\n");
    try {
      const json = parseJSON(await callClaude(`Lista de la compra para ${portions} persona(s):\n${menuText}\nSolo JSON: {"Frutas y verduras":["..."],"Carnes y pescados":["..."],"Lácteos y huevos":["..."],"Legumbres y cereales":["..."],"Aceites y condimentos":["..."],"Otros":["..."]}`, "Responde SOLO con JSON válido."));
      setShopping(json); setChecked({});
    } catch(e) { alert(`Error: ${e.message}`); }
    setLoading("");
  }
  async function searchRecipes() {
    if (!recipeSearch.trim()) return;
    setLoading("recipes");
    const conds = [...new Set(activeFamily.flatMap(m=>m.conditions))];
    try {
      const json = parseJSON(await callClaude(`3 recetas de "${recipeSearch}"${conds.length?` aptas para: ${conds.join(", ")}`:""} para ${portions} personas. SOLO JSON: [{"nombre":"...","tiempo":"...","ingredientes":["..."],"pasos":["..."],"apta_para":["..."]}]`, "Responde SOLO con JSON válido."));
      setRecipes(json); setSelectedRecipe(null);
    } catch(e) { alert(`Error: ${e.message}`); }
    setLoading("");
  }
  async function generateGuestMenu() {
    if (!guests.length) return alert("Añade al menos un invitado.");
    setLoading("guest");
    const allC = [...new Set([...activeFamily.flatMap(m=>m.conditions),...guests.flatMap(g=>g.conditions)])];
    try {
      const json = parseJSON(await callClaude(`Menú especial ${guestMeal} del ${guestDay} para ${activeFamily.length+guests.length} personas. Condiciones: ${allC.join(", ")||"ninguna"}. Invitados: ${guests.map(g=>g.name+(g.conditions.length?` (${g.conditions.join(", ")})`:""  )).join("; ")}. SOLO JSON: {"entrante":"...","plato_principal":"...","postre":"...","bebida":"...","notas":"..."}`, "Responde SOLO con JSON válido."));
      const nm={...menu}; nm[guestDay]={...nm[guestDay],[guestMeal]:`✨ ${json.entrante} · ${json.plato_principal} · ${json.postre}`};
      setMenu(nm);
      alert(`Menú especial ${guestDay} - ${guestMeal}:\n\nEntrante: ${json.entrante}\nPrincipal: ${json.plato_principal}\nPostre: ${json.postre}\nBebida: ${json.bebida}\n\nNotas: ${json.notas}`);
    } catch(e) { alert(`Error: ${e.message}`); }
    setLoading("");
  }
  const addMember=()=>setFamily([...family,{...emptyMember(),name:`Persona ${family.length+1}`}]);
  const removeMember=i=>{if(!window.confirm("¿Eliminar este miembro?"))return;setFamily(family.filter((_,idx)=>idx!==i));};
  const updateMember=(i,f,v)=>{const a=[...family];a[i]={...a[i],[f]:v};setFamily(a);};
  const toggleCond=(i,c)=>{const a=[...family];a[i]={...a[i],conditions:a[i].conditions.includes(c)?a[i].conditions.filter(x=>x!==c):[...a[i].conditions,c]};setFamily(a);};
  const toggleActive=i=>{const a=[...family];a[i]={...a[i],active:a[i].active===false?true:false};setFamily(a);};
  const addGuest=()=>setGuests([...guests,{name:`Invitado ${guests.length+1}`,conditions:[]}]);
  const removeGuest=i=>setGuests(guests.filter((_,idx)=>idx!==i));
  const updateGuest=(i,f,v)=>{const a=[...guests];a[i]={...a[i],[f]:v};setGuests(a);};
  const toggleGuestCond=(i,c)=>{const a=[...guests];a[i]={...a[i],conditions:a[i].conditions.includes(c)?a[i].conditions.filter(x=>x!==c):[...a[i].conditions,c]};setGuests(a);};
  const toggleCheck=(cat,item)=>{const k=`${cat}||${item}`;setChecked(p=>({...p,[k]:!p[k]}));};
  const tabs=[{id:"menu",label:"Menú"},{id:"shopping",label:"Compra"},{id:"recipes",label:"Recetario"},{id:"profile",label:"Familia"},{id:"guests",label:"Invitados"}];
  return (
    <div style={{fontFamily:"var(--font-sans)",minHeight:"100vh",background:"var(--color-background-tertiary)"}}>
      <style>{`
        .np-header{background:var(--color-background-primary);border-bottom:0.5px solid var(--color-border-tertiary);padding:1rem 1.25rem .75rem;}
        .np-logo{display:flex;align-items:center;gap:10px;margin-bottom:.75rem;}
        .np-logo-icon{width:32px;height:32px;border-radius:10px;background:#1D9E75;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;flex-shrink:0;}
        .np-logo-title{font-size:18px;font-weight:500;color:var(--color-text-primary);margin:0;}
        .np-logo-sub{font-size:12px;color:var(--color-text-secondary);margin:0;}
        .np-tabs{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px;}
        .np-tab{padding:6px 14px;font-size:13px;border-radius:var(--border-radius-md);border:0.5px solid transparent;background:transparent;color:var(--color-text-secondary);cursor:pointer;white-space:nowrap;}
        .np-tab:hover{background:var(--color-background-secondary);}
        .np-tab.active{background:var(--color-background-secondary);border-color:var(--color-border-secondary);color:var(--color-text-primary);font-weight:500;}
        .np-body{padding:1.25rem;}
        .np-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:1rem 1.25rem;margin-bottom:12px;}
        .np-btn{padding:8px 16px;font-size:13px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:transparent;color:var(--color-text-primary);cursor:pointer;}
        .np-btn-primary{padding:8px 18px;font-size:13px;border-radius:var(--border-radius-md);border:none;background:#1D9E75;color:white;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:6px;}
        .np-btn-primary:hover{background:#0F6E56;}
        .np-btn-primary:disabled{background:#9FE1CB;cursor:not-allowed;}
        .np-btn-outline{padding:7px 14px;font-size:12px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;}
        .np-input{width:100%;font-size:13px;padding:7px 10px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);box-sizing:border-box;}
        .np-label{font-size:12px;color:var(--color-text-secondary);margin-bottom:4px;display:block;}
        .np-chip{display:inline-block;padding:3px 10px;font-size:11px;border-radius:20px;cursor:pointer;margin:3px 3px 0 0;}
        .np-chip.on{border:1px solid #1D9E75;background:#E1F5EE;color:#0F6E56;}
        .np-chip.off{border:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);color:var(--color-text-secondary);}
        .np-day-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;}
        .np-day-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden;}
        .np-day-head{background:#1D9E75;padding:8px 12px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:white;}
        .np-meal{padding:8px 12px;border-top:0.5px solid var(--color-border-tertiary);}
        .np-meal-lbl{font-size:10px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
        .np-meal-ta{width:100%;font-size:12px;padding:4px 6px;border-radius:6px;border:0.5px solid transparent;background:transparent;color:var(--color-text-primary);resize:none;min-height:42px;box-sizing:border-box;line-height:1.4;}
        .np-meal-ta:hover{border-color:var(--color-border-tertiary);background:var(--color-background-secondary);}
        .np-meal-ta:focus{outline:none;border-color:var(--color-border-secondary);background:var(--color-background-secondary);}
        .np-type-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:1rem;}
        .np-type-card{padding:10px 12px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary);cursor:pointer;background:var(--color-background-primary);}
        .np-type-card.active{border:1.5px solid #1D9E75;background:#E1F5EE;}
        .np-type-icon{font-size:18px;margin-bottom:4px;}
        .np-type-label{font-size:12px;font-weight:500;color:var(--color-text-primary);margin:0 0 2px;}
        .np-type-desc{font-size:10px;color:var(--color-text-secondary);margin:0;}
        .np-badge{font-size:11px;padding:2px 8px;border-radius:20px;background:#E1F5EE;color:#0F6E56;font-weight:500;display:inline-block;}
        .np-member-badge{font-size:11px;padding:3px 10px;border-radius:20px;background:#E1F5EE;color:#0F6E56;font-weight:500;display:inline-block;margin:2px;}
        .np-section{font-size:15px;font-weight:500;color:var(--color-text-primary);margin:1.25rem 0 .75rem;}
        .np-divider{height:0.5px;background:var(--color-border-tertiary);margin:1rem 0;}
        .np-recipe-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:1rem 1.25rem;margin-bottom:10px;cursor:pointer;}
        .np-check{width:18px;height:18px;border-radius:4px;border:1.5px solid var(--color-border-secondary);flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .np-check.done{background:#1D9E75;border-color:#1D9E75;}
        .loader{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .np-toggle{width:36px;height:20px;border-radius:10px;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
        .np-toggle-knob{width:16px;height:16px;border-radius:8px;background:white;position:absolute;top:2px;transition:left .2s;}
        .np-print-overlay{position:absolute;top:0;left:0;right:0;min-height:100%;background:white;z-index:100;padding:1.5rem;}
        .np-print-day-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
        .np-print-day{border:1px solid #e0f0e8;border-radius:6px;overflow:hidden;}
        .np-print-day-head{background:#1D9E75;padding:6px;text-align:center;font-size:.65rem;font-weight:700;text-transform:uppercase;color:white;}
        .np-print-meal{padding:7px 8px;border-top:1px solid #eef6f2;}
        .np-print-meal:nth-child(even){background:#fafffe;}
        .np-print-ml{font-size:.55rem;color:#1D9E75;text-transform:uppercase;margin-bottom:3px;font-weight:600;}
        .np-print-mt{font-size:.68rem;line-height:1.45;color:#333;}
        .np-print-alt{font-size:.62rem;color:#0F6E56;margin-top:3px;font-style:italic;padding-top:3px;border-top:1px dashed #c8e8dc;}
        .np-shop-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
        .np-shop-cat-title{background:#E1F5EE;color:#0F6E56;font-size:.75rem;font-weight:700;padding:4px 8px;border-radius:4px;margin-bottom:.4rem;}
        .np-shop-item{display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #f5f5f5;}
        .np-shop-box{width:13px;height:13px;border:1.5px solid #ccc;border-radius:3px;flex-shrink:0;}
        @media print{.np-header,.np-body{display:none!important;}.np-print-overlay{position:static!important;}.np-print-actions{display:none!important;}}
      `}</style>
      {printPreview && (
        <div className="np-print-overlay">
          <div style={{borderBottom:"2px solid #1D9E75",paddingBottom:".75rem",marginBottom:"1.25rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
              <div>
                <p style={{fontSize:"1.3rem",fontWeight:400,color:"#1D9E75",margin:0}}>ImCler Meals — {printPreview.type==="menu"?"Menú Semanal":"Lista de la Compra"}</p>
                <p style={{fontSize:".8rem",color:"#777",margin:".2rem 0 0"}}>{printPreview.type==="menu"?`${activeFamily.length} persona(s) · ${printPreview.typeLabel}`:`${portions} persona(s)`}</p>
              </div>
              <div className="np-print-actions" style={{display:"flex",gap:8}}>
                <button className="np-btn-primary" onClick={()=>window.print()}>Imprimir / PDF</button>
                <button className="np-btn" onClick={()=>setPrintPreview(null)}>← Volver</button>
              </div>
            </div>
            {printPreview.type==="menu"&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{activeFamily.map(m=><span key={m.name} className="np-member-badge">{m.name}{m.conditions.length>0?`: ${m.conditions.join(", ")}`:""}</span>)}</div>}
          </div>
          {printPreview.type==="menu"&&(
            <div className="np-print-day-grid">
              {DAYS.map(day=>(
                <div key={day} className="np-print-day">
                  <div className="np-print-day-head">{day}</div>
                  {MEALS.map(meal=>{
                    const txt=menu[day]?.[meal]||"—";
                    const hasAlt=txt.includes("(");
                    const base=hasAlt?txt.substring(0,txt.indexOf("(")).trim():txt;
                    const alt=hasAlt?txt.substring(txt.indexOf("(")):null;
                    return <div key={meal} className="np-print-meal"><div className="np-print-ml">{meal}</div><div className="np-print-mt">{base}</div>{alt&&<div className="np-print-alt">{alt}</div>}</div>;
                  })}
                </div>
              ))}
            </div>
          )}
          {printPreview.type==="shopping"&&(
            <div className="np-shop-grid">
              {Object.entries(shopping).map(([cat,items])=>(
                <div key={cat}><div className="np-shop-cat-title">{cat}</div>{items.map(item=><div key={item} className="np-shop-item"><div className="np-shop-box"/><span style={{fontSize:".78rem"}}>{item}</span></div>)}</div>
              ))}
            </div>
          )}
          <p style={{marginTop:"1rem",fontSize:".7rem",color:"#bbb",textAlign:"center"}}>ImCler Meals · Ctrl+P → Guardar como PDF</p>
        </div>
      )}
      <div className="np-header">
        <div className="np-logo">
          <div className="np-logo-icon">✦</div>
          <div><p className="np-logo-title">ImCler Meals</p><p className="np-logo-sub">Planificación inteligente de menús</p></div>
        </div>
        <div className="np-tabs">{tabs.map(t=><button key={t.id} className={`np-tab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      </div>
      <div className="np-body">
        {tab==="menu"&&(
          <>
            {showMenuConfig?(
              <div className="np-card">
                <p style={{fontSize:14,fontWeight:500,margin:"0 0 .75rem"}}>¿Qué tipo de menú quieres generar?</p>
                <div className="np-type-grid">{MENU_TYPES.map(t=><div key={t.id} className={`np-type-card${menuType===t.id?" active":""}`} onClick={()=>setMenuType(t.id)}><div className="np-type-icon">{t.icon}</div><p className="np-type-label">{t.label}</p><p className="np-type-desc">{t.desc}</p></div>)}</div>
                {menuType==="personalizado"&&<textarea className="np-input" style={{resize:"none",minHeight:64,marginBottom:10}} placeholder="Describe tu petición..." value={customRequest} onChange={e=>setCustomRequest(e.target.value)}/>}
                <div className="np-divider"/>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div><span style={{fontSize:13,color:"var(--color-text-secondary)"}}>{activeFamily.length} persona(s) activa(s)</span><div style={{display:"flex",flexWrap:"wrap",marginTop:4}}>{activeFamily.map(m=><span key={m.name} className="np-member-badge">{m.name}{m.conditions.length>0?`: ${m.conditions.join(", ")}`:""}</span>)}</div></div>
                  <button className="np-btn-primary" onClick={generateFullMenu} disabled={!!loading}>{loading==="menu"?<><span className="loader"/>Generando...</>:loading==="verify"?<><span className="loader"/>Verificando...</>:"Generar menú ↗"}</button>
                </div>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
                <div><span style={{fontSize:13,color:"var(--color-text-secondary)"}}>{MENU_TYPES.find(t=>t.id===menuType)?.label} · {activeFamily.length} activa(s)</span><div style={{display:"flex",flexWrap:"wrap",marginTop:4}}>{activeFamily.map(m=><span key={m.name} className="np-member-badge">{m.name}{m.conditions.length>0?`: ${m.conditions.join(", ")}`:""}</span>)}</div></div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="np-btn-outline" onClick={()=>setShowMenuConfig(true)}>Cambiar tipo</button>
                  {hasMenu&&<button className="np-btn-outline" onClick={()=>setPrintPreview({type:"menu",typeLabel:MENU_TYPES.find(t=>t.id===menuType)?.label||"Personalizado"})}>Vista previa</button>}
                  <button className="np-btn-primary" onClick={generateFullMenu} disabled={!!loading}>{loading==="menu"?<><span className="loader"/>Generando...</>:loading==="verify"?<><span className="loader"/>Verificando...</>:"Regenerar ↗"}</button>
                </div>
              </div>
            )}
            {(hasMenu||loading)&&(
              <div className="np-day-grid">
                {DAYS.map(day=>(
                  <div key={day} className="np-day-card">
                    <div className="np-day-head">{day}</div>
                    {MEALS.map(meal=>(
                      <div key={meal} className="np-meal">
                        <div className="np-meal-lbl">{meal}</div>
                        {loading?<div style={{fontSize:11,color:"var(--color-text-tertiary)",padding:"4px 0",minHeight:42}}>Generando...</div>:<textarea className="np-meal-ta" value={menu[day]?.[meal]||""} onChange={e=>{const m={...menu};m[day]={...m[day],[meal]:e.target.value};setMenu(m);}} placeholder="—"/>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {tab==="shopping"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>Personas:</span>
                <input type="number" min={1} max={20} value={portions} onChange={e=>setPortions(Number(e.target.value))} className="np-input" style={{width:64}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                {Object.keys(shopping).length>0&&<button className="np-btn-outline" onClick={()=>setPrintPreview({type:"shopping"})}>Vista previa</button>}
                <button className="np-btn-primary" onClick={generateShoppingList} disabled={!!loading}>{loading==="shopping"?<><span className="loader"/>Generando...</>:"Generar lista ↗"}</button>
              </div>
            </div>
            {!Object.keys(shopping).length&&<p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Genera primero el menú y luego pulsa "Generar lista".</p>}
            {Object.entries(shopping).map(([cat,items])=>{
              const doneCount=items.filter(item=>checked[`${cat}||${item}`]).length;
              return(
                <div key={cat} className="np-card">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:500}}>{cat}</span><span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{doneCount}/{items.length}</span></div>
                  {items.map(item=>{const k=`${cat}||${item}`;const done=checked[k];return(
                    <div key={item} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",cursor:"pointer"}} onClick={()=>toggleCheck(cat,item)}>
                      <div className={`np-check${done?" done":""}`}>{done&&<span style={{color:"white",fontSize:11}}>✓</span>}</div>
                      <span style={{fontSize:13,color:done?"var(--color-text-tertiary)":"var(--color-text-primary)",textDecoration:done?"line-through":"none"}}>{item}</span>
                    </div>
                  );})}
                </div>
              );
            })}
          </>
        )}
        {tab==="recipes"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input className="np-input" style={{flex:1}} placeholder="Busca una receta..." value={recipeSearch} onChange={e=>setRecipeSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchRecipes()}/>
              <button className="np-btn-primary" onClick={searchRecipes} disabled={!!loading}>{loading==="recipes"?<><span className="loader"/>Buscando...</>:"Buscar ↗"}</button>
            </div>
            {activeFamily.some(m=>m.conditions.length>0)&&<p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 1rem"}}>Adaptadas a: {[...new Set(activeFamily.flatMap(m=>m.conditions))].join(", ")}</p>}
            {selectedRecipe!==null&&recipes[selectedRecipe]?(
              <div className="np-card">
                <button className="np-btn" style={{fontSize:12,marginBottom:12}} onClick={()=>setSelectedRecipe(null)}>← Volver</button>
                <p style={{fontWeight:500,fontSize:16,margin:"0 0 4px"}}>{recipes[selectedRecipe].nombre}</p>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 10px"}}>Tiempo: {recipes[selectedRecipe].tiempo} · {portions} personas</p>
                {recipes[selectedRecipe].apta_para?.length>0&&<div style={{marginBottom:12}}>{recipes[selectedRecipe].apta_para.map(c=><span key={c} className="np-badge" style={{marginRight:4}}>{c}</span>)}</div>}
                <p style={{fontSize:13,fontWeight:500,margin:"0 0 6px"}}>Ingredientes</p>
                <ul style={{margin:"0 0 14px",paddingLeft:18}}>{recipes[selectedRecipe].ingredientes.map((ing,i)=><li key={i} style={{fontSize:13,marginBottom:3}}>{ing}</li>)}</ul>
                <p style={{fontSize:13,fontWeight:500,margin:"0 0 6px"}}>Preparación</p>
                <ol style={{margin:0,paddingLeft:18}}>{recipes[selectedRecipe].pasos.map((p,i)=><li key={i} style={{fontSize:13,marginBottom:8,lineHeight:1.6}}>{p}</li>)}</ol>
              </div>
            ):recipes.map((r,i)=>(
              <div key={i} className="np-recipe-card" onClick={()=>setSelectedRecipe(i)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,fontWeight:500}}>{r.nombre}</span><span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{r.tiempo}</span></div>
                <div style={{marginTop:6}}>{r.apta_para?.slice(0,4).map(c=><span key={c} className="np-badge" style={{marginRight:4,fontSize:10}}>{c}</span>)}</div>
              </div>
            ))}
          </>
        )}
        {tab==="profile"&&(
          <>
            <p className="np-section">Miembros de la familia</p>
            <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:12}}>Activa o desactiva cada semana. Los datos se guardan siempre.</p>
            {family.map((member,i)=>{
              const isActive=member.active!==false;
              const isEditing=editingMember===i;
              return(
                <div key={i} className="np-card" style={{opacity:isActive?1:0.6,border:isActive?"0.5px solid var(--color-border-tertiary)":"0.5px dashed var(--color-border-tertiary)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div className="np-toggle" style={{background:isActive?"#1D9E75":"var(--color-border-secondary)"}} onClick={()=>toggleActive(i)}><div className="np-toggle-knob" style={{left:isActive?18:2}}/></div>
                      <div><span style={{fontSize:14,fontWeight:500}}>{member.name||"Sin nombre"}</span>{!isEditing&&member.conditions.length>0&&<p style={{fontSize:11,color:"var(--color-text-secondary)",margin:"2px 0 0"}}>{member.conditions.join(", ")}</p>}<p style={{fontSize:11,color:isActive?"#1D9E75":"var(--color-text-tertiary)",margin:"1px 0 0"}}>{isActive?"Activo esta semana":"Inactivo esta semana"}</p></div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button className="np-btn" style={{padding:"5px 10px",fontSize:12}} onClick={()=>setEditingMember(isEditing?null:i)}>{isEditing?"Cerrar":"Editar"}</button>
                      <button className="np-btn" style={{padding:"5px 10px",fontSize:12,color:"var(--color-text-secondary)"}} onClick={()=>removeMember(i)}>✕</button>
                    </div>
                  </div>
                  {isEditing&&(
                    <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:10,marginTop:10}}>
                      <span className="np-label">Nombre</span>
                      <input className="np-input" style={{marginBottom:10}} value={member.name} onChange={e=>updateMember(i,"name",e.target.value)} placeholder="Nombre"/>
                      <span className="np-label">Condiciones / intolerancias</span>
                      <div style={{marginBottom:10}}>{CONDITIONS.map(c=><span key={c} className={`np-chip ${member.conditions.includes(c)?"on":"off"}`} onClick={()=>toggleCond(i,c)}>{c}</span>)}</div>
                      <span className="np-label">Notas adicionales</span>
                      <input className="np-input" value={member.extra||""} onChange={e=>updateMember(i,"extra",e.target.value)} placeholder="Otras alergias, preferencias..."/>
                    </div>
                  )}
                </div>
              );
            })}
            <button className="np-btn" onClick={addMember} style={{marginTop:4}}>+ Añadir persona</button>
          </>
        )}
        {tab==="guests"&&(
          <>
            <p className="np-section">Menú especial para invitados</p>
            <div className="np-card">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><span className="np-label">Día</span><select className="np-input" value={guestDay} onChange={e=>setGuestDay(e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
                <div><span className="np-label">Comida</span><select className="np-input" value={guestMeal} onChange={e=>setGuestMeal(e.target.value)}>{MEALS.map(m=><option key={m}>{m}</option>)}</select></div>
              </div>
            </div>
            <p className="np-section">Invitados</p>
            {guests.map((g,i)=>(
              <div key={i} className="np-card">
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <input className="np-input" style={{flex:1}} value={g.name} onChange={e=>updateGuest(i,"name",e.target.value)} placeholder="Nombre del invitado"/>
                  <button className="np-btn" style={{padding:"6px 10px",color:"var(--color-text-secondary)"}} onClick={()=>removeGuest(i)}>✕</button>
                </div>
                <span className="np-label">Condiciones / intolerancias</span>
                <div>{CONDITIONS.map(c=><span key={c} className={`np-chip ${g.conditions.includes(c)?"on":"off"}`} onClick={()=>toggleGuestCond(i,c)}>{c}</span>)}</div>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
              <button className="np-btn" onClick={addGuest}>+ Añadir invitado</button>
              <button className="np-btn-primary" onClick={generateGuestMenu} disabled={!!loading}>{loading==="guest"?<><span className="loader"/>Generando...</>:"Generar menú especial ↗"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
