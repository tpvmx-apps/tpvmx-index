import { useMemo, useState } from "react";

type AvailabilityRow = Record<string, string | undefined>;

type Props = {
  rows: AvailabilityRow[];
  initialKey?: string;
};

function normalize(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeKey(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function parseDate(value: string) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
}

function statusKind(value: string) {
  const text = normalize(value);
  if (text.includes("no disponible") || text.includes("agotado") || text.includes("lleno")) {
    return "closed";
  }
  if (text.includes("pocos")) return "low";
  return "high";
}

function cleanStatus(value: string) {
  return String(value || "")
    .replace(/[🔴🟡🟢]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function AvailabilityPage({ rows, initialKey = "" }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "low" | "closed">("all");

  const safeRows = useMemo(() => {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const requestedKey = initialKey && initialKey !== "1" ? normalizeKey(initialKey) : "";

    return rows
      .map((row) => {
        const date = String(row.FECHA || "").trim();
        const dateMs = parseDate(date);
        return {
          date,
          dateMs,
          tour: String(row.TOURS || row.TOUR || "").trim(),
          status: String(row.ESTATUS || "").trim(),
          seats: String(row["LUGARES DISPONIBLES"] || "").trim(),
          key: String(row.CLAVE || "").trim(),
        };
      })
      .filter((item) => item.date && item.dateMs !== null && item.dateMs >= todayUtc)
      .filter((item) => !requestedKey || normalizeKey(item.key) === requestedKey)
      .sort((a, b) => (a.dateMs ?? Number.MAX_SAFE_INTEGER) - (b.dateMs ?? Number.MAX_SAFE_INTEGER));
  }, [rows, initialKey]);

  const filteredRows = useMemo(() => {
    const needle = normalize(query);
    return safeRows.filter((item) => {
      const kind = statusKind(item.status);
      const matchesFilter = filter === "all" || kind === filter;
      const matchesQuery =
        !needle ||
        normalize([item.tour, item.key, item.date].join(" ")).includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [safeRows, query, filter]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <a href={window.location.pathname} style={styles.backLink}>
            ← Volver al catálogo
          </a>
          <span style={styles.privateBadge}>🔒 Acceso privado para agencias</span>
        </div>

        <section style={styles.hero}>
          <img src="/logoweb.png" alt="Tu Próximo Viaje MX" style={styles.logo} />
          <div>
            <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
            <h1 style={styles.title}>Disponibilidad de salidas</h1>
            <p style={styles.subtitle}>
              Consulta fechas y lugares disponibles sin salir de INDEX.
            </p>
          </div>
        </section>

        <section style={styles.filters}>
          <input
            type="text"
            placeholder="Buscar tour, clave o fecha..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={styles.input}
          />

          <div style={styles.filterRow}>
            <FilterButton label="Todas" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterButton label="🟢 Alta" active={filter === "high"} onClick={() => setFilter("high")} />
            <FilterButton label="🟡 Pocos espacios" active={filter === "low"} onClick={() => setFilter("low")} />
            <FilterButton label="🔴 No disponible" active={filter === "closed"} onClick={() => setFilter("closed")} />
          </div>
        </section>

        <div style={styles.meta}>{filteredRows.length} salidas encontradas</div>

        {filteredRows.length === 0 ? (
          <div style={styles.empty}>No hay salidas que coincidan con los filtros.</div>
        ) : (
          <div style={styles.grid}>
            {filteredRows.map((item, index) => {
              const kind = statusKind(item.status);
              const visual = statusStyles[kind];

              return (
                <article key={`${item.key}-${item.date}-${index}`} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.date}>📅 {item.date}</div>
                      <h2 style={styles.tourTitle}>{item.tour || "Tour sin nombre"}</h2>
                      {item.key ? <span style={styles.keyBadge}>{item.key}</span> : null}
                    </div>
                    <span style={{ ...styles.statusBadge, ...visual.badge }}>
                      {visual.dot} {cleanStatus(item.status) || visual.fallback}
                    </span>
                  </div>

                  <div style={styles.seatsBox}>
                    <span style={styles.seatsLabel}>Lugares disponibles</span>
                    <strong style={{ ...styles.seatsValue, color: visual.color }}>
                      {item.seats || "Consultar"}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p style={styles.note}>
          La disponibilidad puede cambiar conforme se registran nuevas reservaciones.
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.filterButton,
        ...(active ? styles.filterButtonActive : {}),
      }}
    >
      {label}
    </button>
  );
}

const statusStyles = {
  high: {
    dot: "🟢",
    fallback: "DISPONIBILIDAD ALTA",
    color: "#167452",
    badge: {
      background: "#eefaf6",
      color: "#167452",
      borderColor: "#bfe8d6",
    },
  },
  low: {
    dot: "🟡",
    fallback: "POCOS ESPACIOS",
    color: "#8d6400",
    badge: {
      background: "#fff8df",
      color: "#8d6400",
      borderColor: "#f2d98c",
    },
  },
  closed: {
    dot: "🔴",
    fallback: "NO DISPONIBLE",
    color: "#a9194b",
    badge: {
      background: "#fff1f4",
      color: "#a9194b",
      borderColor: "#f4c4d6",
    },
  },
} as const;

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f4fbfb 0%, #ffffff 42%, #eef7fb 100%)",
    padding: "24px",
    color: "#17354a",
    fontFamily: "Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap" as const,
    marginBottom: "16px",
  },
  backLink: {
    color: "#0f6faf",
    fontWeight: 800,
    textDecoration: "none",
  },
  privateBadge: {
    background: "#eef8f8",
    border: "1px solid #cfe8e6",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#167452",
  },
  hero: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    padding: "24px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #0f8d87 0%, #19b8b4 100%)",
    boxShadow: "0 14px 32px rgba(15,49,80,.10)",
    marginBottom: "18px",
  },
  logo: {
    width: "108px",
    height: "108px",
    objectFit: "contain",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "6px",
  },
  brand: {
    margin: 0,
    color: "#e8ffff",
    fontWeight: 800,
    fontSize: "12px",
    letterSpacing: ".16em",
  },
  title: {
    margin: "6px 0",
    color: "#ffffff",
    fontSize: "36px",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: "#ecffff",
    fontSize: "15px",
  },
  filters: {
    background: "#ffffff",
    border: "1px solid #d9ecef",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 10px 28px rgba(18,50,74,.06)",
    marginBottom: "14px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #b9d8dc",
    fontSize: "15px",
    outline: "none",
    color: "#17354a",
    background: "#fbfefe",
  },
  filterRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
    marginTop: "12px",
  },
  filterButton: {
    border: "1px solid #d7e7ea",
    borderRadius: "999px",
    padding: "10px 14px",
    background: "#ffffff",
    color: "#17354a",
    fontWeight: 800,
    cursor: "pointer",
  },
  filterButtonActive: {
    background: "#0f3150",
    color: "#ffffff",
    borderColor: "#0f3150",
  },
  meta: {
    margin: "12px 0 16px",
    color: "#547085",
    fontSize: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d9ecef",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 10px 28px rgba(18,50,74,.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
  },
  date: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#547085",
  },
  tourTitle: {
    margin: "7px 0 8px",
    fontSize: "20px",
    lineHeight: 1.2,
    color: "#0f3150",
  },
  keyBadge: {
    display: "inline-block",
    background: "#f9dbe8",
    color: "#b11658",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 800,
  },
  statusBadge: {
    flexShrink: 0,
    border: "1px solid",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "11px",
    fontWeight: 800,
    textAlign: "center" as const,
    maxWidth: "150px",
  },
  seatsBox: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "16px",
    background: "#f5f8fa",
    border: "1px solid #edf1f3",
  },
  seatsLabel: {
    display: "block",
    color: "#547085",
    fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: ".04em",
    marginBottom: "5px",
  },
  seatsValue: {
    fontSize: "26px",
    fontWeight: 800,
  },
  empty: {
    background: "#ffffff",
    border: "1px solid #d9ecef",
    borderRadius: "18px",
    padding: "20px",
    color: "#547085",
  },
  note: {
    margin: "20px 0 0",
    color: "#718899",
    fontSize: "12px",
    textAlign: "center" as const,
  },
} satisfies Record<string, import("react").CSSProperties>;
