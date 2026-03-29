import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LexMLResult {
  title: string;
  urn: string;
  date: string;
  summary: string;
  url: string;
}

/** Strip all XML/HTML tags and collapse whitespace */
function stripXml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Extract raw inner content of first matching tag (keeps child tags) */
function extractTagRaw(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/** Extract text content of first matching tag (strips child tags) */
function extractTag(xml: string, tag: string): string {
  return stripXml(extractTagRaw(xml, tag));
}

function parseSearchResponse(xml: string): LexMLResult[] {
  const docHitRegex = /<docHit[^>]*>([\s\S]*?)<\/docHit>/gi;
  const allResults: (LexMLResult & { isLei: boolean })[] = [];
  let match;

  while ((match = docHitRegex.exec(xml)) !== null && allResults.length < 20) {
    const hit = match[1];
    const meta = extractTagRaw(hit, "meta");
    if (!meta) continue;

    const urn = stripXml(extractTagRaw(meta, "urn")).replace(/\s+/g, "");
    const tipoDocumento = stripXml(extractTagRaw(meta, "tipoDocumento"));
    const facetTipo = extractTag(meta, "facet-tipoDocumento");
    const descritor = extractTag(meta, "descritor");
    const localidade = extractTag(meta, "localidade");
    const autoridade = extractTag(meta, "autoridade");
    const date = extractTag(meta, "date");
    const dataRepr = extractTag(meta, "dataRepresentativa");
    const apelido = stripXml(extractTagRaw(meta, "apelido"));
    const description = stripXml(extractTagRaw(meta, "description"));

    // Build a readable title
    let title = "";
    if (tipoDocumento && descritor) {
      title = `${tipoDocumento} nº ${descritor}`;
    } else if (tipoDocumento) {
      title = tipoDocumento;
    }
    if (apelido) title += ` - ${apelido}`;
    if (localidade) title += ` — ${localidade}`;

    const url = urn ? `https://www.lexml.gov.br/urn/${encodeURIComponent(urn)}` : "";

    // Determine if this is an actual Lei (not a projeto, decreto, etc.)
    const isLei = /^Legislação::Lei/i.test(facetTipo) || /^Lei$/i.test(tipoDocumento);

    allResults.push({
      title: title || "Documento legislativo",
      urn: urn || "",
      date: dataRepr || date || "",
      summary: description || `${tipoDocumento || "Norma"} ${autoridade ? `(${autoridade})` : ""}`.trim(),
      url,
      isLei,
    });
  }

  // Sort: actual Lei types first, then by original order
  allResults.sort((a, b) => (a.isLei === b.isLei ? 0 : a.isLei ? -1 : 1));

  return allResults.slice(0, 5).map(({ isLei, ...rest }) => rest);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, urn } = await req.json();

    if (!query && !urn) {
      return new Response(
        JSON.stringify({ error: "query ou urn é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let results: LexMLResult[] = [];

    if (urn) {
      const url = `https://www.lexml.gov.br/urn/${encodeURIComponent(urn)}`;
      try {
        const resp = await fetch(url, { headers: { Accept: "text/html,application/xml" } });
        if (resp.ok) {
          results = [{
            title: urn.split(";").pop()?.replace(/[_:]/g, " ") || urn,
            urn,
            date: "",
            summary: "Norma encontrada no LexML.",
            url,
          }];
        }
      } catch (e) {
        console.error("LexML URN fetch error:", e);
      }
    } else {
      // Use the working search endpoint with raw=true for XML
      const encoded = encodeURIComponent(query);
      const searchUrl = `https://www.lexml.gov.br/busca/search?keyword=${encoded}&raw=true`;

      try {
        const resp = await fetch(searchUrl, {
          headers: { Accept: "application/xml,text/xml,text/html" },
        });

        if (resp.ok) {
          const xml = await resp.text();
          results = parseSearchResponse(xml);
        } else {
          console.error("LexML search error:", resp.status);
        }
      } catch (e) {
        console.error("LexML search fetch error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        results,
        source: "LexML - Portal de Legislação Brasileira",
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("lexml-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
