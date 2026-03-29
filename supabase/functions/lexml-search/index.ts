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
  // LexML uses crossQueryResult with docHit elements
  const docHitRegex = /<docHit[^>]*>([\s\S]*?)<\/docHit>/gi;
  const results: LexMLResult[] = [];
  let match;

  while ((match = docHitRegex.exec(xml)) !== null && results.length < 5) {
    const hit = match[1];
    const meta = extractTagRaw(hit, "meta");
    if (!meta) continue;

    const urn = extractTag(meta, "urn");
    const tipoDocumento = extractTag(meta, "tipoDocumento");
    const descritor = extractTag(meta, "descritor");
    const localidade = extractTag(meta, "localidade");
    const autoridade = extractTag(meta, "autoridade");
    const date = extractTag(meta, "date");
    const dataRepr = extractTag(meta, "dataRepresentativa");

    // Build a readable title
    let title = "";
    if (tipoDocumento && descritor) {
      title = `${tipoDocumento} nº ${descritor}`;
    } else if (tipoDocumento) {
      title = tipoDocumento;
    }
    if (localidade) title += ` — ${localidade}`;

    const url = urn ? `https://www.lexml.gov.br/urn/${encodeURIComponent(urn)}` : "";

    results.push({
      title: title || "Documento legislativo",
      urn: urn || "",
      date: dataRepr || date || "",
      summary: `${tipoDocumento || "Norma"} ${autoridade ? `(${autoridade})` : ""}`.trim(),
      url,
    });
  }

  return results;
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
