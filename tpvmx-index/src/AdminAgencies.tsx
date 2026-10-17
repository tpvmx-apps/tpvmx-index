import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type AgencyAccount = {
  userId: string;
  agencyName: string;
  email: string;
  role: "admin" | "agency";
  active: boolean;
  createdAt?: string;
  lastSignInAt?: string | null;
};

type AdminResponse = {
  ok: boolean;
  error?: string;
  agencies?: AgencyAccount[];
};

async function adminAction(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<AdminResponse> {
  const { data, error } = await supabase.functions.invoke("index-admin-agencies", {
    body: { action, ...payload },
  });

  if (error) throw new Error(error.message || "No se pudo completar la operación");
  if (!data?.ok) throw new Error(data?.error || "No se pudo completar la operación");

  return data as AdminResponse;
}

function formatLastAccess(value?: string | null) {
  if (!value) return "Nunca";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminAgenciesPanel({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [agencies, setAgencies] = useState<AgencyAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    agencyName: "",
    email: "",
    password: "",
  });

  const loadAgencies = async () => {
    setLoading(true);
    setMessage("");

    try {
      const data = await adminAction("list");
      setAgencies(data.agencies || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pude cargar las agencias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void loadAgencies();
  }, [open]);

  const createAgency = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await adminAction("create", form);
      setForm({ agencyName: "", email: "", password: "" });
      setMessage("Agencia creada ✅ Ya puede entrar a INDEX con ese correo y contraseña.");
      await loadAgencies();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pude crear la agencia");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (agency: AgencyAccount) => {
    const password = window.prompt(
      `Nueva contraseña para ${agency.agencyName || agency.email}\n\nMínimo 8 caracteres:`
    );

    if (password === null) return;
    if (password.length < 8) {
      window.alert("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    const confirmPassword = window.prompt("Repite la nueva contraseña:");
    if (confirmPassword !== password) {
      window.alert("Las contraseñas no coinciden.");
      return;
    }

    try {
      await adminAction("reset_password", {
        userId: agency.userId,
        password,
      });
      window.alert("Contraseña actualizada ✅");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No pude cambiar la contraseña");
    }
  };

  const toggleActive = async (agency: AgencyAccount) => {
    const nextActive = !agency.active;
    const verb = nextActive ? "reactivar" : "desactivar";

    if (
      !window.confirm(
        `¿Seguro que quieres ${verb} el acceso de ${agency.agencyName || agency.email}?`
      )
    ) {
      return;
    }

    try {
      await adminAction("toggle_active", {
        userId: agency.userId,
        active: nextActive,
      });

      setAgencies((current) =>
        current.map((item) =>
          item.userId === agency.userId ? { ...item, active: nextActive } : item
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No pude cambiar el acceso");
    }
  };

  return (
    <>
      <button type="button" style={styles.adminButton} onClick={() => setOpen(true)}>
        Administrar agencias
      </button>

      {open ? (
        <div style={styles.overlay} onMouseDown={() => setOpen(false)}>
          <div style={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>INDEX TPVMX</p>
                <h2 style={styles.title}>Administrar agencias</h2>
                <p style={styles.subtitle}>
                  Crea accesos y controla contraseñas sin tocar código ni hacer deploy.
                </p>
              </div>

              <button type="button" style={styles.closeButton} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <form style={styles.form} onSubmit={createAgency}>
              <input
                style={styles.input}
                placeholder="Nombre de la agencia"
                value={form.agencyName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, agencyName: event.target.value }))
                }
                required
              />
              <input
                style={styles.input}
                type="email"
                placeholder="Correo de acceso"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Contraseña inicial (mín. 8)"
                minLength={8}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
              <button style={styles.createButton} type="submit" disabled={saving}>
                {saving ? "Creando..." : "Crear agencia"}
              </button>
            </form>

            {message ? <div style={styles.message}>{message}</div> : null}

            <div style={styles.listHeader}>
              <strong>Accesos actuales</strong>
              <button
                type="button"
                style={styles.refreshButton}
                onClick={() => void loadAgencies()}
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div style={styles.list}>
              {agencies.map((agency) => {
                const isSelf = agency.userId === currentUserId;

                return (
                  <div style={styles.row} key={agency.userId}>
                    <div style={styles.accountInfo}>
                      <div style={styles.nameLine}>
                        <strong>{agency.agencyName || agency.email}</strong>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(agency.active ? styles.activeBadge : styles.inactiveBadge),
                          }}
                        >
                          {agency.active ? "ACTIVO" : "INACTIVO"}
                        </span>
                        {agency.role === "admin" ? (
                          <span style={styles.adminBadge}>ADMIN</span>
                        ) : null}
                      </div>
                      <span style={styles.email}>{agency.email}</span>
                      <small style={styles.lastAccess}>
                        Último acceso: {formatLastAccess(agency.lastSignInAt)}
                      </small>
                    </div>

                    <div style={styles.rowActions}>
                      <button
                        type="button"
                        style={styles.passwordButton}
                        onClick={() => void resetPassword(agency)}
                      >
                        Cambiar password
                      </button>

                      {!isSelf && agency.role !== "admin" ? (
                        <button
                          type="button"
                          style={agency.active ? styles.disableButton : styles.enableButton}
                          onClick={() => void toggleActive(agency)}
                        >
                          {agency.active ? "Desactivar" : "Reactivar"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {!loading && agencies.length === 0 ? (
                <div style={styles.empty}>No hay cuentas para mostrar.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const styles = {
  adminButton: {
    border: "1px solid #9fd8d5",
    background: "#e8f8f7",
    color: "#0f6faf",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(12, 38, 58, 0.52)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "5vh 18px",
    overflowY: "auto",
  },
  modal: {
    width: "100%",
    maxWidth: "980px",
    background: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 24px 70px rgba(15,49,80,0.25)",
    border: "1px solid #d9ecef",
    padding: "24px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px",
  },
  eyebrow: {
    margin: 0,
    color: "#d81b60",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  title: {
    margin: "5px 0 4px",
    color: "#0f3150",
    fontSize: "28px",
  },
  subtitle: {
    margin: 0,
    color: "#587184",
    fontSize: "14px",
  },
  closeButton: {
    border: "none",
    background: "#f0f6f7",
    color: "#476479",
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "18px",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1.4fr 1fr auto",
    gap: "10px",
    padding: "16px",
    borderRadius: "18px",
    background: "#f6fbfb",
    border: "1px solid #d8ecee",
  },
  input: {
    minWidth: 0,
    border: "1px solid #b9d8dc",
    borderRadius: "12px",
    padding: "12px 13px",
    fontSize: "14px",
    color: "#17354a",
    background: "#ffffff",
  },
  createButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#d81b60",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  message: {
    marginTop: "12px",
    padding: "11px 13px",
    background: "#eef8f7",
    border: "1px solid #cfe8e4",
    borderRadius: "12px",
    color: "#285d59",
    fontSize: "13px",
    fontWeight: 700,
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    margin: "22px 0 10px",
    color: "#0f3150",
  },
  refreshButton: {
    border: "none",
    background: "transparent",
    color: "#0f6faf",
    fontWeight: 800,
    cursor: "pointer",
  },
  list: {
    display: "grid",
    gap: "9px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "13px 14px",
    border: "1px solid #e0ecee",
    borderRadius: "14px",
    background: "#ffffff",
  },
  accountInfo: {
    minWidth: 0,
    display: "grid",
    gap: "3px",
  },
  nameLine: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    flexWrap: "wrap",
    color: "#17354a",
  },
  email: {
    color: "#547085",
    fontSize: "13px",
  },
  lastAccess: {
    color: "#7b909f",
    fontSize: "11px",
  },
  statusBadge: {
    borderRadius: "999px",
    padding: "3px 7px",
    fontSize: "9px",
    fontWeight: 900,
  },
  activeBadge: {
    background: "#e8f7f0",
    color: "#18704d",
  },
  inactiveBadge: {
    background: "#fff0f3",
    color: "#ad1e50",
  },
  adminBadge: {
    borderRadius: "999px",
    padding: "3px 7px",
    fontSize: "9px",
    fontWeight: 900,
    background: "#e7f2fb",
    color: "#0f6faf",
  },
  rowActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  passwordButton: {
    border: "1px solid #a8d8df",
    background: "#eef8f9",
    color: "#0f6faf",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
  },
  disableButton: {
    border: "1px solid #efbfd0",
    background: "#fff2f6",
    color: "#b11658",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
  },
  enableButton: {
    border: "1px solid #b8dfca",
    background: "#effaf4",
    color: "#18704d",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
  },
  empty: {
    padding: "18px",
    textAlign: "center",
    color: "#6c8292",
  },
} satisfies Record<string, import("react").CSSProperties>;
