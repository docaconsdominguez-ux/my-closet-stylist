const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let items=[],outfits=[];
const DB="myClosetDB";

function openDB(){
  return new Promise((ok,no)=>{
    const r=indexedDB.open(DB,1);

    r.onupgradeneeded=()=>{
      const d=r.result;

      if(!d.objectStoreNames.contains("items")){
        d.createObjectStore("items",{keyPath:"id"});
      }

      if(!d.objectStoreNames.contains("outfits")){
        d.createObjectStore("outfits",{keyPath:"id"});
      }
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

const esc=v=>String(v??"").replace(
  /[&<>"']/g,
  m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m])
);

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

      reject(
        new Error(
          "No pude leer esta foto. Intenta otra vez."
        )
      );
    };

    img.src=url;
  });
}

async function compress(file){

  const img=await loadImageFromFile(file);

  const maxSide=1400;

  const ratio=Math.min(
    1,
    maxSide/Math.max(
      img.naturalWidth,
      img.naturalHeight
    )
  );

  const w=Math.max(
    1,
    Math.round(
      img.naturalWidth*ratio
    )
  );

  const h=Math.max(
    1,
    Math.round(
      img.naturalHeight*ratio
    )
  );

  const c=document.createElement("canvas");

  c.width=w;
  c.height=h;

  c
    .getContext("2d")
    .drawImage(
      img,
      0,
      0,
      w,
      h
    );

  return await new Promise(
    (resolve,reject)=>{

      c.toBlob(
        b=>b
          ? resolve(b)
          : reject(
              new Error(
                "No pude convertir la foto."
              )
            ),
        "image/jpeg",
        0.82
      );

    }
  );
}

function dataURL(blob){

  return new Promise((ok,no)=>{

    const r=new FileReader();

    r.onload=()=>ok(r.result);
    r.onerror=()=>no(r.error);

    r.readAsDataURL(blob);

  });
}

function categoryLabel(c){

  return ({

    top:"Parte de arriba",

    bottom:"Parte de abajo",

    dress:"Vestido / conjunto",

    outerwear:"Capa / blazer / chamarra",

    shoes:"Zapatos",

    bag:"Bolsa",

    accessory:"Accesorio",

    other:"Otra prenda"

  })[c] || "Prenda";
}

function counts(){

  $("#itemCount").textContent=
    items.length;

  $("#outfitCount").textContent=
    `${outfits.length} look${outfits.length===1?"":"s"} guardado${outfits.length===1?"":"s"}`;

}

function renderCloset(){

  $("#emptyCloset").style.display=
    items.length
      ? "none"
      : "block";

  $("#closetGrid").innerHTML=
    items.map(i=>`

      <article class="item-card">

        <img
          src="${esc(i.imageData)}"
          alt="${esc(i.name)}"
        >

        <div class="item-info">

          <h4>
            ${esc(i.name)}
          </h4>

          <p>
            ${esc(
              i.notes ||
              categoryLabel(i.category)
            )}
          </p>

          <div class="tags">

            <span class="tag">
              ${esc(
                categoryLabel(
                  i.category
                )
              )}
            </span>

          </div>

          <button
            class="delete"
            data-id="${i.id}"
          >
            Eliminar
          </button>

        </div>

      </article>

    `).join("");

  $$(".delete").forEach(
    b=>b.onclick=async()=>{

      if(
        confirm(
          "¿Eliminar esta prenda?"
        )
      ){

        await del(
          "items",
          b.dataset.id
        );

        await load();

      }

    }
  );
}

function lookCard(l){

  const th=
    (l.itemIds||[])
    .map(byId)
    .filter(Boolean);

  return `

    <article class="look-card">

      <div class="look-level">
        ${esc(l.level)}
      </div>

      <h4>
        ${esc(l.label)}
      </h4>

      <div class="look-line">
        <b>Arriba</b>
        <span>${esc(l.top||"—")}</span>
      </div>

      <div class="look-line">
        <b>Abajo</b>
        <span>${esc(l.bottom||"—")}</span>
      </div>

      <div class="look-line">
        <b>Zapatos</b>
        <span>${esc(l.shoes||"—")}</span>
      </div>

      <div class="look-line">
        <b>Bolsa</b>
        <span>${esc(l.bag||"—")}</span>
      </div>

      <div class="look-line">
        <b>Accesorios</b>
        <span>
          ${esc(
            (l.accessories||[])
            .join(", ") ||
            "—"
          )}
        </span>
      </div>

      <div class="look-line">
        <b>Capa</b>
        <span>${esc(l.layer||"—")}</span>
      </div>

      <div class="look-line">
        <b>Peinado</b>
        <span>${esc(l.hair||"—")}</span>
      </div>

      <p class="why">
        <b>Por qué funciona:</b>
        ${esc(l.why)}
      </p>

      <p class="why">
        <b>Styling:</b>
        ${esc(l.styling_detail)}
      </p>

      <div class="outfit-thumbs">

        ${th.map(i=>`

          <img
            src="${esc(i.imageData)}"
            alt="${esc(i.name)}"
          >

        `).join("")}

      </div>

    </article>
  `;
}

function renderHistory(){

  $("#historyList").innerHTML=

    outfits.length

    ? [...outfits]
      .reverse()
      .map(o=>`

        <article class="history-card">

          <span class="date">

            ${
              new Date(
                o.createdAt
              )
              .toLocaleString(
                "es-MX"
              )
            }

          </span>

          <h4>
            ${esc(
              o.request?.occasion ||
              "Look"
            )}
          </h4>

          <p>
            ${esc(
              o.summary ||
              ""
            )}
          </p>

        </article>

      `).join("")

    : `
      <div class="empty">
        Aún no hay looks guardados.
      </div>
    `;
}

async function load(){

  [items,outfits]=
    await Promise.all([

      all("items"),

      all("outfits")

    ]);

  items.sort(
    (a,b)=>
      new Date(b.createdAt)-
      new Date(a.createdAt)
  );

  outfits.sort(
    (a,b)=>
      new Date(a.createdAt)-
      new Date(b.createdAt)
  );

  counts();

  renderCloset();

  renderHistory();
}

function pool(cat){

  return items.filter(
    i=>i.category===cat
  );
}

function pick(
  arr,
  used=new Set()
){

  const available=
    arr.filter(
      x=>!used.has(x.id)
    );

  const source=
    available.length
      ? available
      : arr;

  if(!source.length){
    return null;
  }

  return source[
    Math.floor(
      Math.random()*
      source.length
    )
  ];
}

function signature(ids){

  return ids
    .filter(Boolean)
    .slice()
    .sort()
    .join("|");
}

function usedSignatures(){

  return new Set(

    outfits.flatMap(
      o=>
        (o.looks||[])
        .map(
          l=>
            signature(
              l.itemIds||[]
            )
        )
    )

  );
}

function hairFor(
  occasion,
  level
){

  const x=
    (
      occasion+
      " "+
      level
    )
    .toLowerCase();

  if(
    x.includes("formal") ||
    x.includes("cena")
  ){

    return "Coleta pulida, chongo bajo o ondas suaves.";

  }

  if(
    x.includes("fiesta") ||
    x.includes("concierto")
  ){

    return "Ondas con volumen o coleta alta.";

  }

  return "Suelto natural, media coleta o chongo relajado.";
}

function whyText(
  occasion,
  hasLayer
){

  return `La combinación está equilibrada para ${occasion.toLowerCase()} y aprovecha prendas de distintas categorías sin repetir exactamente un look anterior.${hasLayer?" La capa adicional ayuda a que se vea más armado.":""}`;

}  
function buildLook(
  index,
  occasion,
  vibe,
  historySigs
){

  const used=new Set();

  let top=null;
  let bottom=null;
  let dress=null;
  let shoes=null;
  let bag=null;
  let layer=null;
  let accessories=[];

  if(
    pool("dress").length &&
    (
      index===2 ||
      !pool("top").length ||
      !pool("bottom").length
    )
  ){

    dress=
      pick(
        pool("dress"),
        used
      );

    if(dress){
      used.add(dress.id);
    }

  }else{

    top=
      pick(
        pool("top"),
        used
      );

    if(top){
      used.add(top.id);
    }

    bottom=
      pick(
        pool("bottom"),
        used
      );

    if(bottom){
      used.add(bottom.id);
    }

  }

  shoes=
    pick(
      pool("shoes"),
      used
    );

  if(shoes){
    used.add(shoes.id);
  }

  bag=
    pick(
      pool("bag"),
      used
    );

  if(bag){
    used.add(bag.id);
  }

  if(index!==2){

    layer=
      pick(
        pool("outerwear"),
        used
      );

    if(layer){
      used.add(layer.id);
    }

  }

  const accPool=
    pool("accessory")
    .filter(
      x=>!used.has(x.id)
    );

  if(accPool.length){

    accessories=[
      pick(
        accPool,
        used
      )
    ].filter(Boolean);

  }

  const ids=[
    dress?.id,
    top?.id,
    bottom?.id,
    shoes?.id,
    bag?.id,
    layer?.id,
    ...accessories.map(
      a=>a.id
    )
  ].filter(Boolean);

  if(!ids.length){
    return null;
  }

  const labels=[

    "LOOK 1 — Recomendación principal",

    "LOOK 2 — Más trendy",

    "LOOK 3 — Más sencillo/elegante"

  ];

  const levels=[

    "chic casual",

    "trendy",

    "elegante sencillo"

  ];

  return {

    label:
      labels[index],

    level:
      levels[index],

    itemIds:
      ids,

    top:
      dress
        ? dress.name
        : (
            top?.name ||
            "—"
          ),

    bottom:
      dress
        ? "No aplica"
        : (
            bottom?.name ||
            "—"
          ),

    shoes:
      shoes?.name ||
      "—",

    bag:
      bag?.name ||
      "—",

    accessories:
      accessories.map(
        a=>a.name
      ),

    layer:
      layer?.name ||
      "—",

    hair:
      hairFor(
        occasion,
        levels[index]
      ),

    why:
      whyText(
        occasion,
        !!layer
      ),

    styling_detail:
      index===0

        ? "Mantén el look limpio y usa un solo punto protagonista."

        : index===1

        ? "Hazlo más actual con accesorios visibles, mangas dobladas o una capa contrastante."

        : "Usa pocos accesorios y deja que las prendas principales se vean más pulidas."

  };

}

$$(".tab").forEach(
  b=>b.onclick=()=>{

    $$(".tab").forEach(
      x=>
        x.classList.remove(
          "active"
        )
    );

    $$(".panel").forEach(
      x=>
        x.classList.remove(
          "active"
        )
    );

    b.classList.add(
      "active"
    );

    $(
      "#"+
      b.dataset.tab
    )
    .classList.add(
      "active"
    );

  }
);

$("#uploadForm").onsubmit=
async e=>{

  e.preventDefault();

  const form=
    e.currentTarget;

  const st=
    $("#uploadStatus");

  const btn=
    e.submitter ||
    form.querySelector(
      'button[type="submit"]'
    );

  if(btn){
    btn.disabled=true;
  }

  try{

    const file=
      $("#image").files[0];

    if(!file){

      throw Error(
        "Selecciona o toma una foto."
      );

    }

    st.textContent=
      "Guardando la foto en tu clóset…";

    const blob=
      await compress(
        file
      );

    const category=
      form.elements.category.value ||
      "other";

    const notes=
      form.elements.notes.value ||
      "";

    const countSame=
      items.filter(
        i=>
          i.category===
          category
      ).length+1;

    const item={

      id:
        uid(),

      createdAt:
        new Date()
        .toISOString(),

      imageData:
        await dataURL(
          blob
        ),

      category,

      notes,

      name:
        `${categoryLabel(category)} ${countSame}`

    };

    await put(
      "items",
      item
    );

    st.textContent=
      `Guardado: ${item.name}`;

    form.reset();

    await load();

  }catch(x){

    console.error(x);

    st.textContent=
      x.message ||
      "No se pudo guardar la foto.";

  }finally{

    if(btn){
      btn.disabled=false;
    }

  }

};

$("#lookForm").onsubmit=
async e=>{

  e.preventDefault();

  const form=
    e.currentTarget;

  const st=
    $("#lookStatus");

  const btn=
    e.submitter ||
    form.querySelector(
      'button[type="submit"]'
    );

  if(btn){
    btn.disabled=true;
  }

  try{

    if(
      items.length<2
    ){

      throw Error(
        "Agrega al menos 2 prendas para crear un look."
      );

    }

    const values=
      Object.fromEntries(
        new FormData(
          form
        )
        .entries()
      );

    const occasion=
      values.occasion ||
      "Salida casual";

    const vibe=
      values.vibe ||
      "juvenil y moderna";

    const sigs=
      usedSignatures();

    const looks=[];

    for(
      let i=0;
      i<3;
      i++
    ){

      const look=
        buildLook(
          i,
          occasion,
          vibe,
          sigs
        );

      if(look){

        looks.push(
          look
        );

        sigs.add(
          signature(
            look.itemIds
          )
        );

      }

    }

    const record={

      id:
        uid(),

      createdAt:
        new Date()
        .toISOString(),

      request:
        values,

      summary:
        `Looks creados sin IA usando tu clóset y la ocasión (${occasion}), evitando repetir exactamente combinaciones anteriores.`,

      looks

    };

    await put(
      "outfits",
      record
    );

    $("#lookResults").innerHTML=
      looks
      .map(
        lookCard
      )
      .join("");

    st.textContent=
      record.summary;

    await load();

  }catch(x){

    console.error(x);

    st.textContent=
      x.message ||
      "No se pudieron crear los looks.";

  }finally{

    if(btn){
      btn.disabled=false;
    }

  }

};

$("#resetHistory").onclick=
async()=>{

  if(
    confirm(
      "¿Borrar historial?"
    )
  ){

    await clear(
      "outfits"
    );

    $("#lookResults").innerHTML=
      "";

    await load();

  }

};

if(
  "serviceWorker"
  in navigator
){

  addEventListener(
    "load",
    ()=>{

      navigator
        .serviceWorker
        .register(
          "/service-worker.js"
        )
        .catch(
          console.error
        );

    }
  );

}

load();
