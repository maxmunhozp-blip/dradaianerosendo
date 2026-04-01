import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) throw new Error("Não autenticado");

    const { data: isAdmin } = await anonClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem criar usuários");

    const { email, password, name, role } = await req.json();
    if (!email || !password) throw new Error("E-mail e senha são obrigatórios");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Create user
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || "" },
    });

    if (error) throw error;

    // Set role — directly update user_roles table (service role bypasses RLS)
    if (role && data.user) {
      await admin.from("user_roles").delete().eq("user_id", data.user.id);
      await admin.from("user_roles").insert({ user_id: data.user.id, role });
    }

    // If role is client, link or create client record
    if (role === "client" && data.user) {
      // Try to link existing client by email
      await admin.rpc("link_client_by_email", { _user_id: data.user.id, _email: email });

      // Check if a client was linked
      const { data: linked } = await admin.from("clients").select("id").eq("user_id", data.user.id).maybeSingle();
      if (!linked) {
        // No existing client — create one automatically
        await admin.from("clients").insert({
          name: name || email,
          email,
          status: "ativo",
          user_id: data.user.id,
          owner_id: caller.id,
        });
      }
    }

    // Update permissions based on role
    if (data.user) {
      const isAdminOrAdvogado = role === "admin" || role === "advogado";
      await admin.from("user_permissions").upsert({
        user_id: data.user.id,
        can_view_cases: isAdminOrAdvogado,
        can_edit_cases: isAdminOrAdvogado,
        can_view_clients: isAdminOrAdvogado,
        can_edit_clients: isAdminOrAdvogado,
        can_view_documents: isAdminOrAdvogado,
        can_edit_documents: isAdminOrAdvogado,
        can_access_settings: role === "admin",
      }, { onConflict: "user_id" });
    }

    return new Response(JSON.stringify({ user: { id: data.user.id, email: data.user.email } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
