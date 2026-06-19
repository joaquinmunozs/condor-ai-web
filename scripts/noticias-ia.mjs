// condor.ai · Generador semanal de "Noticias IA"
// Cada lunes: pide a Claude (con búsqueda web) las mejores noticias de IA de la semana,
// redacta un artículo orientado a convertir al dueño de negocio, y actualiza:
//   - assets/noticias-ia.json   (titular que lee el banner del home)
//   - noticias-ia/index.html    (cuerpo del artículo + fuentes)
//
// Requiere el secreto ANTHROPIC_API_KEY. Se ejecuta en GitHub Actions.

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Falta ANTHROPIC_API_KEY"); process.exit(1); }

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const hoy = new Date();
const fechaTxt = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
const fechaISO = hoy.toISOString().slice(0, 10);

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    titular: { type: "string", description: "Titular gancho para el banner del home, máx ~90 caracteres, orientado a convertir a un dueño de negocio (pyme LATAM). Sin comillas." },
    titulo_articulo: { type: "string", description: "Título del artículo (puede ser más largo que el titular)" },
    parrafos: { type: "array", items: { type: "string" }, description: "4 a 6 párrafos. El primero es un lead potente. Tono cercano, para dueños de negocio sin conocimientos técnicos. Conecta las noticias de IA con cómo les ayuda a vender más, sin mencionar precios. Español neutro LATAM." },
    fuentes: { type: "array", items: { type: "object", additionalProperties: false, properties: { titulo: { type: "string" }, url: { type: "string" } }, required: ["titulo", "url"] }, description: "2 a 4 fuentes reales y verificables usadas, con URL." }
  },
  required: ["titular", "titulo_articulo", "parrafos", "fuentes"]
};

const system = `Eres el editor de "Noticias IA" de condor.ai, una agencia que ayuda a negocios de LATAM a vender más con inteligencia artificial (páginas web, videos con IA, automatización). Cada lunes resumes las MEJORES y más recientes noticias de IA del mundo y las traduces para un dueño de negocio (no técnico). Tu objetivo secundario es convertir: mostrar que la IA es una oportunidad que condor.ai puede ayudarles a aprovechar (venta blanda, sin mencionar precios, sin decir "contrátanos"). Usa SOLO noticias reales y recientes que encuentres en la búsqueda web; cita fuentes verificables. Escribe cálido, claro y motivador.`;

const userMsg = `Busca las noticias de inteligencia artificial más importantes y recientes de esta semana (a la fecha ${fechaTxt}). Elige 2-3 que sean relevantes o inspiradoras para dueños de pequeños y medianos negocios. Redacta el artículo de la semana siguiendo el esquema pedido. El titular debe ser un gancho que haga clic a un dueño de negocio.`;

const body = {
  model: "claude-haiku-4-5",
  max_tokens: 2000,
  system,
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
  output_config: { format: { type: "json_schema", schema } },
  messages: [{ role: "user", content: userMsg }]
};

const resp = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify(body)
});
if (!resp.ok) { console.error("API error:", resp.status, (await resp.text()).slice(0, 400)); process.exit(1); }
const data = await resp.json();
const texto = (data.content ?? []).filter(b => b.type === "text").map(b => b.text).join("");
let art;
try { art = JSON.parse(texto); } catch (e) { console.error("No se pudo parsear:", texto.slice(0, 400)); process.exit(1); }

const esc = s => String(s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// 1) JSON para el banner del home
writeFileSync("assets/noticias-ia.json", JSON.stringify({ titular: art.titular, fecha: fechaISO, url: "/noticias-ia/" }, null, 2) + "\n");

// 2) Reescribir el artículo dentro de noticias-ia/index.html
let html = readFileSync("noticias-ia/index.html", "utf8");
html = html.replace(/<h1 id="art-titulo">[\s\S]*?<\/h1>/, `<h1 id="art-titulo">${esc(art.titulo_articulo)}</h1>`);
html = html.replace(/<p id="art-fecha"[^>]*>[\s\S]*?<\/p>/, `<p id="art-fecha" style="color:var(--tx-2);font-size:.95rem">Actualizado el ${fechaTxt}</p>`);

const cuerpo = art.parrafos.map((p, i) => i === 0 ? `<p class="lead">${esc(p)}</p>` : `<p>${esc(p)}</p>`).join("\n    ");
const fuentes = art.fuentes.map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo)}</a>`).join(" · ");
const cuerpoBlock = `<div class="article rev" id="art-cuerpo">
    ${cuerpo}
    <p class="news-sources" id="art-fuentes" style="color:var(--tx-2);font-size:.88rem;margin-top:30px;border-top:1px solid var(--linea);padding-top:16px"><b>Fuentes:</b> ${fuentes}</p>
  </div>`;
html = html.replace(/<div class="article rev" id="art-cuerpo">[\s\S]*?<\/div>\s*<\/div><\/section>/, cuerpoBlock + "\n  </div></section>");
writeFileSync("noticias-ia/index.html", html);

console.log("OK noticias IA:", art.titular);
