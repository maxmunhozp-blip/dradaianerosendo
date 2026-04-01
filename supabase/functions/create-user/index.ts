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

    const { email, password, name, role, sendWelcomeEmail } = await req.json();
    if (!email || !password) throw new Error("E-mail e senha são obrigatórios");

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

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
      await admin.rpc("link_client_by_email", { _user_id: data.user.id, _email: email });
      const { data: linked } = await admin.from("clients").select("id").eq("user_id", data.user.id).maybeSingle();
      if (!linked) {
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

    // Send welcome email if requested
    let welcomeEmailSent = false;
    if (sendWelcomeEmail && data.user) {
      try {
        const { data: emailSettings } = await admin
          .from("settings")
          .select("key, value")
          .in("key", [
            "office_name", "email_welcome_enabled", "email_welcome_subject",
            "email_welcome_body", "email_primary_color", "email_logo_url",
            "email_footer_text", "email_font_family", "email_signature_html",
          ]);

        const getSetting = (key: string) => emailSettings?.find((s: any) => s.key === key)?.value || "";
        const isEnabled = getSetting("email_welcome_enabled") !== "false";
        if (!isEnabled) {
          console.log("Welcome email disabled in settings");
        } else {
          const officeName = getSetting("office_name") || "Escritório";
          const primaryColor = getSetting("email_primary_color") || "#0F172A";
          const fontFamily = getSetting("email_font_family") || "Arial, sans-serif";
          const logoUrl = getSetting("email_logo_url");
          const footerText = getSetting("email_footer_text") || `© ${new Date().getFullYear()} ${officeName}. Todos os direitos reservados.`;
          const signatureHtml = getSetting("email_signature_html");

          const roleLabel = role === "client" ? "cliente" : role === "advogado" ? "advogado(a)" : "administrador(a)";

          // Use custom template or default
          const defaultBody = `Olá${name ? `, ${name}` : ""}!\n\nSua conta foi criada com sucesso como ${roleLabel}.\n\nSeus dados de acesso:\n• E-mail: ${email}\n• Senha: definida pelo administrador\n\nRecomendamos que altere sua senha no primeiro acesso.\n\nAtenciosamente,\nEquipe ${officeName}`;
          const customBody = getSetting("email_welcome_body");
          const bodyText = (customBody || defaultBody)
            .replace(/{nome}/g, name || "")
            .replace(/{email}/g, email)
            .replace(/{papel}/g, roleLabel)
            .replace(/{escritorio}/g, officeName);

          const subject = (getSetting("email_welcome_subject") || `Bem-vindo(a) ao ${officeName}`)
            .replace(/{nome}/g, name || "")
            .replace(/{escritorio}/g, officeName);

          const logoHtml = logoUrl
            ? `<img src="${logoUrl}" alt="Logo" style="max-height:48px;margin:0 auto;" />`
            : `<span style="color:#ffffff;font-size:20px;font-weight:700;">${officeName}</span>`;

          const htmlBody = `
            <div style="font-family:${fontFamily};max-width:600px;margin:0 auto;background:#ffffff;">
              <div style="background:${primaryColor};padding:24px 32px;text-align:center;">
                ${logoHtml}
              </div>
              <div style="padding:32px;">
                <h2 style="color:${primaryColor};font-size:20px;font-weight:600;margin-bottom:16px;">${subject}</h2>
                <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-line;">${bodyText}</div>
              </div>
              <div style="border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
                <p style="color:#94a3b8;font-size:11px;margin:0;">${footerText}</p>
                ${signatureHtml ? `<div style="margin-top:12px;">${signatureHtml}</div>` : ""}
              </div>
            </div>
          `;

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ to: email, subject, html: htmlBody }),
          });

          if (emailRes.ok) {
            welcomeEmailSent = true;
          } else {
            console.error("Welcome email failed:", await emailRes.text());
          }
        }
      } catch (emailErr) {
        console.error("Error sending welcome email:", emailErr);
      }
    }

    return new Response(JSON.stringify({ user: { id: data.user.id, email: data.user.email }, welcomeEmailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
