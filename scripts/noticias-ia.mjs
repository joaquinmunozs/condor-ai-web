// condor.ai · Generador semanal de "Noticias IA" (corre los LUNES)
// Investiga en la web las 3 mejores noticias de IA de los últimos 7 días y:
//   1. Crea/actualiza 3 blogs en /noticias-ia/<slug>/index.html (con imagen de la fuente + fuentes)
//   2. Reescribe /noticias-ia/index.html (índice de la semana, 3 tarjetas)
//   3. Actualiza /assets/noticias-ia.json (3 titulares + URL → rotan en el banner del home)
// Cada noticia parece artículo informativo, con imagen real de la fuente y enlaces a fuentes,
// y siempre cierra orientado a convertir (CTA WhatsApp + diagnóstico).
//
// Requiere secret ANTHROPIC_API_KEY.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Falta ANTHROPIC_API_KEY"); process.exit(1); }

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const hoy = new Date();
const fechaTxt = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
const fechaISO = hoy.toISOString().slice(0, 10);

const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slugify = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    noticias: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          titular: { type: "string", description: "Titular gancho para el banner, máx ~80 caracteres, orientado a un dueño de negocio. Sin comillas." },
          titulo_articulo: { type: "string", description: "Título del artículo del blog (puede ser más descriptivo)." },
          parrafos: { type: "array", items: { type: "string" }, description: "3-4 párrafos. Lead potente primero. Explica la noticia real y por qué le importa a un dueño de negocio (pyme LATAM). Tono informativo pero cercano, sin tecnicismos. Conecta sutilmente con que condor.ai puede ayudarle (sin decir 'contrátanos', sin precios)." },
          imagen_url: { type: "string", description: "URL directa de una imagen representativa de la noticia (og:image del medio fuente o imagen pública relacionada). Debe ser una URL https que termine o sea claramente una imagen. Si no encuentras una confiable, deja string vacío." },
          imagen_credito: { type: "string", description: "Nombre del medio/fuente de la imagen (ej: 'Foto: Reuters'). Vacío si no hay imagen." },
          fuentes: { type: "array", items: { type: "object", additionalProperties: false, properties: { titulo: { type: "string" }, url: { type: "string" } }, required: ["titulo", "url"] }, description: "1-3 fuentes reales y verificables, con URL." }
        },
        required: ["titular", "titulo_articulo", "parrafos", "imagen_url", "imagen_credito", "fuentes"]
      }
    }
  },
  required: ["noticias"]
};

const system = `Eres el editor de "Noticias IA" de condor.ai, agencia que ayuda a negocios de LATAM a vender más con inteligencia artificial. Cada lunes eliges las 3 noticias MÁS importantes y recientes de IA/tecnología del mundo (últimos 7 días) y las explicas para un dueño de negocio (no técnico). Para cada una redactas un artículo informativo, real y con fuentes verificables, que cierra mostrando de forma sutil que condor.ai puede ayudar (sin precios, sin "contrátanos"). Usa SOLO noticias reales encontradas en la búsqueda web. Para la imagen, intenta dar la og:image del medio fuente.`;

const resp = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({
    model: "claude-haiku-4-5", max_tokens: 3000,
    system,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: `Busca las 3 noticias de IA más importantes de esta semana (a la fecha ${fechaTxt}) y redacta los 3 artículos según el esquema. Imagen real de la fuente cuando sea posible.` }],
  }),
});
if (!resp.ok) { console.error("API error:", resp.status, (await resp.text()).slice(0, 400)); process.exit(1); }
const data = await resp.json();
const texto = (data.content ?? []).filter(b => b.type === "text").map(b => b.text).join("");
let out;
try { out = JSON.parse(texto); } catch (e) { console.error("No parseó:", texto.slice(0, 400)); process.exit(1); }
const noticias = (out.noticias || []).slice(0, 3).map(n => ({ ...n, slug: slugify(n.titulo_articulo || n.titular) }));
if (!noticias.length) { console.error("Sin noticias"); process.exit(1); }

const NAV = `<nav id="nav"><div class="nav-in">
    <a class="brand" href="/"><img src="/assets/logo.png" alt="condor.ai" /></a>
    <div class="nav-links"><a class="lk" href="/">Inicio</a><a class="lk" href="/servicios/">Servicios</a><a class="lk" href="/portafolio/">Portafolio</a><a class="lk" href="/blog/">Blog</a><a class="lk" href="/planes/">Planes</a><a class="lk" href="/nosotros/">Nosotros</a>
      <a class="lk" href="/portal.html">Acceso clientes</a><a class="btn btn-grad" style="min-height:38px;padding:0 18px;font-size:.86rem" href="/contacto/">Contáctanos</a></div>
    <button class="hamb" id="hamb" aria-label="Menú"><span></span><span></span><span></span></button>
  </div></nav>
  <div class="overlay" id="ov"></div>
  <aside class="drawer" id="drawer"><a href="/">Inicio</a><a href="/servicios/">Servicios</a><a href="/portafolio/">Portafolio</a><a href="/blog/">Blog</a><a href="/planes/">Planes</a><a href="/nosotros/">Nosotros</a><a href="/portal.html">Acceso clientes</a><a href="/contacto/">Contacto</a><a class="btn btn-grad" style="margin-top:20px" href="/contacto/">Contáctanos</a></aside>`;
const FOOT = `<footer><div class="wrap"><div class="foot-grid">
    <div><div class="brand"><img src="/assets/logo.png" alt="condor.ai" /></div><p style="color:var(--tx-2);font-size:.94rem;max-width:320px">Inteligencia artificial para hacer crecer tu negocio.</p></div>
    <div><h5>Servicios</h5><ul><li><a href="/paginas-web/">Páginas web</a></li><li><a href="/videos-ia/">Videos con IA</a></li><li><a href="/automatizacion/">Automatización</a></li><li><a href="/diagnostico/">Diagnóstico</a></li></ul></div>
    <div><h5>Empresa</h5><ul><li><a href="/nosotros/">Nosotros</a></li><li><a href="/portafolio/">Portafolio</a></li><li><a href="/blog/">Blog</a></li><li><a href="/noticias-ia/">Noticias IA</a></li><li><a href="/contacto/">Contacto</a></li></ul></div>
    <div><h5>Contacto</h5><ul><li>WhatsApp +56 9 8898 9824</li><li><a href="/contacto/">Contáctanos</a></li></ul></div>
  </div><div class="foot-bottom">© <span id="anio"></span> condor.ai · Inteligencia Artificial para tu negocio</div></div></footer>
  <a class="wsp-float" href="https://wa.me/56988989824?text=Hola%20condor.ai" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.515 5.26l-.999 3.648 3.733-.979z"/></svg></a>`;
const HEAD = (titulo, desc) => `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(titulo)} · condor.ai</title><meta name="description" content="${esc(desc)}" />
  <link rel="icon" type="image/png" href="/assets/favicon.png" /><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/styles.css" /><script src="/assets/app.js" defer></script></head><body id="top">`;

// Imagen con fallback a gradiente si la URL falla
const heroImg = (n) => n.imagen_url && n.imagen_url.startsWith("http")
  ? `<img src="${esc(n.imagen_url)}" alt="${esc(n.titulo_articulo)}" style="width:100%;height:280px;object-fit:cover;border-radius:18px" onerror="this.style.display='none';this.parentNode.style.background='var(--grad)'" />${n.imagen_credito ? `<p style="font-size:.78rem;color:var(--tx-2);margin-top:6px">${esc(n.imagen_credito)}</p>` : ""}`
  : `<div style="height:200px;border-radius:18px;background:var(--grad)"></div>`;

// 1) Cada noticia -> su blog
for (const n of noticias) {
  const cuerpo = (n.parrafos || []).map((p, i) => i === 0 ? `<p class="lead">${esc(p)}</p>` : `<p>${esc(p)}</p>`).join("\n    ");
  const fuentes = (n.fuentes || []).map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo)}</a>`).join(" · ");
  const html = `${HEAD(n.titulo_articulo, (n.parrafos || [""])[0].slice(0, 150))}
  ${NAV}
  <header class="pg-hero"><div class="orb orb-1" data-par=".05"></div>
    <div class="wrap hero-in" style="max-width:760px"><p class="crumbs"><a href="/">Inicio</a> / <a href="/noticias-ia/">Noticias IA</a> / Noticia</p><p class="eyebrow">Noticias IA · ${fechaTxt}</p><h1>${esc(n.titulo_articulo)}</h1></div>
  </header>
  <section style="padding-top:6px"><div class="wrap"><div class="article rev">
    <div style="margin:0 0 22px">${heroImg(n)}</div>
    ${cuerpo}
    <p class="news-sources" style="color:var(--tx-2);font-size:.88rem;margin-top:30px;border-top:1px solid var(--linea);padding-top:16px"><b>Fuentes:</b> ${fuentes || "Búsqueda web condor.ai"}</p>
  </div></div></section>
  <div style="padding:30px 0 100px"><div class="wrap"><div class="band rev">
    <h2>¿Quieres que la IA trabaje para tu negocio?</h2><p>No te quedes mirando cómo avanza la tecnología — aprovéchala. Cuéntanos qué necesitas, sin compromiso.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
      <a class="btn" href="https://wa.me/56988989824?text=Hola%20condor.ai,%20le%C3%AD%20las%20noticias%20de%20IA%20y%20quiero%20aplicarlo" target="_blank" rel="noopener">Hablar por WhatsApp →</a>
      <a class="btn" style="background:rgba(255,255,255,.18);color:#fff" href="/diagnostico-gratis/" target="_blank" rel="noopener">Diagnóstico gratis</a>
    </div>
  </div></div></div>
  ${FOOT}</body></html>`;
  mkdirSync(`noticias-ia/${n.slug}`, { recursive: true });
  writeFileSync(`noticias-ia/${n.slug}/index.html`, html);
}

// 2) Índice /noticias-ia/ con las 3 tarjetas
const tarjetas = noticias.map((n, i) => `<a class="post rev d${i + 1}" href="/noticias-ia/${n.slug}/"><div class="ph">${n.imagen_url && n.imagen_url.startsWith("http") ? `<img src="${esc(n.imagen_url)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" />` : ""}<span>IA · ${fechaTxt}</span></div><div class="body"><h3>${esc(n.titulo_articulo)}</h3><p>${esc((n.parrafos || [""])[0].slice(0, 120))}…</p><span class="lnk">Leer noticia →</span></div></a>`).join("\n    ");
const indice = `${HEAD("Noticias de IA de la semana", "Las mejores noticias de inteligencia artificial del mundo, cada semana, para dueños de negocio. Por condor.ai.")}
  ${NAV}
  <header class="pg-hero"><div class="orb orb-1" data-par=".05"></div>
    <div class="wrap hero-in" style="max-width:760px"><p class="crumbs"><a href="/">Inicio</a> / <a href="/blog/">Blog</a> / Noticias IA</p><p class="eyebrow">Noticias IA · cada lunes</p><h1>La semana en <span class="grad-tx">inteligencia artificial</span></h1><p>Actualizado el ${fechaTxt}</p></div>
  </header>
  <section style="padding-top:20px"><div class="wrap"><div class="grid-3">
    ${tarjetas}
  </div></div></section>
  <div style="padding:30px 0 100px"><div class="wrap"><div class="band rev">
    <h2>¿Listo para aprovechar la IA en tu negocio?</h2><p>Cuéntanos qué necesitas y te ayudamos, sin compromiso.</p>
    <a class="btn" href="https://wa.me/56988989824?text=Hola%20condor.ai,%20quiero%20aprovechar%20la%20IA" target="_blank" rel="noopener">Hablar por WhatsApp →</a>
  </div></div></div>
  ${FOOT}</body></html>`;
writeFileSync("noticias-ia/index.html", indice);

// 3) JSON para el banner del home (3 titulares rotando, cada uno a su blog)
writeFileSync("assets/noticias-ia.json", JSON.stringify({
  fecha: fechaISO,
  noticias: noticias.map(n => ({ titular: n.titular, url: `/noticias-ia/${n.slug}/` })),
}, null, 2) + "\n");

console.log("OK noticias IA:", noticias.map(n => n.titular).join(" | "));
