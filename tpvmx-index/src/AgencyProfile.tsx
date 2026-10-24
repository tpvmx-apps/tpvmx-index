import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AgencyProfileData = {
  agencyName: string;
  commercialName: string;
  advisorName: string;
  whatsapp: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  logoPath: string;
  logoUrl: string;
  showWhatsapp: boolean;
  showEmail: boolean;
};

type Props = {
  session: Session;
  agencyName: string;
  onProfileChange: (profile: AgencyProfileData) => void;
};

type FormState = Omit<AgencyProfileData, "agencyName" | "logoUrl">;

const emptyForm: FormState = {
  commercialName: "",
  advisorName: "",
  whatsapp: "",
  phone: "",
  email: "",
  website: "",
  facebook: "",
  instagram: "",
  logoPath: "",
  showWhatsapp: true,
  showEmail: true,
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function buildLogoUrl(path: string) {
  if (!path) return "";
  const { data } = supabase.storage.from("agency-branding").getPublicUrl(path);
  return data.publicUrl || "";
}

export function AgencyProfile({ session, agencyName, onProfileChange }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  const profile = useMemo<AgencyProfileData>(() => ({
    agencyName,
    ...form,
    logoUrl: buildLogoUrl(form.logoPath),
  }), [agencyName, form]);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      setLoading(true);
      const { data, error } = await supabase
        .from("agency_profiles")
        .select("commercial_name,advisor_name,whatsapp,phone,email,website,facebook,instagram,logo_path,show_whatsapp,show_email")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.error("No se pudo cargar el perfil de agencia", error);
        setMessage("No pude cargar tus datos comerciales.");
      } else if (data) {
        setForm({
          commercialName: clean(data.commercial_name),
          advisorName: clean(data.advisor_name),
          whatsapp: clean(data.whatsapp),
          phone: clean(data.phone),
          email: clean(data.email),
          website: clean(data.website),
          facebook: clean(data.facebook),
          instagram: clean(data.instagram),
          logoPath: clean(data.logo_path),
          showWhatsapp: data.show_whatsapp !== false,
          showEmail: data.show_email !== false,
        });
      } else {
        setForm((current) => ({
          ...current,
          commercialName: agencyName,
          email: clean(session.user.email),
        }));
      }

      setLoading(false);
    }

    void loadProfile();
    return () => {
      alive = false;
    };
  }, [agencyName, session.user.email, session.user.id]);

  useEffect(() => {
    if (!loading) onProfileChange(profile);
  }, [loading, onProfileChange, profile]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function saveProfile() {
    setSaving(true);
    setMessage("");

    const payload = {
      user_id: session.user.id,
      commercial_name: clean(form.commercialName) || agencyName,
      advisor_name: clean(form.advisorName) || null,
      whatsapp: clean(form.whatsapp) || null,
      phone: clean(form.phone) || null,
      email: clean(form.email) || null,
      website: clean(form.website) || null,
      facebook: clean(form.facebook) || null,
      instagram: clean(form.instagram) || null,
      logo_path: clean(form.logoPath) || null,
      show_whatsapp: form.showWhatsapp,
      show_email: form.showEmail,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("agency_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("No se pudo guardar el perfil", error);
      setMessage("No pude guardar los cambios. Intenta de nuevo.");
    } else {
      const next = {
        ...profile,
        commercialName: String(payload.commercial_name || agencyName),
      };
      onProfileChange(next);
      setMessage("Datos comerciales actualizados.");
      setEditing(false);
    }

    setSaving(false);
  }

  async function uploadLogo(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("El logo debe ser PNG, JPG o WebP.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("El logo debe pesar máximo 2 MB.");
      return;
    }

    setUploading(true);
    setMessage("");

    const ext =
      file.type === "image/png" ? "png" :
      file.type === "image/webp" ? "webp" : "jpg";
    const path = `${session.user.id}/logo.${ext}`;
    const previousPath = form.logoPath;

    const { error } = await supabase.storage
      .from("agency-branding")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (error) {
      console.error("No se pudo subir el logo", error);
      setMessage("No pude subir el logo.");
      setUploading(false);
      return;
    }

    if (previousPath && previousPath !== path) {
      await supabase.storage.from("agency-branding").remove([previousPath]);
    }

    setForm((current) => ({ ...current, logoPath: path }));
    setMessage("Logo cargado. Guarda los cambios para aplicarlo.");
    setUploading(false);
  }

  const displayName = form.commercialName || agencyName;
  const contactPreview = [
    form.showWhatsapp && form.whatsapp ? `WhatsApp: ${form.whatsapp}` : "",
    form.showEmail && form.email ? form.email : "",
    form.website,
  ].filter(Boolean);

  if (loading) {
    return <section className="agency-profile-card agency-profile-loading">Preparando tu espacio comercial…</section>;
  }

  return (
    <section className="agency-profile-card">
      <div className="agency-profile-summary">
        <div className="agency-profile-identity">
          <div className="agency-profile-logo-wrap">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt={displayName} className="agency-profile-logo" />
            ) : (
              <span className="agency-profile-logo-placeholder">TU LOGO</span>
            )}
          </div>

          <div>
            <p className="agency-profile-eyebrow">MI AGENCIA</p>
            <h2>{displayName}</h2>
            <p className="agency-profile-caption">
              {contactPreview.length > 0
                ? contactPreview.join(" · ")
                : "Completa tus datos para personalizar los copys de tus clientes."}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="agency-profile-edit"
          onClick={() => setEditing((current) => !current)}
        >
          {editing ? "Cerrar" : "Editar mi agencia"}
        </button>
      </div>

      {editing ? (
        <div className="agency-profile-editor">
          <div className="agency-profile-logo-editor">
            <div className="agency-profile-logo-wrap is-large">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt={displayName} className="agency-profile-logo" />
              ) : (
                <span className="agency-profile-logo-placeholder">TU LOGO</span>
              )}
            </div>
            <div>
              <strong>Logo comercial</strong>
              <p>PNG, JPG o WebP · máximo 2 MB.</p>
              <label className="agency-profile-upload">
                {uploading ? "Subiendo…" : "Subir o reemplazar logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="agency-profile-grid">
            <label>
              <span>Nombre comercial</span>
              <input value={form.commercialName} onChange={(e) => update("commercialName", e.target.value)} />
            </label>
            <label>
              <span>Asesor / contacto</span>
              <input value={form.advisorName} onChange={(e) => update("advisorName", e.target.value)} />
            </label>
            <label>
              <span>WhatsApp</span>
              <input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="55 0000 0000" />
            </label>
            <label>
              <span>Teléfono</span>
              <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </label>
            <label>
              <span>Correo comercial</span>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </label>
            <label>
              <span>Sitio web</span>
              <input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://…" />
            </label>
            <label>
              <span>Facebook</span>
              <input value={form.facebook} onChange={(e) => update("facebook", e.target.value)} />
            </label>
            <label>
              <span>Instagram</span>
              <input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} />
            </label>
          </div>

          <div className="agency-profile-visibility">
            <label>
              <input type="checkbox" checked={form.showWhatsapp} onChange={(e) => update("showWhatsapp", e.target.checked)} />
              Incluir WhatsApp en mis copys
            </label>
            <label>
              <input type="checkbox" checked={form.showEmail} onChange={(e) => update("showEmail", e.target.checked)} />
              Incluir correo en mis copys
            </label>
          </div>

          <div className="agency-profile-preview">
            <span>Así cerrarán tus copys</span>
            <strong>Reserva con {displayName}</strong>
            {form.showWhatsapp && form.whatsapp ? <p>📲 WhatsApp: {form.whatsapp}</p> : null}
            {form.showEmail && form.email ? <p>✉️ {form.email}</p> : null}
            {form.website ? <p>🌐 {form.website}</p> : null}
          </div>

          <div className="agency-profile-actions">
            <button type="button" className="agency-profile-save" onClick={() => void saveProfile()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {message ? <span className="agency-profile-message">{message}</span> : null}
          </div>
        </div>
      ) : message ? (
        <p className="agency-profile-message compact">{message}</p>
      ) : null}
    </section>
  );
}
