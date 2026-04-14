import { useState } from "react";
import type { CSSProperties } from "react";
type Tour = Record<string, string | undefined>;

const SHEET_URL =
  "https://opensheet.elk.sh/1hNq4eF9r1-7ze5Jdhls4sZ3pS24Z52FafcOpNIrShhw/CONTROL";

function normalizarClave(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function getField(tour: Tour, posibles: string[]): string {
  const entradas = Object.entries(tour);
  const mapa = new Map<string, string>();

  entradas.forEach(([k, v]) => {
    mapa.set(normalizarClave(k), String(v ?? ""));
  });

  for (const p of posibles) {
    const val = mapa.get(normalizarClave(p));
    if (val !== undefined && String(val).trim() !== "") {
      return String(val);
    }
  }

  return "";
}

function esSinFecha(valor: string) {
  const t = String(valor || "").toLowerCase().trim();
  return (
    !t ||
    t.includes("definir") ||
    t.includes("pendiente") ||
    t.includes("pendientes") ||
    t.includes("proximamente") ||
    t.includes("próximamente")
  );
}

async function copiarTexto(texto: string, etiqueta: string) {
  if (!texto || !texto.trim()) {
    alert(`No hay ${etiqueta} disponible para copiar.`);
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    alert(`${etiqueta} copiado ✅`);
  } catch (error) {
    console.error(error);
    alert(`No pude copiar el ${etiqueta}.`);
  }
}

function formatearMoneda(valor: string) {
  const limpio = String(valor || "").trim();
  if (!limpio) return "—";
  return limpio.startsWith("$") ? limpio : `$${limpio}`;
}

type ActionButtonProps = {
  label: string;
  kind: "primary" | "secondary" | "ghost";
  onClick: () => void;
};

function ActionButton({ label, kind, onClick }: ActionButtonProps) {
  const baseStyle =
    kind === "primary"
      ? styles.primaryButton
      : kind === "secondary"
      ? styles.secondaryButton
      : styles.ghostButton;

  const hoverStyle =
    kind === "primary"
      ? styles.primaryButtonHover
      : kind === "secondary"
      ? styles.secondaryButtonHover
      : styles.ghostButtonHover;

  return (
    <button
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, hoverStyle);
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, baseStyle);
      }}
    >
      {label}
    </button>
  );
}

function App() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");

  useEffect(() => {
    const cargarTours = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error("No se pudo leer Google Sheets");

        const data = await res.json();
        console.log("Primer tour:", data?.[0]);
        console.log("Encabezados del primer tour:", Object.keys(data?.[0] || {}));

        setTours(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError(
          "No pude cargar los tours desde Google Sheets. Revisa que el archivo esté compartido y que la hoja se llame CONTROL."
        );
      } finally {
        setLoading(false);
      }
    };

    cargarTours();
  }, []);

  const estados = useMemo(() => {
    return Array.from(
      new Set(
        tours
          .map((tour) => getField(tour, ["ESTADO"]))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [tours]);

  const toursFiltrados = useMemo(() => {
    const filtrados = tours.filter((tour) => {
      const texto = [
        getField(tour, ["CLAVE"]),
        getField(tour, ["TOUR"]),
        getField(tour, ["ESTADO"]),
        getField(tour, ["Fecha Bot", "FECHA BOT", "FECHA_BOT", "PRÓXIMAS_FECHAS"]),
      ]
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = texto.includes(busqueda.toLowerCase());
      const estadoTour = getField(tour, ["ESTADO"]);
      const coincideEstado = estado === "" || estadoTour === estado;

      return coincideBusqueda && coincideEstado;
    });

    return filtrados.sort((a, b) => {
      const fechaA = getField(a, [
        "Fecha Bot",
        "FECHA BOT",
        "FECHA_BOT",
        "PRÓXIMAS_FECHAS",
      ]);
      const fechaB = getField(b, [
        "Fecha Bot",
        "FECHA BOT",
        "FECHA_BOT",
        "PRÓXIMAS_FECHAS",
      ]);

      const sinFechaA = esSinFecha(fechaA);
      const sinFechaB = esSinFecha(fechaB);

      if (sinFechaA && !sinFechaB) return 1;
      if (!sinFechaA && sinFechaB) return -1;

      const tourA = getField(a, ["TOUR"]);
      const tourB = getField(b, ["TOUR"]);

      return tourA.localeCompare(tourB, "es", { sensitivity: "base" });
    });
  }, [tours, busqueda, estado]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
            <h1 style={styles.title}>INDEX TPVMX</h1>
            <p style={styles.subtitle}>
              Catálogo interno para ventas, diseño y operación.
            </p>
          </div>
        </div>

        <div style={styles.filtersBox}>
          <input
            type="text"
            placeholder="Buscar por tour, clave o fecha..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={styles.input}
          />

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={styles.select}
          >
            <option value="">Todos los estados</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaBadge}>
            Tours encontrados: {toursFiltrados.length}
          </span>
          <span style={styles.metaBadgeSecondary}>Fuente: CONTROL</span>
        </div>

        {loading && <div style={styles.infoBox}>Cargando tours...</div>}

        {!loading && error && <div style={styles.errorBox}>{error}</div>}

        {!loading && !error && toursFiltrados.length === 0 && (
          <div style={styles.infoBox}>No encontré tours con esos filtros.</div>
        )}

        {!loading && !error && toursFiltrados.length > 0 && (
          <div style={styles.grid}>
            {toursFiltrados.map((tour, i) => {
              const clave = getField(tour, ["CLAVE"]);
              const nombre = getField(tour, ["TOUR"]) || "Tour sin nombre";
              const estadoTour = getField(tour, ["ESTADO"]) || "Sin estado";
              const descripcion =
                getField(tour, [
                  "DESCRIPCIÓN BREVE",
                  "DESCRIPCION BREVE",
                  "DESCRIPCIÓN_BREVE",
                  "DESCRIPCION_BREVE",
                  "Q",
                ]) || "";

              const fechas =
                getField(tour, [
                  "Fecha Bot",
                  "FECHA BOT",
                  "FECHA_BOT",
                  "PRÓXIMAS_FECHAS",
                  "PROXIMAS_FECHAS",
                ]) || "Por definir";

              const precio = formatearMoneda(
                getField(tour, ["PRECIO", "O"])
              );

              const reserva = formatearMoneda(
                getField(tour, ["RESERVA", "P"])
              );

              const copyLimpio =
                getField(tour, [
                  "COPYS LIMPIOS",
                  "COPYS LIMPIOS",
                  "COPY LIMPIO",
                  "COPY LIMPIOS",
                  "COPY_DISEÑO",
                  "COPY DISENO",
                  "COPY_DISENO",
                  "AM",
                ]) || "";

              const copyEmojis =
                getField(tour, [
                  "COPYS EMOJIS",
                  "COPYS EMOJIS",
                  "COPY EMOJIS",
                  "COPY_EMOJIS",
                  "COPY EMOJI",
                  "COPY_EMOJI",
                  "AL",
                ]) || "";

              const resumen = [
                nombre,
                descripcion,
                `Estado: ${estadoTour}`,
                `Próximas fechas:\n${fechas}`,
                `Precio: ${precio}`,
                `Reserva con: ${reserva}`,
              ]
                .filter(Boolean)
                .join("\n\n");

              return (
                <div
                  key={`${clave || "tour"}-${i}`}
                  style={styles.card}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, styles.cardHover);
                  }}
                  onMouseLeave={(e) => {
                    Object.assign(e.currentTarget.style, styles.card);
                  }}
                >
                  <div style={styles.cardTop}>
                    <span style={styles.claveBadge}>{clave || "—"}</span>
                    <span style={styles.estadoBadge}>{estadoTour}</span>
                  </div>

                  <h2 style={styles.cardTitle}>{nombre}</h2>

                  {descripcion ? (
                    <p style={styles.cardDescription}>{descripcion}</p>
                  ) : null}

                  <div style={styles.block}>
                    <p style={styles.label}>Próximas fechas</p>
                    <p style={styles.valuePre}>{fechas}</p>
                  </div>

                  <div style={styles.priceRow}>
                    <div style={styles.priceBox}>
                      <span style={styles.priceLabel}>Precio</span>
                      <span style={styles.priceValue}>{precio}</span>
                    </div>

                    <div style={styles.priceBox}>
                      <span style={styles.priceLabel}>Reserva</span>
                      <span style={styles.priceValue}>{reserva}</span>
                    </div>
                  </div>

                  <div style={styles.actions3}>
                    <ActionButton
                      kind="primary"
                      label="Copiar copy limpio"
                      onClick={() => copiarTexto(copyLimpio, "copy limpio")}
                    />

                    <ActionButton
                      kind="secondary"
                      label="Copiar copy emojis"
                      onClick={() => copiarTexto(copyEmojis, "copy con emojis")}
                    />

                    <ActionButton
                      kind="ghost"
                      label="Copiar resumen"
                      onClick={() => copiarTexto(resumen, "resumen")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #f4fbfb 0%, #ffffff 42%, #eef7fb 100%)",
    fontFamily:
      "Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "24px",
    color: "#17354a",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "16px",
    marginBottom: "24px",
  },
  brand: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#d81b60",
    fontWeight: 800,
  },
  title: {
    margin: "6px 0 6px 0",
    fontSize: "38px",
    color: "#0f6faf",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: "#547085",
    fontSize: "15px",
  },
  filtersBox: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "12px",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 10px 28px rgba(18, 50, 74, 0.06)",
    border: "1px solid #cfe9ea",
    marginBottom: "16px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #b9d8dc",
    fontSize: "15px",
    outline: "none",
    color: "#17354a",
    background: "#fbfefe",
  },
  select: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #b9d8dc",
    fontSize: "15px",
    outline: "none",
    background: "#fbfefe",
    color: "#17354a",
  },
  metaRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  metaBadge: {
    background: "#f9dbe8",
    color: "#b11658",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 800,
  },
  metaBadgeSecondary: {
    background: "#d8eef2",
    color: "#0f6faf",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 800,
  },
  infoBox: {
    background: "#ffffff",
    border: "1px solid #d5e8ea",
    borderRadius: "18px",
    padding: "18px",
    color: "#486376",
  },
  errorBox: {
    background: "#fff1f4",
    border: "1px solid #f4c4d6",
    borderRadius: "18px",
    padding: "18px",
    color: "#b11658",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "26px",
    padding: "20px",
    boxShadow: "0 10px 30px rgba(18, 50, 74, 0.07)",
    border: "1px solid #d9ecef",
    transform: "translateY(0)",
    transition: "all 0.2s ease",
  },
  cardHover: {
    background: "#ffffff",
    borderRadius: "26px",
    padding: "20px",
    boxShadow: "0 16px 34px rgba(18, 50, 74, 0.11)",
    border: "1px solid #bfe2e7",
    transform: "translateY(-4px)",
    transition: "all 0.2s ease",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    gap: "10px",
  },
  claveBadge: {
    background: "#d81b60",
    color: "#fff",
    borderRadius: "999px",
    padding: "7px 13px",
    fontSize: "12px",
    fontWeight: 800,
    boxShadow: "0 6px 14px rgba(216, 27, 96, 0.18)",
  },
  estadoBadge: {
    background: "#d8eef2",
    color: "#0f6faf",
    borderRadius: "999px",
    padding: "7px 13px",
    fontSize: "12px",
    fontWeight: 800,
  },
  cardTitle: {
    margin: "0 0 10px 0",
    fontSize: "24px",
    lineHeight: 1.18,
    color: "#0f3150",
    fontWeight: 800,
  },
  cardDescription: {
    margin: "0 0 16px 0",
    color: "#4f6b7e",
    lineHeight: 1.5,
    fontSize: "14px",
  },
  block: {
    marginBottom: "16px",
  },
  label: {
    margin: "0 0 6px 0",
    fontSize: "13px",
    fontWeight: 800,
    color: "#d81b60",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  valuePre: {
    margin: 0,
    whiteSpace: "pre-line",
    color: "#0f3150",
    fontSize: "15px",
    lineHeight: 1.45,
  },
  priceRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "16px",
  },
  priceBox: {
    background: "#eef7f8",
    borderRadius: "18px",
    padding: "14px",
    border: "1px solid #d7eaed",
  },
  priceLabel: {
    display: "block",
    fontSize: "12px",
    color: "#0f6faf",
    fontWeight: 800,
    marginBottom: "5px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  priceValue: {
    fontSize: "20px",
    color: "#0f3150",
    fontWeight: 800,
  },
  actions3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "10px",
  },
  primaryButton: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#d81b60",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(216, 27, 96, 0.16)",
    transition: "all 0.2s ease",
  },
  primaryButtonHover: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#b11658",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 20px rgba(177, 22, 88, 0.22)",
    transform: "translateY(-2px)",
    transition: "all 0.2s ease",
  },
  secondaryButton: {
    border: "1px solid #a8d8df",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#dff2f4",
    color: "#0f6faf",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  secondaryButtonHover: {
    border: "1px solid #79bcc8",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#cdebf0",
    color: "#0a5f95",
    fontWeight: 800,
    cursor: "pointer",
    transform: "translateY(-2px)",
    transition: "all 0.2s ease",
  },
  ghostButton: {
    border: "1px solid #f2c35a",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#fff8df",
    color: "#b66a00",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  ghostButtonHover: {
    border: "1px solid #e8b139",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#fff1c7",
    color: "#9b5800",
    fontWeight: 800,
    cursor: "pointer",
    transform: "translateY(-2px)",
    transition: "all 0.2s ease",
  },
};

export default App;