import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Solo imágenes."))
});

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseJson(text) {
  return JSON.parse(String(text || "").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```$/i,"").trim());
}

const CORE = `
Actúa como stylist personal femenino y experto en diseño de imagen.
Crea looks juveniles, femeninos, modernos, elegantes cuando aplique, naturales y actuales.
Prioriza las prendas existentes, combina por color, textura, corte, proporción, ocasión y formalidad.
Evita repetir exactamente outfits anteriores. Reutiliza piezas de formas distintas.
Eleva looks básicos con accesorios, capas, zapatos o styling.
No apruebes una combinación solo porque combine: debe verse intencional y actual.
Si algo no funciona, dilo claramente. No inventes prendas del inventario.
Máximo 3 looks.
`;

app.get("/api/health", (_, res) => res.json({ ok:true }));

app.post("/api/analyze", upload.single("image"), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({error:"Sube una foto."});
    const image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const r = await client().responses.create({
      model: MODEL,
      input:[{role:"user",content:[
        {type:"input_text",text:`${CORE}
Analiza UNA prenda o accesorio. Devuelve EXCLUSIVAMENTE JSON válido:
{
"name":"nombre corto",
"category":"top|bottom|dress|outerwear|shoes|bag|accessory|other",
"subcategory":"tipo",
"colors":["color principal","secundario"],
"pattern":"liso/estampado/etc",
"material_guess":"material probable",
"fit":"ajustado/recto/oversize/etc",
"style_tags":["casual","elegante","trendy"],
"season_tags":["primavera","verano","otoño","invierno","todo el año"],
"formality":1,
"description":"descripción visual concreta",
"styling_notes":"cómo aprovecharla",
"confidence_note":"detalles inciertos"
}
formality va de 1 a 5.
Categoría indicada: ${req.body.category || "ninguna"}.
Notas: ${req.body.notes || "ninguna"}.`},
        {type:"input_image",image_url:image}
      ]}]
    });
    res.json(parseJson(r.output_text));
  }catch(e){ console.error(e); res.status(500).json({error:e.message || "No se pudo analizar."}); }
});

app.post("/api/outfits/generate", async (req,res)=>{
  try{
    const {occasion="casual",weather="",season="",vibe="",extra="",inventory=[],history=[]}=req.body||{};
    if(inventory.length<2) return res.status(400).json({error:"Agrega al menos 2 prendas."});
    const inv=inventory.map(({imageData,...x})=>x);
    const hist=(history||[]).slice(-25).map(o=>({occasion:o.request?.occasion,looks:o.looks?.map(l=>l.itemIds)}));
    const r=await client().responses.create({
      model:MODEL,
      input:`${CORE}

INVENTARIO:
${JSON.stringify(inv,null,2)}

HISTORIAL:
${JSON.stringify(hist,null,2)}

Ocasión: ${occasion}
Clima: ${weather||"no indicado"}
Temporada: ${season||"no indicada"}
Vibra: ${vibe||"juvenil, femenina, moderna"}
Extra: ${extra||"ninguno"}

Devuelve EXCLUSIVAMENTE JSON válido:
{
"summary":"criterio general",
"looks":[{
"label":"LOOK 1 — Recomendación principal",
"level":"casual arreglado/chic/trendy/etc",
"itemIds":["ids exactos"],
"top":"nombre o no aplica",
"bottom":"nombre o no aplica",
"shoes":"nombre o no aplica",
"bag":"nombre o no aplica",
"accessories":["nombres"],
"layer":"nombre o no aplica",
"hair":"peinado sugerido",
"why":"por qué funciona",
"styling_detail":"detalle concreto",
"optional_purchase":"solo si hace falta; si no cadena vacía"
}]
}`
    });
    res.json({id:crypto.randomUUID(),createdAt:new Date().toISOString(),request:{occasion,weather,season,vibe,extra},...parseJson(r.output_text)});
  }catch(e){console.error(e);res.status(500).json({error:e.message||"No se pudieron crear los looks."});}
});

app.get("*",(_,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`My Closet listo en ${PORT}`));
