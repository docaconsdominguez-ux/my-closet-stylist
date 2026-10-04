const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let items=[],outfits=[];
const DB="myClosetDB";

function openDB(){
  return new Promise((ok,no)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{
      const d=r.result;
      if(!d.objectStoreNames.contains("items")) d.createObjectStore("items",{keyPath:"id"});
      if(!d.objectStoreNames.contains("outfits")) d.createObjectStore("outfits",{keyPath:"id"});
    };
    r.onsuccess=()=>ok(r.result);
    r.onerror=()=>no(r.error);
  });
}

async function all(s){
  const d=await openDB();
  return new Promise((ok,no)=>{
    const r=d.transaction(s).objectStore(s).getAll();
    r.onsuccess=()=>ok(r.result||[]);
    r.onerror=()=>no(r.error);
  });
}

async function put(s,v){
  const d=await openDB();
  return new Promise((ok,no)=>{
    const t=d.transaction(s,"readwrite");
    t.objectStore(s).put(v);
    t.oncomplete=ok;
    t.onerror=()=>no(t.error);
  });
}

async function del(s,id){
  const d=await openDB();
  return new Promise((ok,no)=>{
    const t=d.transaction(s,"readwrite");
    t.objectStore(s).delete(id);
    t.oncomplete=ok;
    t.onerror=()=>no(t.error);
  });
}

async function clear(s){
  const d=await openDB();
  return new Promise((ok,no)=>{
    const t=d.transaction(s,"readwrite");
    t.objectStore(s).clear();
    t.oncomplete=ok;
    t.onerror=()=>no(t.error);
  });
}

async function api(u,o={}){
  const r=await fetch(u,o);
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw Error(d.error||"Error");
  return d;
}

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#039;"
}[m]));

const uid=()=>crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const byId=id=>items.find(x=>x.id===id);

function loadImageFromFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();

    img.onload=()=>{
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror=()=>{
      URL.revokeObjectURL(url);
      reject(new Error("No pude leer esta foto. Intenta tomarla otra vez o elegirla desde Fotos."));
    };

    img.src=url;
  });
}

async function compress(file){
  const img=await loadImageFromFile(file);
  const maxSide=1400;
  const ratio=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*ratio));
  const h=Math.max(1,Math.round(img.naturalHeight*ratio));

  const c=document.createElement("canvas");
  c.width=w;
  c.height=h;

  const ctx=c.getContext("2d");
  ctx.drawImage(img,0,0,w,h);

  const blob=await new Promise((resolve,reject)=>{
    c.toBlob(b=>{
      if(!b){
        reject(new Error("No pude convertir la foto. Intenta elegirla desde Fotos."));
      }else{
        resolve(b);
      }
    },"image/jpeg",0.82);
  });

  return blob;
}

function dataURL(blob){
  return new Promise((ok,no)=>{
    const r=new FileReader();
    r.onload=()=>ok(r.result);
    r.onerror=()=>no(r.error);
    r.readAsDataURL(blob);
  });
}

function counts(){
  $("#itemCount").textContent=items.length;
  $("#outfitCount").textContent=
    `${outfits.length} look${outfits.length===1?"":"s"} guardado${outfits.length===1?"":"s"}`;
}

function renderCloset(){
  $("#emptyCloset").style.display=items.length?"none":"block";

  $("#closetGrid").innerHTML=items.map(i=>`
    <article class="item-card">
      <img src="${esc(i.imageData)}" alt="${esc(i.name)}">
      <div class="item-info">
        <h4>${esc(i.name)}</h4>
        <p>${esc(i.description)}</p>
        <div class="tags">
          ${(i.colors||[]).slice(0,3).map(x=>
            `<span class="tag">${esc(x)}</span>`
          ).join("")}
        </div>
        <button class="delete" data-id="${i.id}">Eliminar</button>
      </div>
    </article>
  `).join("");

  $$(".delete").forEach(b=>b.onclick=async()=>{
    if(confirm("¿Eliminar esta prenda?")){
      await del("items",b.dataset.id);
      await load();
    }
  });
}

function lookCard(l){
  const th=(l.itemIds||[]).map(byId).filter(Boolean);

  return `
    <article class="look-card">
      <div class="look-level">${esc(l.level)}</div>
      <h4>${esc(l.label)}</h4>

      <div class="look-line"><b>Arriba</b><span>${esc(l.top||"—")}</span></div>
      <div class="look-line"><b>Abajo</b><span>${esc(l.bottom||"—")}</span></div>
      <div class="look-line"><b>Zapatos</b><span>${esc(l.shoes||"—")}</span></div>
      <div class="look-line"><b>Bolsa</b><span>${esc(l.bag||"—")}</span></div>
      <div class="look-line"><b>Accesorios</b><span>${esc((l.accessories||[]).join(", ")||"—")}</span></div>
      <div class="look-line"><b>Capa</b><span>${esc(l.layer||"—")}</span></div>
      <div class="look-line"><b>Peinado</b><span>${esc(l.hair||"—")}</span></div>

      <p class="why"><b>Por qué funciona:</b> ${esc(l.why)}</p>
      <p class="why"><b>Styling:</b> ${esc(l.styling_detail)}</p>

      ${l.optional_purchase
        ? `<p class="why"><b>Opcional:</b> ${esc(l.optional_purchase)}</p>`
        : ""
      }

      <div class="outfit-thumbs">
        ${th.map(i=>`<img src="${esc(i.imageData)}" alt="${esc(i.name)}">`).join("")}
      </div>
    </article>
  `;
}

function renderHistory(){
  $("#historyList").innerHTML=outfits.length
    ? [...outfits].reverse().map(o=>`
      <article class="history-card">
        <span class="date">${new Date(o.createdAt).toLocaleString("es-MX")}</span>
        <h4>${esc(o.request?.occasion)}</h4>
        <p>${esc(o.summary)}</p>

        <div class="tags">
          ${(o.looks||[]).map(l=>
            `<span class="tag">${esc(l.label)}</span>`
          ).join("")}
        </div>
      </article>
    `).join("")
    : `<div class="empty">Aún no hay looks guardados.</div>`;
}

async function load(){
  [items,outfits]=await Promise.all([
    all("items"),
    all("outfits")
  ]);

  items.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  outfits.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));

  counts();
  renderCloset();
  renderHistory();
}

$$(".tab").forEach(b=>b.onclick=()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  $$(".panel").forEach(x=>x.classList.remove("active"));

  b.classList.add("active");
  $("#"+b.dataset.tab).classList.add("active");
});  
$("#uploadForm").onsubmit=async e=>{
  e.preventDefault();

  // Guardamos la referencia al formulario antes de cualquier await
  // porque Safari/iPhone puede perder e.currentTarget después.
  const form=e.currentTarget;
  const st=$("#uploadStatus");
  const btn=e.submitter || form.querySelector('button[type="submit"]');

  st.textContent="Preparando la foto…";

  if(btn){
    btn.disabled=true;
  }

  try{
    const f=$("#image").files[0];

    if(!f){
      throw Error("Selecciona o toma una foto.");
    }

    // FormData se crea ANTES de procesar la imagen
    // para evitar el error de Safari.
    const fd=new FormData(form);
    const notes=form.elements.notes?.value || "";

    st.textContent="Procesando la foto del iPhone…";

    const blob=await compress(f);

    st.textContent="Analizando la prenda…";

    fd.set("image",blob,"prenda.jpg");

    const a=await api("/api/analyze",{
      method:"POST",
      body:fd
    });

    st.textContent="Guardando en tu clóset…";

    const item={
      id:uid(),
      createdAt:new Date().toISOString(),
      imageData:await dataURL(blob),
      notes,
      ...a
    };

    await put("items",item);

    st.textContent=`Guardado: ${item.name}`;

    form.reset();

    await load();

  }catch(x){

    console.error(x);

    st.textContent=
      x.message ||
      "No se pudo subir la foto.";

  }finally{

    if(btn){
      btn.disabled=false;
    }

  }
};

$("#lookForm").onsubmit=async e=>{
  e.preventDefault();

  const form=e.currentTarget;
  const st=$("#lookStatus");
  const btn=e.submitter || form.querySelector('button[type="submit"]');

  st.textContent="Revisando tu clóset…";

  if(btn){
    btn.disabled=true;
  }

  try{

    const formData=new FormData(form);

    const formValues=
      Object.fromEntries(formData.entries());

    const inventory=
      items.map(({imageData,...x})=>x);

    const r=
      await api("/api/outfits/generate",{

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          ...formValues,

          inventory,

          history:outfits.slice(-25)

        })

      });

    await put("outfits",r);

    $("#lookResults").innerHTML=
      (r.looks||[])
      .map(lookCard)
      .join("");

    st.textContent=
      r.summary ||
      "Looks listos.";

    await load();

  }catch(x){

    console.error(x);

    st.textContent=
      x.message ||
      "No se pudieron generar los looks.";

  }finally{

    if(btn){
      btn.disabled=false;
    }

  }
};

$("#resetHistory").onclick=async()=>{

  if(confirm("¿Borrar historial?")){

    await clear("outfits");

    $("#lookResults").innerHTML="";

    await load();

  }

};

if("serviceWorker" in navigator){

  addEventListener("load",()=>{

    navigator
      .serviceWorker
      .register("/service-worker.js")
      .catch(console.error);

  });

}

load();
