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

function parseXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function parseAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function parseSRUResponse(xml: string): LexMLResult[] {
  const records = parseAllTags(xml, "srw:record");
  const results: LexMLResult[] = [];

  for (const record of records) {
    const recordData = parseXmlTag(record, "srw:recordData");
    
    // Extract from Dublin Core or LexML metadata
    const title = parseXmlTag(recordData, "dc:title") || 
                  parseXmlTag(recordData, "title") ||
                  parseXmlTag(recordData, "oai_dc:title") || 
                  "Sem título";
    
    const identifier = parseXmlTag(recordData, "dc:identifier") || 
                       parseXmlTag(recordData, "identifier") || "";
    
    const date = parseXmlTag(recordData, "dc:date") || 
                 parseXmlTag(recordData, "date") || "";
    
    const description = parseXmlTag(recordData, "dc:description") || 
                        parseXmlTag(recordData, "description") || "";
    
    const urn = identifier.startsWith("urn:lex:") ? identifier : "";
    const url = urn ? `https://www.lexml.gov.br/urn/${encodeURIComponent(urn)}` : "";

    results.push({
      title: title.replace(/<[^>]+>/g, "").trim(),
      urn,
      date,
      summary: description.replace(/<[^>]+>/g, "").trim(),
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
      // Fetch exact law by URN
      const url = `https://www.lexml.gov.br/urn/${encodeURIComponent(urn)}`;
      try {
        const resp = await fetch(url, {
          headers: { Accept: "text/html,application/xml" },
        });
        if (resp.ok) {
          results = [{
            title: urn.split(":").pop()?.replace(/;/g, " ") || urn,
            urn,
            date: "",
            summary: `Norma encontrada no LexML.`,
            url,
          }];
        }
      } catch (e) {
        console.error("LexML URN fetch error:", e);
      }
    } else {
      // Search by query
      const searchUrl = `https://www.lexml.gov.br/busca/SRU?operation=searchRetrieve&version=1.1&query=${encodeURIComponent(query)}&maximumRecords=5`;
      
      try {
        const resp = await fetch(searchUrl, {
          headers: { Accept: "application/xml,text/xml" },
        });
        
        if (resp.ok) {
          const xml = await resp.text();
          results = parseSRUResponse(xml);
        } else {
          console.error("LexML search error:", resp.status);
        }
      } catch (e) {
        console.error("LexML search fetch error:", e);
      }
    }

    return new Response(
      JSON.stringify({ results, source: "LexML - Portal de Legislação Brasileira", timestamp: new Date().toISOString() }),
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
