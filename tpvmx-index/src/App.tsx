import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { AvailabilityPage } from "./AvailabilityPage";
import { AgencyProfile, type AgencyProfileData } from "./AgencyProfile";

type Tour = Record<string, string | undefined>;
type CanvaMes = Record<string, string | undefined>;
type AvailabilityRow = Record<string, string | undefined>;
type AvailabilityItem = {
  date: string;
  status: string;
  seats: string;
  dateMs: number | null;
};
type GalleryItem = {
  tourKey: string;
  tourName?: string;
  images: string[];
};

const SHEET_URL =
  "https://opensheet.elk.sh/1hNq4eF9r1-7ze5Jdhls4sZ3pS24Z52FafcOpNIrShhw/CONTROL";

const CANVA_URL =
  "https://opensheet.elk.sh/1hNq4eF9r1-7ze5Jdhls4sZ3pS24Z52FafcOpNIrShhw/CANVA_MESES";

const GALLERY_API_URL =
  "https://tuproximoviaje.mx/api/gallery";

const GALLERY_BACKUP_URL =
  "https://opensheet.elk.sh/1hNq4eF9r1-7ze5Jdhls4sZ3pS24Z52FafcOpNIrShhw/GALERIA_WEB_BACKUP";

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


function normalizarTexto(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatAvailabilityDateForUi(value: string) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "").trim();
  const [, yyyy, mm, dd] = match;
  return `${Number(dd)}/${Number(mm)}/${yyyy}`;
}

function parseAvailabilityDate(value: string) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
}

function formatAvailabilityDate(value: string) {
  const timestamp = parseAvailabilityDate(value);
  if (timestamp === null) return value;

  const formatted = new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));

  return formatted
    .replace(/\./g, "")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function disponibilidadVisual(status: string) {
  const text = normalizarTexto(status);

  if (
    text.includes("no disponible") ||
    text.includes("agotado") ||
    text.includes("lleno")
  ) {
    return {
      icon: "🔴",
      background: "#fff1f4",
      border: "#f4c4d6",
      color: "#a9194b",
    };
  }

  if (text.includes("pocos")) {
    return {
      icon: "🟡",
      background: "#fff8df",
      border: "#f2d98c",
      color: "#8d6400",
    };
  }

  return {
    icon: "🟢",
    background: "#eefaf6",
    border: "#bfe8d6",
    color: "#167452",
  };
}

function disponibilidadTexto(item: AvailabilityItem) {
  const status = normalizarTexto(item.status);

  if (
    status.includes("no disponible") ||
    status.includes("agotado") ||
    status.includes("lleno")
  ) {
    return "Sin lugares";
  }

  if (item.seats) {
    return `${item.seats} lugares disponibles`;
  }

  return item.status || "Consultar disponibilidad";
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
    await navigator.clipboard.writeText(texto);
    alert(`${etiqueta} copiado ✅`);
  } catch (error) {
    console.error(error);
    alert(`No pude copiar el ${etiqueta}.`);
  }
}

function formatearMoneda(valor: string) {
  const limpio = String(valor || "").trim();
  if (!limpio) return "—";
  return limpio.startsWith("$") ? limpio : `${limpio}`;
}

function personalizarCopyAgencia(texto: string, profile: AgencyProfileData | null) {
  const base = String(texto || "").trim();
  if (!base || !profile) return base;

  const nombre = profile.commercialName || profile.agencyName;
  const cierre = [
    nombre ? `Informes y reservaciones con ${nombre}` : "",
    profile.showWhatsapp && profile.whatsapp ? `📲 WhatsApp: ${profile.whatsapp}` : "",
    profile.showEmail && profile.email ? `✉️ ${profile.email}` : "",
    profile.website ? `🌐 ${profile.website}` : "",
  ].filter(Boolean);

  return cierre.length > 0 ? `${base}\n\n${cierre.join("\n")}` : base;
}

type ActionButtonProps = {
  label: string;
  kind: "primary" | "secondary";
  onClick: () => void;
};

function ActionButton({ label, kind, onClick }: ActionButtonProps) {
  const baseStyle =
    kind === "primary" ? styles.primaryButton : styles.secondaryButton;

  const hoverStyle =
    kind === "primary"
      ? styles.primaryButtonHover
      : styles.secondaryButtonHover;

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


function GalleryPage({
  tourName,
  images,
}: {
  tourName: string;
  images: string[];
}) {
  const cleanImages = Array.from(
    new Set(images.map((image) => String(image || "").trim()).filter(Boolean))
  );

  return (
    <div style={styles.galleryPage}>
      <div style={styles.galleryPageContainer}>
        <a href={window.location.pathname} style={styles.galleryBackLink}>
          ← Volver al INDEX
        </a>

        <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
        <h1 style={styles.galleryPageTitle}>Galería de fotos</h1>
        <p style={styles.galleryPageSubtitle}>{tourName}</p>

        {cleanImages.length === 0 ? (
          <div style={styles.infoBox}>
            Este tour todavía no tiene fotografías disponibles.
          </div>
        ) : (
          <div style={styles.galleryGrid}>
            {cleanImages.map((image, index) => (
              <a
                key={image}
                href={image}
                target="_blank"
                rel="noreferrer"
                style={styles.galleryTile}
              >
                <img
                  src={image}
                  alt={`${tourName} · foto ${index + 1}`}
                  style={styles.galleryTileImage}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoadingLogin(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError("Correo o contraseña incorrectos.");
    }

    setLoadingLogin(false);
  };

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginCard}>
        <img
          src="/logoweb.png"
          alt="Tu Próximo Viaje MX"
          style={styles.loginLogo}
        />

        <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
        <h1 style={styles.loginTitle}>Acceso para agencias</h1>
        <p style={styles.loginSubtitle}>
          Tu espacio privado para consultar producto, disponibilidad y materiales de venta.
        </p>

        <form onSubmit={handleLogin} style={styles.loginForm}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          <button type="submit" style={styles.loginButton} disabled={loadingLogin}>
            {loadingLogin ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {loginError ? <p style={styles.loginError}>{loginError}</p> : null}
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [plantillasCanva, setPlantillasCanva] = useState<CanvaMes[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<AvailabilityRow[]>([]);
  const [galerias, setGalerias] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [descripcionesAbiertas, setDescripcionesAbiertas] = useState<Record<string, boolean>>({});
  const [fechasAbiertas, setFechasAbiertas] = useState<Record<string, boolean>>({});
  const [accessStatus, setAccessStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [agencyName, setAgencyName] = useState("");
  const [agencyProfile, setAgencyProfile] = useState<AgencyProfileData | null>(null);
  const galleryKey = useMemo(
    () => new URLSearchParams(window.location.search).get("galeria") || "",
    []
  );
  const availabilityKey = useMemo(
    () => new URLSearchParams(window.location.search).get("disponibilidad") || "",
    []
  );

  useEffect(() => {
    let alive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (alive) setSession(currentSession);
    });

    const bootstrapAuth = async () => {
      const hash = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const tokenHash = hash.get("tpv_sso");

      if (tokenHash) {
        // Remove the one-time credential from the browser URL immediately.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );

        // A browser may still hold a stale INDEX refresh token from a prior
        // session. Stop automatic refresh and clear only the local INDEX
        // session before redeeming the fresh one-time handoff.
        supabase.auth.stopAutoRefresh();

        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (signOutError) {
          console.warn("No se pudo limpiar la sesión local anterior", signOutError);
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "email",
        });

        if (error) {
          console.error("No se pudo completar el acceso desde Mi TPVMX", error);
          if (alive) setSession(null);
          supabase.auth.startAutoRefresh();
          return;
        }

        if (data.session) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (setSessionError) {
            console.error(
              "No se pudo fijar la sesión recibida desde Mi TPVMX",
              setSessionError
            );
          }
        }

        supabase.auth.startAutoRefresh();

        if (alive) {
          setSession(data.session ?? null);
        }

        return;
      }

      const { data } = await supabase.auth.getSession();
      if (alive) setSession(data.session);
    };

    void bootstrapAuth();

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAccessStatus("checking");
      setAgencyName("");
      setAgencyProfile(null);
      return;
    }

    let alive = true;
    setAccessStatus("checking");

    supabase
      .from("index_agencies")
      .select("agency_name,active")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;

        if (error || !data || data.active !== true) {
          if (error) console.error("No se pudo validar la agencia", error);
          setAccessStatus("denied");
          setAgencyName("");
          return;
        }

        setAgencyName(String(data.agency_name || "").trim());
        setAccessStatus("allowed");
      });

    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || accessStatus !== "allowed") return;

    const cargarTours = async () => {
  try {
    setLoading(true);
    setError("");

    const [toursRes, canvaRes, availabilityResult] = await Promise.all([
      fetch(SHEET_URL),
      fetch(CANVA_URL),
      supabase
        .from("index_availability")
        .select("fecha,tour,estatus,lugares_disponibles,clave,quorum_alcanzado")
        .order("fecha", { ascending: true }),
    ]);

    if (!toursRes.ok) throw new Error("No se pudo leer Google Sheets");
    if (!canvaRes.ok) throw new Error("No se pudo leer la hoja CANVA_MESES");

    const toursData = await toursRes.json();
    const canvaData = await canvaRes.json();

    setTours(Array.isArray(toursData) ? toursData : []);
    setPlantillasCanva(Array.isArray(canvaData) ? canvaData : []);

    if (availabilityResult.error) {
      console.warn("No se pudo cargar la disponibilidad privada.", availabilityResult.error);
      setDisponibilidad([]);
    } else {
      const availabilityData = (availabilityResult.data || []).map((row) => ({
        FECHA: formatAvailabilityDateForUi(String(row.fecha || "")),
        TOURS: String(row.tour || ""),
        ESTATUS: String(row.estatus || ""),
        "LUGARES DISPONIBLES": String(row.lugares_disponibles ?? ""),
        CLAVE: String(row.clave || ""),
        "QUORUM ALCANZADO": row.quorum_alcanzado ? "SI" : "NO",
      }));

      setDisponibilidad(availabilityData);
    }

    try {
      const galleryRes = await fetch(GALLERY_API_URL);

      if (galleryRes.ok) {
        const galleryData = await galleryRes.json();
        const galleryItems = Array.isArray(galleryData?.galleries)
          ? galleryData.galleries
          : [];

        setGalerias(galleryItems);
      } else {
        throw new Error("Feed maestro de galerías no disponible");
      }
    } catch (galleryError) {
      console.warn(
        "No se pudo cargar el feed maestro; usando respaldo de galerías.",
        galleryError
      );

      try {
        const backupRes = await fetch(GALLERY_BACKUP_URL);
        if (!backupRes.ok) throw new Error("Respaldo de galerías no disponible");

        const backupData = await backupRes.json();
        const backupRows = Array.isArray(backupData) ? backupData : [];

        setGalerias(
          backupRows
            .map((row: Tour) => ({
              tourKey: getField(row, ["CLAVE"]),
              tourName: getField(row, ["TOUR"]),
              images: [1, 2, 3, 4, 5]
                .map((photoIndex) =>
                  getField(row, [
                    `FOTO_${photoIndex}`,
                    `FOTO ${photoIndex}`,
                  ])
                )
                .filter(Boolean),
            }))
            .filter((item: GalleryItem) => item.tourKey)
        );
      } catch (backupError) {
        console.warn("Tampoco se pudo cargar el respaldo de galerías.", backupError);
        setGalerias([]);
      }
    }
  } catch (err) {
    console.error(err);
    setError(
      "No pude cargar los tours o las plantillas desde Google Sheets."
    );
  } finally {
    setLoading(false);
  }
};

    void cargarTours();
  }, [accessStatus, session]);

  const estados = useMemo(() => {
    return Array.from(
      new Set(tours.map((tour) => getField(tour, ["ESTADO"])).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [tours]);
   const plantillasActivas = useMemo(() => {
  return plantillasCanva
    .filter((item) => {
      const activo = (item.ACTIVO || "").toUpperCase().trim();
      const link = (item.LINK || "").trim();
      return activo === "SI" && link !== "";
    })
    .sort((a, b) => {
      const ordenA = Number(a.ORDEN || 999);
      const ordenB = Number(b.ORDEN || 999);
      return ordenA - ordenB;
    });
}, [plantillasCanva]);
  const galeriasPorClave = useMemo(() => {
    const mapa = new Map<string, string[]>();

    galerias.forEach((item) => {
      const key = normalizarClave(item.tourKey);
      if (key) mapa.set(key, Array.isArray(item.images) ? item.images : []);
    });

    return mapa;
  }, [galerias]);

  const disponibilidadPorClave = useMemo(() => {
    const mapa = new Map<string, AvailabilityItem[]>();
    const todayUtc = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    );

    disponibilidad.forEach((row) => {
      const key = normalizarClave(String(row.CLAVE || ""));
      if (!key) return;

      const date = String(row.FECHA || "").trim();
      const item: AvailabilityItem = {
        date,
        status: String(row.ESTATUS || "").trim(),
        seats: String(row["LUGARES DISPONIBLES"] || "").trim(),
        dateMs: parseAvailabilityDate(date),
      };

      if (item.dateMs !== null && item.dateMs < todayUtc) return;

      const current = mapa.get(key) || [];
      current.push(item);
      mapa.set(key, current);
    });

    mapa.forEach((items, key) => {
      mapa.set(
        key,
        [...items].sort(
          (a, b) =>
            (a.dateMs ?? Number.MAX_SAFE_INTEGER) -
            (b.dateMs ?? Number.MAX_SAFE_INTEGER)
        )
      );
    });

    return mapa;
  }, [disponibilidad]);

  const toursFiltrados = useMemo(() => {
    const filtrados = tours.filter((tour) => {
      const texto = [
        getField(tour, ["CLAVE"]),
        getField(tour, ["TOUR"]),
        getField(tour, ["ESTADO"]),
        getField(tour, [
          "Fecha Bot",
          "FECHA BOT",
          "FECHA_BOT",
          "PRÓXIMAS_FECHAS",
        ]),
        getField(tour, ["NIVEL DE DIFICULTAD", "DIFICULTAD", "NIVEL", "AB"]),
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

  if (!session) {
    return <LoginScreen />;
  }

  if (accessStatus === "checking") {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <img src="/logoweb.png" alt="Tu Próximo Viaje MX" style={styles.loginLogo} />
          <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
          <h1 style={styles.loginTitle}>Preparando tu acceso</h1>
          <p style={styles.loginSubtitle}>Validando tu cuenta de agencia…</p>
        </div>
      </div>
    );
  }

  if (accessStatus === "denied") {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <img src="/logoweb.png" alt="Tu Próximo Viaje MX" style={styles.loginLogo} />
          <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
          <h1 style={styles.loginTitle}>Acceso no habilitado</h1>
          <p style={styles.loginSubtitle}>
            Tu sesión existe, pero no tiene una agencia INDEX activa asociada.
          </p>
          <button style={styles.loginButton} onClick={() => void supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (availabilityKey) {
    if (loading) {
      return (
        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.infoBox}>Cargando disponibilidad...</div>
          </div>
        </div>
      );
    }

    return (
      <AvailabilityPage
        rows={disponibilidad}
        initialKey={availabilityKey}
      />
    );
  }

  if (galleryKey) {
    const normalizedGalleryKey = normalizarClave(galleryKey);
    const galleryImages = galeriasPorClave.get(normalizedGalleryKey) || [];
    const galleryTour = tours.find(
      (tour) => normalizarClave(getField(tour, ["CLAVE"])) === normalizedGalleryKey
    );
    const galleryName =
      (galleryTour && getField(galleryTour, ["TOUR"])) ||
      galerias.find(
        (item) => normalizarClave(item.tourKey) === normalizedGalleryKey
      )?.tourName ||
      galleryKey;

    if (loading) {
      return (
        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.infoBox}>Cargando galería...</div>
          </div>
        </div>
      );
    }

    return <GalleryPage tourName={galleryName} images={galleryImages} />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.header}>
            <div style={styles.brandBlock}>
              <img
                src="/logoweb.png"
                alt="Tu Próximo Viaje MX"
                style={styles.logo}
              />

              <div>
                <p style={styles.brand}>TU PRÓXIMO VIAJE MX</p>
                <h1 style={styles.title}>INDEX TPVMX</h1>
                <p style={styles.subtitle}>
                  {agencyName ? `${agencyName} · ` : ""}Catálogo privado para vender y operar más fácil.
                </p>
              </div>
            </div>
          </div>

          <button
            style={styles.logoutButton}
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            Cerrar sesión
          </button>
        </div>

        <AgencyProfile
          session={session}
          agencyName={agencyName}
          onProfileChange={setAgencyProfile}
        />

  {plantillasActivas.length > 0 && (
  <div style={styles.canvaSection}>
    <p style={styles.canvaTitle}>Plantillas de diseño por mes</p>

    <div style={styles.canvaButtons}>
      {plantillasActivas.map((item, i) => (
        <a
          key={i}
          href={item.LINK}
          target="_blank"
          rel="noreferrer"
          style={styles.canvaButton}
        >
          {item.ETIQUETA || item.MES || "Ver plantilla"}
        </a>
      ))}
    </div>
  </div>
)}

        <div style={styles.availabilityStrip}>
          <div>
            <p style={styles.availabilityStripEyebrow}>DISPONIBILIDAD DE SALIDAS</p>
            <p style={styles.availabilityStripText}>
              Consulta lugares disponibles y estatus de quórum de las próximas salidas.
            </p>
          </div>

          <a
            href="?disponibilidad=1"
            style={styles.availabilityStripButton}
          >
            🟢 Consultar disponibilidad
          </a>
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
              const claveOperativa =
                getField(tour, ["CLAVE FIJA", "CLAVE_FIJA"]) || clave;
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

              const dificultad =
                getField(tour, [
                  "NIVEL DE DIFICULTAD",
                  "DIFICULTAD",
                  "NIVEL",
                  "AB",
                ]) || "";

              const fechas =
                getField(tour, [
                  "Fecha Bot",
                  "FECHA BOT",
                  "FECHA_BOT",
                  "PRÓXIMAS_FECHAS",
                  "PROXIMAS_FECHAS",
                ]) || "Por definir";

              const precio = formatearMoneda(getField(tour, ["PRECIO", "O"]));
              const reserva = formatearMoneda(getField(tour, ["RESERVA", "P"]));
              const claveNormalizada = normalizarClave(clave);
              const claveOperativaNormalizada = normalizarClave(claveOperativa);
              const galleryImages =
                galeriasPorClave.get(claveNormalizada) || [];
              const proximaDisponibilidad =
                disponibilidadPorClave.get(claveOperativaNormalizada)?.[0] || null;
              const disponibilidadVista = proximaDisponibilidad
                ? disponibilidadVisual(proximaDisponibilidad.status)
                : null;

              const copyLimpio =
                getField(tour, [
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
                  "COPY EMOJIS",
                  "COPY_EMOJIS",
                  "COPY EMOJI",
                  "COPY_EMOJI",
                  "AL",
                ]) || "";

              const cardKey = normalizarClave(clave || nombre);
              const descripcionLarga = descripcion.length > 180;
              const descripcionVisible =
                descripcionLarga && !descripcionesAbiertas[cardKey]
                  ? `${descripcion.slice(0, 180).trim()}…`
                  : descripcion;

              const lineasFecha = fechas
                .split(/\r?\n/)
                .map((linea) => linea.trim())
                .filter(Boolean);
              const tieneMuchasFechas = lineasFecha.length > 3;
              const fechasVisibles =
                tieneMuchasFechas && !fechasAbiertas[cardKey]
                  ? lineasFecha.slice(0, 3)
                  : lineasFecha;
              const fechasRestantes = Math.max(0, lineasFecha.length - 3);

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
                  <div style={styles.cardAccent} aria-hidden="true" />
                  <div style={styles.cardTop}>
                    <span style={styles.claveBadge}>{clave || "—"}</span>
                    <span style={styles.estadoBadge}>{estadoTour}</span>
                  </div>

                  <h2 style={styles.cardTitle}>{nombre}</h2>

                  {descripcion ? (
                    <div style={styles.descriptionBlock}>
                      <p style={styles.cardDescription}>{descripcionVisible}</p>
                      {descripcionLarga ? (
                        <button
                          type="button"
                          style={styles.inlineToggle}
                          onClick={() =>
                            setDescripcionesAbiertas((current) => ({
                              ...current,
                              [cardKey]: !current[cardKey],
                            }))
                          }
                        >
                          {descripcionesAbiertas[cardKey] ? "Ver menos" : "Ver más"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {dificultad ? (
                    <p style={styles.dificultad}>
                      Nivel de dificultad: {dificultad}
                    </p>
                  ) : null}

                  <div style={styles.block}>
                    <p style={styles.label}>Próximas fechas</p>
                    <p style={styles.valuePre}>
                      {fechasVisibles.length > 0
                        ? fechasVisibles.join("\n")
                        : "Por definir"}
                    </p>
                    {tieneMuchasFechas ? (
                      <button
                        type="button"
                        style={styles.inlineToggle}
                        onClick={() =>
                          setFechasAbiertas((current) => ({
                            ...current,
                            [cardKey]: !current[cardKey],
                          }))
                        }
                      >
                        {fechasAbiertas[cardKey]
                          ? "Ver menos fechas"
                          : `+ ${fechasRestantes} fechas más`}
                      </button>
                    ) : null}
                  </div>

                  {proximaDisponibilidad && disponibilidadVista ? (
                    <div
                      style={{
                        ...styles.nextAvailability,
                        background: disponibilidadVista.background,
                        borderColor: disponibilidadVista.border,
                      }}
                    >
                      <div>
                        <span style={styles.nextAvailabilityLabel}>
                          Próxima salida
                        </span>
                        <strong
                          style={{
                            ...styles.nextAvailabilityValue,
                            color: disponibilidadVista.color,
                          }}
                        >
                          {disponibilidadVista.icon}{" "}
                          {disponibilidadTexto(proximaDisponibilidad)}
                        </strong>
                      </div>
                      <span style={styles.nextAvailabilityDate}>
                        {formatAvailabilityDate(proximaDisponibilidad.date)}
                      </span>
                    </div>
                  ) : null}

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

                  <div style={styles.actions2}>
                    <ActionButton
                      kind="primary"
                      label="Copiar para mis clientes"
                      onClick={() =>
                        copiarTexto(
                          personalizarCopyAgencia(copyLimpio, agencyProfile),
                          "copy personalizado"
                        )
                      }
                    />

                    <ActionButton
                      kind="secondary"
                      label="Copiar copy TPVMX"
                      onClick={() => copiarTexto(copyEmojis, "copy con emojis")}
                    />
                  </div>

                  <div style={styles.resourceLinks}>
                    {galleryImages.length > 0 ? (
                      <a
                        href={`?galeria=${encodeURIComponent(clave)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.resourceLink}
                      >
                        📷 Galería de fotos
                      </a>
                    ) : null}

                    <a
                      href={`?disponibilidad=${encodeURIComponent(claveOperativa || "1")}`}
                      style={styles.resourceLink}
                    >
                      🟢 Ver disponibilidad completa
                    </a>
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

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 82% 8%, rgba(62,174,174,.10), transparent 22%), linear-gradient(180deg, #fafaf7 0%, #ffffff 45%, #f2f5f4 100%)",
    fontFamily:
      "var(--font-body)",
    padding: "24px",
    color: "#40535b",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px",
    padding: "10px 14px",
    border: "1px solid rgba(223,231,229,.92)",
    borderRadius: "0 0 18px 18px",
    background: "rgba(250,250,247,.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 10px 26px rgba(22,62,85,.07)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    marginBottom: 0,
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  logo: {
    width: "70px",
    height: "70px",
    objectFit: "contain",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "6px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  brand: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#e50051",
    fontWeight: 800,
  },
  title: {
    margin: "4px 0 4px 0",
    fontSize: "32px",
    color: "#046dad",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: "#607078",
    fontSize: "15px",
  },
  availabilityStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap" as const,
    marginBottom: "16px",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "#eefaf6",
    border: "1px solid #bfe8d6",
    boxShadow: "0 8px 20px rgba(22, 116, 82, 0.06)",
  },
  availabilityStripEyebrow: {
    margin: "0 0 4px 0",
    color: "#167452",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
  },
  availabilityStripText: {
    margin: 0,
    color: "#486376",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  availabilityStripButton: {
    display: "inline-block",
    flexShrink: 0,
    border: "1px solid #8bd5b8",
    background: "#ffffff",
    color: "#167452",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },
  logoutButton: {
    border: "1px solid #d8eef2",
    background: "#ffffff",
    color: "#046dad",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  filtersBox: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "12px",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 10px 28px rgba(18, 50, 74, 0.06)",
    border: "1px solid #dfe7e5",
    marginBottom: "16px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #b9d8dc",
    fontSize: "15px",
    outline: "none",
    color: "#40535b",
    background: "#ffffff",
  },

  select: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #b9d8dc",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
    color: "#40535b",
  },
  metaRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap" as const,
    marginBottom: "18px",
  },
  metaBadge: {
    background: "#f9dbe8",
    color: "#ba0043",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 800,
  },
  infoBox: {
    background: "#ffffff",
    border: "1px solid #dfe7e5",
    borderRadius: "18px",
    padding: "18px",
    color: "#486376",
  },
  errorBox: {
    background: "#fff1f4",
    border: "1px solid #f4c4d6",
    borderRadius: "18px",
    padding: "18px",
    color: "#ba0043",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  card: {
    position: "relative",
    overflow: "hidden",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 10px 30px rgba(18, 50, 74, 0.07)",
    border: "1px solid #dfe7e5",
    transform: "translateY(0)",
    transition: "all 0.2s ease",
  },
  cardHover: {
    position: "relative",
    overflow: "hidden",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 16px 34px rgba(18, 50, 74, 0.11)",
    border: "1px solid #bfe2e7",
    transform: "translateY(-4px)",
    transition: "all 0.2s ease",
  },
  galleryPage: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 82% 8%, rgba(62,174,174,.10), transparent 22%), linear-gradient(180deg, #fafaf7 0%, #ffffff 45%, #f2f5f4 100%)",
    padding: "28px",
    color: "#40535b",
    fontFamily:
      "var(--font-body)",
  },
  galleryPageContainer: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  galleryBackLink: {
    display: "inline-block",
    marginBottom: "22px",
    color: "#046dad",
    fontWeight: 800,
    textDecoration: "none",
  },
  galleryPageTitle: {
    margin: "6px 0",
    fontSize: "34px",
    color: "#163e55",
    fontWeight: 800,
  },
  galleryPageSubtitle: {
    margin: "0 0 22px 0",
    color: "#607078",
    fontSize: "17px",
  },
  galleryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  galleryTile: {
    display: "block",
    overflow: "hidden",
    borderRadius: "18px",
    background: "#eaf4f6",
    aspectRatio: "4 / 3",
    border: "1px solid #dfe7e5",
  },
  galleryTileImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  cardAccent: {
    position: "absolute",
    zIndex: 4,
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: "#e50051",
    pointerEvents: "none",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    gap: "10px",
  },
  claveBadge: {
    background: "#e50051",
    color: "#fff",
    borderRadius: "999px",
    padding: "7px 13px",
    fontSize: "12px",
    fontWeight: 800,
    boxShadow: "0 6px 14px rgba(216, 27, 96, 0.18)",
  },
  estadoBadge: {
    background: "#d8eef2",
    color: "#046dad",
    borderRadius: "999px",
    padding: "7px 13px",
    fontSize: "12px",
    fontWeight: 800,
  },
  cardTitle: {
    margin: "0 0 10px 0",
    fontSize: "24px",
    lineHeight: 1.18,
    color: "#163e55",
    fontWeight: 800,
  },
  descriptionBlock: {
    marginBottom: "10px",
  },
  cardDescription: {
    margin: 0,
    color: "#4f6b7e",
    lineHeight: 1.5,
    fontSize: "14px",
  },
  inlineToggle: {
    marginTop: "5px",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#046dad",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  dificultad: {
    margin: "0 0 14px 0",
    fontSize: "13px",
    fontWeight: 800,
    color: "#ff9800",
  },
  block: {
    marginBottom: "16px",
  },
  label: {
    margin: "0 0 6px 0",
    fontSize: "13px",
    fontWeight: 800,
    color: "#e50051",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  valuePre: {
    margin: 0,
    whiteSpace: "pre-line" as const,
    color: "#163e55",
    fontSize: "15px",
    lineHeight: 1.45,
  },
  nextAvailability: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    padding: "11px 13px",
    border: "1px solid",
    borderRadius: "14px",
  },
  nextAvailabilityLabel: {
    display: "block",
    marginBottom: "3px",
    color: "#607078",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  nextAvailabilityValue: {
    display: "block",
    fontSize: "14px",
    lineHeight: 1.25,
    fontWeight: 800,
  },
  nextAvailabilityDate: {
    flexShrink: 0,
    color: "#163e55",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  priceRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "16px",
  },
  priceBox: {
    background: "#f2f5f4",
    borderRadius: "18px",
    padding: "14px",
    border: "1px solid #dfe7e5",
  },
  priceLabel: {
    display: "block",
    fontSize: "12px",
    color: "#046dad",
    fontWeight: 800,
    marginBottom: "5px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  priceValue: {
    fontSize: "20px",
    color: "#163e55",
    fontWeight: 800,
  },
  actions2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  resourceLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 14px",
    marginTop: "12px",
    paddingTop: "10px",
    borderTop: "1px solid #e4eef0",
  },
  resourceLink: {
    color: "#046dad",
    fontSize: "13px",
    fontWeight: 800,
    textDecoration: "none",
  },
  primaryButton: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#3eaeae",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(35, 142, 137, 0.14)",
    transition: "all 0.2s ease",
  },
  primaryButtonHover: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#238e89",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 20px rgba(35, 142, 137, 0.20)",
    transform: "translateY(-2px)",
    transition: "all 0.2s ease",
  },
  secondaryButton: {
    border: "1px solid #a8d8df",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "#dff2f4",
    color: "#046dad",
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
  loginPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at 82% 8%, rgba(62,174,174,.10), transparent 22%), linear-gradient(180deg, #fafaf7 0%, #ffffff 45%, #f2f5f4 100%)",
    padding: "24px",
  },
  loginCard: {
    width: "100%",
    maxWidth: "430px",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "32px",
    boxShadow: "0 20px 40px rgba(18, 50, 74, 0.10)",
    border: "1px solid #dfe7e5",
    textAlign: "center" as const,
  },
  loginLogo: {
    width: "100px",
    height: "100px",
    objectFit: "contain",
    marginBottom: "12px",
  },
  loginTitle: {
    margin: "8px 0",
    fontSize: "30px",
    color: "#163e55",
    fontWeight: 800,
  },
  loginSubtitle: {
    margin: "0 0 22px 0",
    color: "#607078",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  loginForm: {
    display: "grid",
    gap: "14px",
  },
  loginButton: {
    border: "none",
    borderRadius: "16px",
    padding: "14px",
    background: "#e50051",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: "15px",
  },
  loginError: {
    marginTop: "14px",
    color: "#ba0043",
    fontWeight: 700,
    fontSize: "14px",
  },
canvaSection: {
  background: "#ffffff",
  borderRadius: "20px",
  padding: "18px",
  marginBottom: "16px",
  border: "1px solid #dfe7e5",
  boxShadow: "0 10px 28px rgba(18, 50, 74, 0.06)",
},

canvaTitle: {
  margin: "0 0 12px 0",
  fontWeight: 800,
  color: "#e50051",
  fontSize: "14px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
},

canvaButtons: {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
},

canvaButton: {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: "12px",
  background: "#dff2f4",
  textDecoration: "none",
  fontWeight: 700,
  color: "#046dad",
  border: "1px solid #a8d8df",
},
} satisfies Record<string, import("react").CSSProperties>;

export default App;
