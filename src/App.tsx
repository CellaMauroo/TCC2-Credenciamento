import { EventLocationPicker } from "./EventLocationPicker";
import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
  Navigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  MapPin,
  Clock3,
  Search,
  Check,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  Ticket,
  ChartNoAxesColumnIncreasing,
  LogOut,
  Plus,
  Users,
  QrCode,
  Download,
  ArrowLeft,
  Menu,
  X,
  ShieldCheck,
  LocateFixed,
  Wifi,
  WifiOff,
  RefreshCw,
  Mail,
  BookOpen,
  SlidersHorizontal,
  ExternalLink,
  Monitor,
} from "lucide-react";
import QRCode from "qrcode";
import { api, post, put, captureLocation, ApiError } from "./api";
type User = {
  id: string;
  name: string;
  email: string;
  organizer: boolean;
  verified: boolean;
};
const Auth = createContext<{
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}>({ user: null, loading: true, refresh: async () => {} });
const hours = (m: number) =>
  `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ""}`;
const date = (
  v: string,
  tz = "America/Sao_Paulo",
  opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }).format(
    new Date(v),
  );
const time = (v: string, tz?: string) =>
  date(v, tz, { hour: "2-digit", minute: "2-digit" });
function useData(path: string | null, interval = 0) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api(path);
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    void refresh();
    if (!interval) return;
    const id = setInterval(() => {
      if (!document.hidden) void refresh();
    }, interval);
    return () => clearInterval(id);
  }, [refresh, interval]);
  return { data, error, loading, refresh };
}
function Notice({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      className={`notice ${success ? "success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {success ? <CheckCircle2 size={19} /> : <ShieldCheck size={19} />}
      <span>{children}</span>
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Carregando…
    </div>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <CalendarDays size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
function Button({
  children,
  busy = false,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || busy}>
      {busy ? <span className="spinner" /> : null}
      {children}
    </button>
  );
}
function Require({
  children,
  organizer = false,
}: {
  children: ReactNode;
  organizer?: boolean;
}) {
  const a = useContext(Auth),
    loc = useLocation();
  if (a.loading) return <Loading />;
  if (!a.user)
    return (
      <Navigate
        to={`/entrar?next=${encodeURIComponent(loc.pathname + loc.search + loc.hash)}`}
        replace
      />
    );
  if (!a.user.verified) return <VerifyPrompt />;
  if (organizer && !a.user.organizer)
    return <Notice>Acesso reservado à organização do evento.</Notice>;
  return children;
}
function VerifyPrompt() {
  const [msg, setMsg] = useState("");
  return (
    <div className="narrow">
      <Mail size={36} />
      <h1>Confira seu e-mail</h1>
      <p>
        Confirme seu endereço de e-mail para se inscrever e registrar presença.
      </p>
      <Button
        onClick={async () => {
          try {
            setMsg((await post("/auth/resend")).message);
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}
      >
        Reenviar confirmação
      </Button>
      {msg && <Notice>{msg}</Notice>}
    </div>
  );
}
function Shell() {
  const { user, refresh } = useContext(Auth),
    loc = useLocation(),
    navigate = useNavigate();
  const [menu, setMenu] = useState(false),
    [err, setErr] = useState("");
  useEffect(() => setMenu(false), [loc.pathname]);
  if (loc.pathname.startsWith("/projecao/"))
    return (
      <Routes>
        <Route
          path="/projecao/:id"
          element={
            <Require organizer>
              <Projection />
            </Require>
          }
        />
      </Routes>
    );
  return (
    <div className="app">
      <aside className={menu ? "sidebar expanded" : "sidebar"}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <GraduationCap size={24} />
          </span>
          credencia<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-tag">
          <span className="tiny-dot" />
          ESPAÇO ACADÊMICO
        </div>
        <p className="nav-label">PARTICIPAR</p>
        <nav>
          <NavLink to="/" end>
            <LayoutGrid size={19} />
            Explorar eventos
          </NavLink>
          <NavLink to="/inscricoes">
            <Ticket size={19} />
            Minhas inscrições
          </NavLink>
          <NavLink to="/historico">
            <ChartNoAxesColumnIncreasing size={19} />
            Minhas presenças
          </NavLink>
          {user?.organizer && (
            <>
              <p className="nav-label">ORGANIZAR</p>
              <NavLink to="/organizador">
                <Users size={19} />
                Meus eventos
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <BookOpen size={22} />
          </span>
          <h4>Conhecimento que conta.</h4>
          <p>Participe, conecte-se e acompanhe sua jornada acadêmica.</p>
        </div>
        <div className="sidebar-bottom">
          <span className="tiny-dot" />
          Feito para a comunidade acadêmica
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            Seu espaço acadêmico <ChevronRight size={14} />
            <strong>
              {loc.pathname.startsWith("/organizador")
                ? "Organização"
                : loc.pathname === "/inscricoes"
                  ? "Inscrições"
                  : loc.pathname === "/historico"
                    ? "Presenças"
                    : "Eventos"}
            </strong>
          </div>
          <div className="top-actions">
            <span className="online-label">
              <span className="tiny-dot" />
              100% online
            </span>
            {user ? (
              <>
                <span className="avatar">
                  {user.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span className="user-name">{user.name.split(" ")[0]}</span>
                <button
                  className="icon-button"
                  aria-label="Sair"
                  onClick={async () => {
                    try {
                      await post("/auth/logout");
                      await refresh();
                      navigate("/");
                    } catch (e) {
                      setErr((e as Error).message);
                    }
                  }}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <Link className="button small secondary" to="/entrar">
                Entrar <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </header>
        <main>
          {err && <Notice>{err}</Notice>}
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/eventos/:id" element={<EventDetail />} />
            <Route path="/entrar" element={<AuthPage mode="login" />} />
            <Route path="/cadastro" element={<AuthPage mode="register" />} />
            <Route path="/recuperar" element={<AuthPage mode="forgot" />} />
            <Route path="/verificar" element={<TokenPage mode="verify" />} />
            <Route path="/redefinir" element={<TokenPage mode="reset" />} />
            <Route
              path="/inscricoes"
              element={
                <Require>
                  <Enrollments />
                </Require>
              }
            />
            <Route
              path="/inscricoes/:id"
              element={
                <Require>
                  <EnrollmentDetail />
                </Require>
              }
            />
            <Route
              path="/historico"
              element={
                <Require>
                  <History />
                </Require>
              }
            />
            <Route
              path="/checkin/:id"
              element={
                <Require>
                  <Checkin />
                </Require>
              }
            />
            <Route
              path="/organizador"
              element={
                <Require organizer>
                  <Organizer />
                </Require>
              }
            />
            <Route
              path="/organizador/novo"
              element={
                <Require organizer>
                  <EventForm />
                </Require>
              }
            />
            <Route
              path="/organizador/:id/editar"
              element={
                <Require organizer>
                  <EventForm />
                </Require>
              }
            />
            <Route
              path="/organizador/:id"
              element={
                <Require organizer>
                  <OrganizerDetail />
                </Require>
              }
            />
            <Route path="/privacidade" element={<Privacy />} />
            <Route
              path="*"
              element={
                <Empty title="Página não encontrada">
                  <Link to="/">Voltar aos eventos</Link>
                </Empty>
              }
            />
          </Routes>
        </main>
        <footer>
          <span>
            credencia.{" "}
            <span className="muted">Conectando pessoas e conhecimento.</span>
          </span>
          <Link to="/privacidade">
            Sobre a localização e seus dados <ArrowUpRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
function EventArt({
  index = 0,
  compact = false,
}: {
  index?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`event-art art-${index % 3} ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <div className="art-label">
        {
          [
            "TECNOLOGIA & INOVAÇÃO",
            "PESQUISA & COMUNIDADE",
            "DESIGN & ACESSIBILIDADE",
          ][index % 3]
        }
      </div>
      <div className="art-shape shape-one" />
      <div className="art-shape shape-two" />
      <div className="art-shape shape-three" />
      <span className="art-caption">
        {
          ["Ideias em\nmovimento.", "Ciência que\nconecta.", "Novos\nolhares."][
            index % 3
          ]
        }
      </span>
      <span className="art-corner">
        <ArrowUpRight size={25} />
      </span>
    </div>
  );
}
function EventCard({ e, index = 0 }: { e: any; index?: number }) {
  const open =
    Date.now() >= +new Date(e.registration_starts_at) &&
    Date.now() <= +new Date(e.registration_ends_at);
  return (
    <Link to={`/eventos/${e.id}`} className="event-card">
      <EventArt index={index} />
      <div className="event-card-body">
        <span className={`badge ${open ? "green" : "gray"}`}>
          <span className="tiny-dot" />
          {open ? "Inscrições abertas" : "Inscrições indisponíveis"}
        </span>
        <h3>{e.name}</h3>
        <p>{e.description}</p>
        <div className="event-meta">
          <span>
            <CalendarDays size={15} />
            {date(e.starts_at, e.timezone)}
            {date(e.ends_at, e.timezone) !== date(e.starts_at, e.timezone)
              ? ` a ${date(e.ends_at, e.timezone, { day: "2-digit", month: "short" })}`
              : ""}
          </span>
          <span>
            <MapPin size={15} />
            {e.location}
          </span>
        </div>
        <div className="card-bottom">
          <span>
            {e.activity_count || 1} atividade{e.activity_count === 1 ? "" : "s"}
          </span>
          <strong>
            Ver evento <ArrowUpRight size={16} />
          </strong>
        </div>
      </div>
    </Link>
  );
}
function Explore() {
  const { data, error, loading, refresh } = useData("/events"),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("all");
  const list = (data || []).filter(
    (e: any) =>
      (e.name + " " + e.description + " " + e.location)
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (filter === "all" ||
        (Date.now() >= +new Date(e.registration_starts_at) &&
          Date.now() <= +new Date(e.registration_ends_at))),
  );
  return (
    <>
      <div className="eyebrow">
        <span />
        APRENDA. PARTICIPE. CONECTE-SE.
      </div>
      <section className="hero">
        <div>
          <h1>
            Seu próximo encontro
            <br />
            com o <em>conhecimento.</em>
          </h1>
          <p>
            Explore eventos, garanta sua inscrição e faça cada
            <br className="desktop-break" /> experiência contar na sua jornada
            acadêmica.
          </p>
          <a className="button" href="#eventos">
            Encontrar meu próximo evento <ArrowRight size={17} />
          </a>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="hero-center">
            <GraduationCap size={50} strokeWidth={1.5} />
          </div>
          <div className="floating-tag tag-one">
            <CheckCircle2 size={16} />
            Novas conexões
          </div>
          <div className="floating-tag tag-two">
            <CalendarDays size={16} />
            Grandes descobertas
          </div>
          <span className="spark spark-one">✳</span>
          <span className="spark spark-two">✳</span>
        </div>
      </section>
      <div className="how-strip">
        <span>
          <Ticket size={18} />
          <strong>Inscreva-se</strong> no seu próximo evento
        </span>
        <span>
          <QrCode size={18} />
          <strong>Leia o QR</strong> no local da atividade
        </span>
        <span>
          <CheckCircle2 size={18} />
          <strong>Acompanhe</strong> suas presenças e horas
        </span>
      </div>
      <section id="eventos" className="events-section">
        <div className="section-heading">
          <div>
            <h2>
              Explore os eventos{" "}
              <span className="count-pill">{data?.length || 0}</span>
            </h2>
            <p>Encontre novas oportunidades de aprender e participar.</p>
          </div>
          <span className="section-caption">
            SUA PRÓXIMA DESCOBERTA ESTÁ AQUI <ArrowUpRight size={14} />
          </span>
        </div>
        <div className="filters">
          <div className="segmented">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Todos os eventos
            </button>
            <button
              className={filter === "open" ? "active" : ""}
              onClick={() => setFilter("open")}
            >
              Inscrições abertas
            </button>
          </div>
          <label className="search">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por evento ou tema…"
              aria-label="Buscar eventos"
            />
            {q && (
              <button
                className="icon-button"
                aria-label="Limpar busca"
                onClick={() => setQ("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <>
            <Notice>{error}</Notice>
            <Button onClick={refresh}>Tentar novamente</Button>
          </>
        ) : list.length ? (
          <div className="event-grid">
            {list.map((e: any, i: number) => (
              <EventCard key={e.id} e={e} index={i} />
            ))}
          </div>
        ) : (
          <Empty
            title={q ? "Nenhum evento encontrado" : "Nenhum evento disponível"}
          >
            <p>
              {q
                ? "Experimente outro termo de busca."
                : "Os eventos publicados aparecerão aqui."}
            </p>
          </Empty>
        )}
      </section>
      <div className="bottom-callout">
        <span className="callout-icon">
          <LocateFixed size={24} />
        </span>
        <div>
          <h3>Presença confirmada, jornada registrada.</h3>
          <p>
            No local do evento, leia o QR Code com a câmera do celular e
            confirme sua presença com a localização.
          </p>
        </div>
        <Link to="/historico">
          Acompanhar minhas horas <ArrowRight size={17} />
        </Link>
      </div>
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function EventDetail() {
  const { id } = useParams(),
    { data: e, error, loading, refresh } = useData(`/events/${id}`),
    { user } = useContext(Auth),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Explorar eventos
      </Link>
      <div className="detail-grid">
        <div>
          <EventArt />
          <PageHeading eyebrow="ENCONTRO ACADÊMICO" title={e.name} />
          <p className="description">{e.description}</p>
          <div className="detail-meta">
            <span>
              <MapPin size={18} />
              {e.location}
            </span>
            <span>
              <CalendarDays size={18} />
              {date(e.starts_at, e.timezone)} a {date(e.ends_at, e.timezone)}
            </span>
            <span>
              <Clock3 size={18} />
              Horários em {e.timezone}
            </span>
          </div>
          <h2 className="spaced">Programação</h2>
          <div className="activity-list">
            {e.activities.map((a: any) => (
              <div className="activity-row" key={a.id}>
                <div className="activity-date">
                  <strong>
                    {date(a.starts_at, e.timezone, { day: "2-digit" })}
                  </strong>
                  <span>
                    {date(a.starts_at, e.timezone, { month: "short" })}
                  </span>
                </div>
                <div>
                  <h3>{a.title}</h3>
                  <p>
                    {time(a.starts_at, e.timezone)}–
                    {time(a.ends_at, e.timezone)}{" "}
                    <span className="dot-separator">·</span> {hours(a.minutes)}{" "}
                    de carga horária
                  </p>
                </div>
                <span className="activity-icon">
                  <BookOpen size={20} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <aside className="panel enrollment-panel">
          <span className="badge green">Evento acadêmico</span>
          <h2>Sua próxima experiência começa aqui.</h2>
          <p>
            A inscrição no evento dá acesso a todas as atividades da
            programação.
          </p>
          <div className="enrollment-facts">
            <span>
              <CalendarDays size={18} />
              Inscrições até {date(e.registration_ends_at, e.timezone)}
            </span>
            <span>
              <BookOpen size={18} />
              {e.activities.length} atividades ·{" "}
              {hours(
                e.activities.reduce((s: number, a: any) => s + a.minutes, 0),
              )}{" "}
              previstas
            </span>
            <span>
              <Ticket size={18} />
              Participação gratuita
            </span>
          </div>
          {e.enrollment ? (
            <>
              <div className="confirmed-inline">
                <CheckCircle2 size={19} />
                Você está inscrito neste evento
              </div>
              <Link className="button full" to={`/inscricoes/${e.id}`}>
                Ver minha inscrição <ArrowRight size={17} />
              </Link>
            </>
          ) : (
            <Button
              className="full"
              busy={busy}
              disabled={
                Date.now() < +new Date(e.registration_starts_at) ||
                Date.now() > +new Date(e.registration_ends_at)
              }
              onClick={async () => {
                if (!user) {
                  navigate(
                    `/entrar?next=${encodeURIComponent("/eventos/" + id)}`,
                  );
                  return;
                }
                setBusy(true);
                setErr("");
                try {
                  await post(`/events/${id}/enroll`);
                  await refresh();
                } catch (ex) {
                  setErr((ex as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {Date.now() < +new Date(e.registration_starts_at)
                ? "Inscrições ainda não abertas"
                : Date.now() > +new Date(e.registration_ends_at)
                  ? "Inscrições encerradas"
                  : "Quero me inscrever"}
              <ArrowRight size={17} />
            </Button>
          )}
          {err && <Notice>{err}</Notice>}
          <p className="fine-print">
            <ShieldCheck size={15} />A presença é confirmada no local, pelo QR
            Code da atividade e sua localização.
          </p>
        </aside>
      </div>
    </>
  );
}
function AuthPage({ mode }: { mode: "login" | "register" | "forgot" }) {
  const navigate = useNavigate(),
    loc = useLocation(),
    { refresh } = useContext(Auth);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const next = new URLSearchParams(loc.search).get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  useEffect(() => {
    setError("");
    setMessage("");
  }, [mode]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const d = await post(
        "/auth/" +
          (mode === "login"
            ? "login"
            : mode === "register"
              ? "register"
              : "forgot"),
        Object.fromEntries(f),
      );
      if (mode === "login") {
        await refresh();
        navigate(safeNext);
      } else setMessage(d.message);
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <span className="auth-symbol">
          <GraduationCap size={48} />
        </span>
        <div className="eyebrow">SUA JORNADA, EM UM SÓ LUGAR.</div>
        <h1>
          Mais encontros.
          <br />
          Mais conhecimento.
          <br />
          <em>Mais possibilidades.</em>
        </h1>
        <p>
          Inscrições, presenças e horas acadêmicas.
          <br />
          Tudo conectado à sua próxima experiência.
        </p>
      </div>
      <div className="panel auth-card" key={mode}>
        <span className="badge purple">BEM-VINDO AO CREDENCIA</span>
        <h2>
          {mode === "login"
            ? "Bom ter você por aqui."
            : mode === "register"
              ? "Comece sua jornada."
              : "Vamos recuperar seu acesso."}
        </h2>
        <p>
          {mode === "login"
            ? "Entre para acompanhar seus eventos."
            : mode === "register"
              ? "Crie sua conta e descubra novas oportunidades."
              : "Enviaremos um link para redefinir sua senha."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <Field
                label="Nome completo"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
              />
              <Field
                label="Matrícula (opcional)"
                name="registration"
                maxLength={60}
              />
            </>
          )}
          <Field
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          {mode !== "forgot" && (
            <Field
              label="Senha"
              name="password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              minLength={mode === "register" ? 10 : undefined}
              maxLength={72}
              required
              hint={
                mode === "register"
                  ? "Use pelo menos 10 caracteres."
                  : undefined
              }
            />
          )}{" "}
          {mode === "login" && (
            <Link className="forgot-link" to="/recuperar">
              Esqueci minha senha
            </Link>
          )}
          {error && <Notice>{error}</Notice>}
          {message && <Notice success>{message}</Notice>}
          <Button className="full" busy={busy}>
            {mode === "login"
              ? "Entrar na minha conta"
              : mode === "register"
                ? "Criar minha conta"
                : "Enviar link de recuperação"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Ainda não tem conta?{" "}
              <Link to={`/cadastro?next=${encodeURIComponent(safeNext)}`}>
                Cadastre-se
              </Link>
            </>
          ) : (
            <Link to={`/entrar?next=${encodeURIComponent(safeNext)}`}>
              Voltar para entrar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function TokenPage({ mode }: { mode: "verify" | "reset" }) {
  const { refresh } = useContext(Auth);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const raw =
    new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await post("/auth/" + mode, {
        token: raw,
        password: new FormData(e.currentTarget).get("password"),
      });
      setMessage(data.message);
      await refresh();
      history.replaceState(null, "", location.pathname);
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel narrow">
      <Mail size={32} />
      <h1>
        {mode === "verify" ? "Confirme seu e-mail" : "Crie uma nova senha"}
      </h1>
      {message ? (
        <>
          <Notice success>{message}</Notice>
          <Link className="button" to="/entrar">
            Entrar
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {mode === "reset" && (
            <Field
              label="Nova senha"
              name="password"
              type="password"
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          )}
          {error && <Notice>{error}</Notice>}
          <Button busy={busy} disabled={!raw}>
            {mode === "verify" ? "Confirmar meu e-mail" : "Salvar nova senha"}
          </Button>
          {!raw && (
            <Notice>Link incompleto. Abra o link enviado por e-mail.</Notice>
          )}
        </form>
      )}
    </div>
  );
}
function Enrollments() {
  const { data, error, loading } = useData("/me/enrollments");
  return (
    <>
      <PageHeading
        eyebrow="SUA JORNADA"
        title="Minhas inscrições"
        description="Os encontros que fazem parte do seu caminho."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : !data.length ? (
        <Empty title="Sua próxima experiência está esperando">
          <p>Explore a programação e inscreva-se no seu primeiro evento.</p>
          <Link className="button" to="/">
            Explorar eventos <ArrowRight size={17} />
          </Link>
        </Empty>
      ) : (
        <div className="enrollment-list">
          {data.map((e: any) => (
            <Link
              key={e.id}
              to={`/inscricoes/${e.id}`}
              className="panel enrollment-item"
            >
              <div className="event-mini">
                <CalendarDays size={25} />
              </div>
              <div>
                <span className="badge green">
                  <Check size={12} />
                  Inscrição confirmada
                </span>
                <h3>{e.name}</h3>
                <p>
                  {date(e.starts_at, e.timezone)} · {e.location}
                </p>
              </div>
              <ArrowUpRight size={22} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
function EnrollmentDetail() {
  const { id } = useParams(),
    { data: events, error, loading } = useData("/me/enrollments"),
    hist = useData("/me/attendances");
  const e = events?.find((v: any) => v.id === id);
  const activities = useData(
    e?.status === "published" ? `/events/${id}` : null,
  );
  if (loading || hist.loading) return <Loading />;
  if (error || hist.error) return <Notice>{error || hist.error}</Notice>;
  if (!e) return <Notice>Inscrição não encontrada na sua conta.</Notice>;
  const rows = hist.data.attendances.filter(
    (a: any) =>
      activities.data?.activities.some((t: any) => t.id === a.activity_id) ||
      a.event_id === e.id,
  );
  return (
    <>
      <Link className="back-link" to="/inscricoes">
        <ArrowLeft size={16} />
        Minhas inscrições
      </Link>
      <PageHeading
        eyebrow="INSCRIÇÃO CONFIRMADA"
        title={e.name}
        description={`${date(e.starts_at, e.timezone)} · ${e.location}`}
      />
      <div className="panel">
        <p>
          <CheckCircle2 size={18} /> Sua inscrição dá acesso às atividades deste
          evento.
        </p>
        <p>
          No local, leia o QR Code exibido pela organização com a câmera do
          celular. O link abre a tela de confirmação e solicita sua localização.
        </p>
        <p className="fine-print">
          Inscrito em {date(e.enrolled_at, e.timezone)} · Identificador:{" "}
          {e.enrollment_id}
        </p>
      </div>
      <h2 className="spaced">Suas presenças neste evento</h2>
      {rows.length ? (
        rows.map((a: any) => (
          <div className="panel history-row" key={a.id}>
            <CheckCircle2 className="green-text" />
            <div>
              <h3>{a.title}</h3>
              <p>
                Confirmada em {date(a.confirmed_at, e.timezone)} às{" "}
                {time(a.confirmed_at, e.timezone)}
              </p>
            </div>
            <strong>{hours(a.minutes)}</strong>
          </div>
        ))
      ) : (
        <Empty title="Nenhuma presença registrada ainda">
          <p>
            Sua inscrição está confirmada. Registre a presença em cada atividade
            no local.
          </p>
        </Empty>
      )}
    </>
  );
}
function History() {
  const { data, error, loading } = useData("/me/attendances");
  return (
    <>
      <PageHeading
        eyebrow="CADA EXPERIÊNCIA CONTA"
        title="Minhas presenças"
        description="Seu histórico de participação e carga horária atribuída."
      />
      <div className="stat-grid">
        <Stat
          icon={<Clock3 />}
          label="Carga horária acumulada"
          value={hours(data?.total_minutes || 0)}
        />
        <Stat
          icon={<CheckCircle2 />}
          label="Presenças confirmadas"
          value={data?.attendances.length || 0}
        />
        <Stat
          icon={<CalendarDays />}
          label="Eventos com presença"
          value={new Set(data?.attendances.map((a: any) => a.event_id)).size}
        />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : !data.attendances.length ? (
        <Empty title="Sua jornada está começando">
          <p>As presenças confirmadas nas atividades aparecerão aqui.</p>
          <Link className="button" to="/">
            Encontrar eventos
          </Link>
        </Empty>
      ) : (
        data.attendances.map((a: any) => (
          <div className="panel history-row" key={a.id}>
            <span className="history-check">
              <CheckCircle2 />
            </span>
            <div>
              <span className="overline">{a.event_name}</span>
              <h3>{a.title}</h3>
              <p>
                {date(a.confirmed_at, a.timezone)} às{" "}
                {time(a.confirmed_at, a.timezone)} · Presença confirmada
              </p>
            </div>
            <strong>{hours(a.minutes)}</strong>
          </div>
        ))
      )}
      <p className="fine-print spaced">
        A carga horária é concedida integralmente na entrada conforme a regra da
        organização. Ela não mede o tempo de permanência.
      </p>
    </>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="panel stat">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
function Checkin() {
  const { id } = useParams(),
    { data: a, error, loading } = useData(`/activities/${id}`);
  const [attendance, setAttendance] = useState<any>(null),
    [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [step, setStep] = useState("");
  const raw =
    new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
  const lookup = useCallback(async () => {
    const r = await api(`/activities/${id}/my-attendance`);
    setAttendance(r.attendance);
    return r.attendance;
  }, [id]);
  useEffect(() => {
    lookup()
      .catch((e) => setErr(e.message))
      .finally(() => setChecking(false));
  }, [lookup]);
  useEffect(() => {
    const recover = () => {
      lookup()
        .then((p) => {
          if (p) setErr("");
        })
        .catch(() => {});
    };
    window.addEventListener("online", recover);
    return () => window.removeEventListener("online", recover);
  }, [lookup]);
  async function confirm() {
    setBusy(true);
    setErr("");
    try {
      setStep("Consultando sua presença…");
      if (await lookup()) return;
      if (!navigator.onLine)
        throw new Error("Você está sem conexão. Reconecte-se para confirmar.");
      setStep("Obtendo sua localização…");
      const location = await captureLocation();
      setStep("Confirmando no servidor…");
      const r = await post(`/activities/${id}/check-in`, {
        token: raw,
        attempt_id: crypto.randomUUID(),
        location,
      });
      setAttendance(r.attendance);
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === "NETWORK") {
        try {
          if (await lookup()) return;
        } catch {}
        setErr(
          "A resposta não chegou. Sua presença pode ter sido gravada. Reconecte-se e consulte sua situação antes de tentar novamente.",
        );
      } else setErr((ex as Error).message);
    } finally {
      setBusy(false);
      setStep("");
    }
  }
  if (loading || checking) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  return (
    <div className="checkin-wrap">
      <div className={`checkin-symbol ${attendance ? "done" : ""}`}>
        {attendance ? <CheckCircle2 size={44} /> : <LocateFixed size={44} />}
      </div>
      <span className="eyebrow">
        {attendance
          ? "TUDO CERTO COM SUA PRESENÇA"
          : "VOCÊ ESTÁ NO LUGAR CERTO"}
      </span>
      <h1>
        {attendance ? "Presença confirmada!" : "Vamos registrar sua presença?"}
      </h1>
      <p>{a.event_name}</p>
      <div className="panel checkin-card">
        <h2>{a.title}</h2>
        <p>
          <Clock3 size={17} />
          {time(a.starts_at, a.timezone)}–{time(a.ends_at, a.timezone)} ·{" "}
          {hours(attendance?.minutes ?? a.minutes)} de carga horária
        </p>
        {attendance ? (
          <>
            <Notice success>
              Registro salvo no servidor em{" "}
              {date(attendance.confirmed_at, a.timezone)} às{" "}
              {time(attendance.confirmed_at, a.timezone)}.
            </Notice>
            <Link className="button full" to="/historico">
              Ver minhas presenças <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <>
            <div className="privacy-note">
              <LocateFixed size={22} />
              <div>
                <strong>Uma localização, neste momento.</strong>
                <p>
                  Ao confirmar, solicitaremos sua posição e precisão para
                  registrar a evidência desta entrada. A coleta acontece apenas
                  nesta tentativa.
                </p>
                <Link to="/privacidade">
                  Entenda como funciona <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>
            {!a.enrolled ? (
              <>
                <Notice>
                  Você precisa se inscrever neste evento antes de confirmar a
                  presença.
                </Notice>
                <Link className="button full" to={`/eventos/${a.event_id}`}>
                  Ver evento e me inscrever
                </Link>
              </>
            ) : !raw ? (
              <Notice>
                Leia o QR Code atual exibido no local para continuar.
              </Notice>
            ) : (
              <Button className="full" busy={busy} onClick={confirm}>
                {" "}
                {busy ? step : "Confirmar presença"}{" "}
                {!busy && <Check size={19} />}
              </Button>
            )}
            {err && <Notice>{err}</Notice>}
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setErr("");
                try {
                  const p = await lookup();
                  if (!p)
                    setErr(
                      "Ainda não há presença confirmada nesta atividade. Você pode tentar novamente.",
                    );
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              <RefreshCw size={15} />
              Consultar minha situação
            </button>
          </>
        )}
      </div>
      <p className="fine-print">
        <ShieldCheck size={15} />
        Uma confirmação na entrada atribui as horas previstas.
      </p>
    </div>
  );
}
function Organizer() {
  const { data, error, loading } = useData("/organizer/events");
  return (
    <>
      <PageHeading
        eyebrow="ESPAÇO DA ORGANIZAÇÃO"
        title="Meus eventos"
        description="Dê espaço a novas conexões. Cuide de cada encontro por aqui."
        action={
          <Link className="button" to="/organizador/novo">
            <Plus size={18} />
            Criar evento
          </Link>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : !data.length ? (
        <Empty title="Seu primeiro evento começa aqui">
          <p>Crie um evento, adicione atividades e publique a programação.</p>
          <Link className="button" to="/organizador/novo">
            Criar evento
          </Link>
        </Empty>
      ) : (
        <div className="enrollment-list">
          {data.map((e: any) => (
            <Link
              className="panel enrollment-item"
              to={`/organizador/${e.id}`}
              key={e.id}
            >
              <div className="event-mini">
                <CalendarDays size={25} />
              </div>
              <div>
                <Status status={e.status} />
                <h3>{e.name}</h3>
                <p>
                  {date(e.starts_at, e.timezone)} · {e.enrollment_count}{" "}
                  inscritos
                </p>
              </div>
              <ArrowUpRight size={21} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span
      className={`badge ${status === "published" ? "green" : status === "closed" ? "gray" : "purple"}`}
    >
      {status === "published"
        ? "Publicado"
        : status === "closed"
          ? "Encerrado"
          : "Rascunho"}
    </span>
  );
}
function dateInput(v: string, tz: string) {
  if (!v) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(v));
  return parts.replace(" ", "T");
}
function toInstant(v: string, tz: string) {
  const wall = Date.parse(v + "Z");
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const rendered = dateInput(new Date(guess).toISOString(), tz);
    const delta = wall - Date.parse(rendered + "Z");
    guess += delta;
  }
  const out = new Date(guess).toISOString();
  if (dateInput(out, tz) !== v)
    throw new Error("Horário inexistente no fuso escolhido. Confira a data.");
  return out;
}
const eventDateFields = [
  ["starts_at", "Início do evento"],
  ["ends_at", "Fim do evento"],
  ["registration_starts_at", "Abertura das inscrições"],
  ["registration_ends_at", "Encerramento das inscrições"],
];
function EventForm() {
  const { id } = useParams(),
    nav = useNavigate(),
    { data, error, loading } = useData(id ? `/organizer/events/${id}` : null);
  const [tz, setTz] = useState("America/Sao_Paulo"),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setTz(data.timezone);
  }, [data]);
  if (id && loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
        string,
        string
      >;
      for (const [key] of eventDateFields) f[key] = toInstant(f[key], tz);
      const event = {
        ...f,
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
      };
      const r = id
        ? await put(`/organizer/events/${id}`, event)
        : await post("/organizer/events", event);
      nav(`/organizador/${id || r.id}`);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        className="back-link"
        to={id ? `/organizador/${id}` : "/organizador"}
      >
        <ArrowLeft size={16} />
        Voltar aos eventos
      </Link>
      <PageHeading
        eyebrow="DA IDEIA AO ENCONTRO"
        title={id ? "Editar evento" : "Vamos criar seu evento."}
        description="Comece pelas informações principais. Depois, adicione as atividades."
      />
      <form className="panel form-panel" onSubmit={submit}>
        <h2>Sobre o evento</h2>
        <Field
          label="Nome do evento"
          name="name"
          defaultValue={data?.name}
          minLength={3}
          maxLength={160}
          required
        />
        <label className="field">
          <span>Descrição</span>
          <textarea
            name="description"
            defaultValue={data?.description}
            minLength={10}
            maxLength={6000}
            rows={4}
            required
          />
        </label>
        <Field
          label="Local"
          name="location"
          defaultValue={data?.location}
          minLength={2}
          maxLength={300}
          placeholder="Campus, auditório ou sala"
          required
        />
        <EventLocationPicker
          key={id || "new"}
          latitude={data?.latitude}
          longitude={data?.longitude}
        />
        <label className="field">
          <span>Fuso horário do evento</span>
          <select
            name="timezone"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
          >
            {[
              ...new Set(
                [
                  "America/Sao_Paulo",
                  "America/Manaus",
                  "America/Rio_Branco",
                  "America/Noronha",
                  "UTC",
                  data?.timezone,
                ].filter(Boolean),
              ),
            ].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <small>Todos os horários abaixo são interpretados neste fuso.</small>
        </label>
        <div className="form-grid">
          {eventDateFields.map(([key, label]) => (
            <Field
              key={key + tz + data?.id}
              label={label}
              name={key}
              type="datetime-local"
              defaultValue={data ? dateInput(data[key], tz) : ""}
              required
            />
          ))}
        </div>
        {err && <Notice>{err}</Notice>}
        <div className="form-actions">
          <Link
            className="button secondary"
            to={id ? `/organizador/${id}` : "/organizador"}
          >
            Cancelar
          </Link>
          <Button busy={busy}>
            {id ? "Salvar alterações" : "Criar rascunho"}
            <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </>
  );
}
function ActivityForm({
  event,
  activity,
  onDone,
  onCancel,
}: {
  event: any;
  activity?: any;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const f = Object.fromEntries(new FormData(e.currentTarget));
      const body: any = { ...f, minutes: Number(f.minutes) };
      for (const key of [
        "starts_at",
        "ends_at",
        "checkin_starts_at",
        "checkin_ends_at",
      ])
        body[key] = toInstant(String(f[key]), event.timezone);
      if (activity) await put(`/organizer/activities/${activity.id}`, body);
      else await post(`/organizer/events/${event.id}/activities`, body);
      onDone();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel activity-form" onSubmit={submit}>
      <h2>{activity ? "Editar atividade" : "Nova atividade"}</h2>
      <p>
        Horários em {event.timezone}. A carga horária é atribuída integralmente
        na entrada.
      </p>
      <Field
        label="Título"
        name="title"
        defaultValue={activity?.title}
        minLength={3}
        maxLength={160}
        required
      />
      <div className="form-grid">
        {[
          ["starts_at", "Início"],
          ["ends_at", "Fim"],
          ["checkin_starts_at", "Abertura da janela de check-in"],
          ["checkin_ends_at", "Fim da janela de check-in"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            name={key}
            type="datetime-local"
            defaultValue={
              activity ? dateInput(activity[key], event.timezone) : ""
            }
            required
          />
        ))}
        <Field
          label="Carga horária prevista (minutos)"
          name="minutes"
          type="number"
          min={1}
          max={1440}
          defaultValue={activity?.minutes || 60}
          required
        />
      </div>
      {err && <Notice>{err}</Notice>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancelar
        </button>
        <Button busy={busy}>
          Salvar atividade <Check size={17} />
        </Button>
      </div>
    </form>
  );
}
function OrganizerDetail() {
  const { id } = useParams(),
    {
      data: e,
      error,
      loading,
      refresh,
    } = useData(`/organizer/events/${id}`, 10000),
    [tab, setTab] = useState("activities"),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<any>(null),
    [closing, setClosing] = useState(false);
  const enrolled = useData(
      tab === "enrollments" ? `/organizer/events/${id}/enrollments` : null,
    ),
    report = useData(
      tab === "report" ? `/organizer/events/${id}/report` : null,
    );
  async function action(path: string, body: unknown) {
    setBusy(true);
    setErr("");
    try {
      await post(path, body);
      await refresh();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/organizer/events/${id}/export`);
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "frequencia.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error && !e) return <Notice>{error}</Notice>;
  return (
    <>
      <Link className="back-link" to="/organizador">
        <ArrowLeft size={16} />
        Meus eventos
      </Link>
      <PageHeading
        eyebrow="PAINEL DO EVENTO"
        title={e.name}
        description={`${date(e.starts_at, e.timezone)} · ${e.location}`}
        action={
          <div className="actions">
            <Status status={e.status} />
            {e.status !== "closed" && (
              <Link
                className="button secondary small"
                to={`/organizador/${id}/editar`}
              >
                Editar evento
              </Link>
            )}
          </div>
        }
      />
      <div className="stat-grid four">
        <Stat
          icon={<Users />}
          label="Alunos inscritos"
          value={e.stats.enrollments}
        />
        <Stat
          icon={<CheckCircle2 />}
          label="Pessoas com presença"
          value={e.stats.people}
        />
        <Stat
          icon={<QrCode />}
          label="Check-ins registrados"
          value={e.stats.checkins}
        />
        <Stat
          icon={<Clock3 />}
          label="Horas atribuídas"
          value={hours(e.stats.minutes)}
        />
      </div>
      {(err || error) && <Notice>{err || error}</Notice>}
      <div className="panel publish-panel">
        <div>
          <h3>
            {e.status === "draft"
              ? "Tudo pronto para compartilhar?"
              : e.status === "closed"
                ? "Evento encerrado, história preservada."
                : "Seu evento está publicado."}
          </h3>
          <p>
            {e.status === "draft"
              ? "Adicione uma atividade e publique para abrir as inscrições."
              : e.status === "closed"
                ? "Inscrições e presenças continuam disponíveis para consulta."
                : "Compartilhe a página do evento e receba inscrições."}
          </p>
        </div>
        {e.status === "draft" ? (
          <Button
            busy={busy}
            onClick={() =>
              action(`/organizer/events/${id}/status`, { status: "published" })
            }
          >
            Publicar evento <ArrowUpRight size={17} />
          </Button>
        ) : e.status === "published" ? (
          <div className="actions">
            <Link className="button secondary small" to={`/eventos/${id}`}>
              Ver página pública <ExternalLink size={15} />
            </Link>
            <button
              className="text-button danger"
              onClick={() => setClosing(true)}
            >
              Encerrar evento
            </button>
          </div>
        ) : null}
      </div>
      {closing && (
        <div className="notice close-confirm">
          <div>
            <strong>Encerrar este evento?</strong>
            <p>
              As inscrições e os check-ins serão fechados. O histórico será
              preservado e o evento não poderá ser reaberto.
            </p>
          </div>
          <button className="secondary" onClick={() => setClosing(false)}>
            Cancelar
          </button>
          <Button
            busy={busy}
            onClick={async () => {
              await action(`/organizer/events/${id}/status`, {
                status: "closed",
              });
              setClosing(false);
            }}
          >
            Confirmar encerramento
          </Button>
        </div>
      )}
      <div className="tab-bar">
        <button
          className={tab === "activities" ? "active" : ""}
          onClick={() => setTab("activities")}
        >
          Atividades <span>{e.activities.length}</span>
        </button>
        <button
          className={tab === "enrollments" ? "active" : ""}
          onClick={() => setTab("enrollments")}
        >
          Inscritos
        </button>
        <button
          className={tab === "report" ? "active" : ""}
          onClick={() => setTab("report")}
        >
          Relatório de frequência
        </button>
      </div>
      {tab === "activities" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Programação e check-in</h2>
              <p>Abra a entrada dentro da janela de cada atividade.</p>
            </div>
            {e.status !== "closed" && (
              <button
                className="secondary small"
                onClick={() => setEditing({})}
              >
                <Plus size={17} />
                Nova atividade
              </button>
            )}
          </div>
          {editing && (
            <ActivityForm
              key={editing.id || "new"}
              event={e}
              activity={editing.id ? editing : undefined}
              onCancel={() => setEditing(null)}
              onDone={() => {
                setEditing(null);
                void refresh();
              }}
            />
          )}
          {!e.activities.length ? (
            <Empty title="Uma boa programação começa aqui">
              <p>Crie a primeira atividade do evento.</p>
            </Empty>
          ) : (
            e.activities.map((a: any) => (
              <div className="panel organizer-activity" key={a.id}>
                <div className="activity-head">
                  <div>
                    <span className={`badge ${a.is_open ? "green" : "gray"}`}>
                      <span className="tiny-dot" />
                      {a.is_open ? "Check-in aberto" : "Check-in fechado"}
                    </span>
                    <h3>{a.title}</h3>
                    <p>
                      {date(a.starts_at, e.timezone)} ·{" "}
                      {time(a.starts_at, e.timezone)}–
                      {time(a.ends_at, e.timezone)} · {hours(a.minutes)}
                    </p>
                    <p className="fine-print">
                      Janela:{" "}
                      {date(a.checkin_starts_at, e.timezone, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      a{" "}
                      {date(a.checkin_ends_at, e.timezone, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="attendance-count">
                    <strong>{a.attendance_count}</strong>
                    <span>presenças</span>
                  </div>
                </div>
                <div className="activity-actions">
                  {e.status !== "closed" && (
                    <>
                      <Button
                        className={a.is_open ? "secondary small" : "small"}
                        busy={busy}
                        onClick={() =>
                          action(`/organizer/activities/${a.id}/state`, {
                            open: !a.is_open,
                          })
                        }
                      >
                        {a.is_open ? "Fechar check-in" : "Abrir check-in"}
                      </Button>
                      {a.is_open ? (
                        <Link
                          className="button small"
                          to={`/projecao/${a.id}`}
                          target="_blank"
                        >
                          <Monitor size={17} />
                          Exibir QR Code <ArrowUpRight size={15} />
                        </Link>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() => setEditing(a)}
                        >
                          Editar atividade
                        </button>
                      )}
                    </>
                  )}
                  <span className="fine-print">
                    {hours(a.minutes)} por presença confirmada
                  </span>
                </div>
              </div>
            ))
          )}
        </>
      )}
      {tab === "enrollments" &&
        (enrolled.loading ? (
          <Loading />
        ) : enrolled.error ? (
          <Notice>{enrolled.error}</Notice>
        ) : !enrolled.data?.length ? (
          <Empty title="As inscrições aparecerão aqui" />
        ) : (
          <div className="panel table-panel">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Matrícula</th>
                  <th>Inscrição</th>
                </tr>
              </thead>
              <tbody>
                {enrolled.data.map((n: any) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.name}</strong>
                      <small>{n.email}</small>
                    </td>
                    <td>{n.registration || "—"}</td>
                    <td>{date(n.created_at, e.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {tab === "report" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Presenças registradas</h2>
              <p>
                Uma linha por aluno e atividade. Coordenadas não são incluídas.
              </p>
            </div>
            <Button className="secondary small" busy={busy} onClick={download}>
              <Download size={17} />
              Exportar CSV
            </Button>
          </div>
          {report.loading ? (
            <Loading />
          ) : report.error ? (
            <Notice>{report.error}</Notice>
          ) : !report.data?.length ? (
            <Empty title="Nenhuma presença confirmada" />
          ) : (
            <div className="panel table-panel">
              <table>
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Atividade</th>
                    <th>Confirmação</th>
                    <th>Carga horária</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((p: any, i: number) => (
                    <tr key={i}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{p.registration || p.email}</small>
                      </td>
                      <td>{p.activity_title}</td>
                      <td>
                        {date(p.confirmed_at, e.timezone)}{" "}
                        {time(p.confirmed_at, e.timezone)}
                      </td>
                      <td>{hours(p.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
function Projection() {
  const { id } = useParams(),
    [qr, setQr] = useState<any>(null),
    [img, setImg] = useState(""),
    [err, setErr] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [tick, setTick] = useState(Date.now()),
    [lastSeen, setLastSeen] = useState(0);
  useEffect(() => {
    let alive = true,
      refreshing = false;
    let current: any = null;
    let offset = 0;
    async function load() {
      if (refreshing || !navigator.onLine) return;
      refreshing = true;
      try {
        const a = await api(`/organizer/activities/${id}`);
        if (
          !a.is_open ||
          a.event_status !== "published" ||
          Date.parse(a.checkin_ends_at) <= Date.parse(a.server_time)
        ) {
          current = null;
          if (alive) {
            setQr(null);
            setErr("O check-in está fechado ou fora da janela.");
          }
          return;
        }
        if (
          !current ||
          Date.now() + offset >= Date.parse(current.expires_at) - 30000
        ) {
          const r = await post(`/organizer/activities/${id}/qr`);
          offset = Date.parse(r.server_time) - Date.now();
          const image = await QRCode.toDataURL(r.url, {
            width: 640,
            margin: 3,
            errorCorrectionLevel: "M",
            color: { dark: "#171b32", light: "#ffffff" },
          });
          current = { ...r, offset };
          if (alive) {
            setQr(current);
            setImg(image);
          }
        }
        if (alive) {
          setLastSeen(Date.now());
          setErr("");
          setOnline(true);
        }
      } catch (ex) {
        if (alive) {
          setErr((ex as Error).message);
          setOnline(false);
        }
      } finally {
        refreshing = false;
      }
    }
    void load();
    const timer = setInterval(() => {
      if (alive) setTick(Date.now());
    }, 1000);
    const poll = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    const net = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void load();
    };
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, [id]);
  const left = qr
    ? Math.max(
        0,
        Math.floor(
          (Date.parse(qr.expires_at) - tick - (qr.offset || 0)) / 1000,
        ),
      )
    : 0;
  const valid = qr && left > 0 && online && tick - lastSeen < 12000;
  return (
    <div className="projection">
      <Link className="brand" to="/">
        <span className="brand-mark">
          <GraduationCap size={25} />
        </span>
        credencia.
      </Link>
      <div className="projection-title">
        <span className="eyebrow">REGISTRO DE PRESENÇA</span>
        <h1>{qr?.activity || "Check-in da atividade"}</h1>
        <p>{qr?.event_name || "Aguardando abertura da entrada"}</p>
      </div>
      <div className="projection-content">
        <div className="projected-code">
          {valid ? (
            <img
              src={img}
              alt="QR Code para confirmar presença nesta atividade"
            />
          ) : (
            <div className="qr-unavailable">
              <WifiOff size={48} />
              <h2>QR Code indisponível</h2>
              <p>{err || "Reconectando e atualizando o código…"}</p>
            </div>
          )}
        </div>
        <div className="projection-steps">
          <span className={`badge ${valid ? "green" : "gray"}`}>
            {valid ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
            {valid ? "Conectado · Código válido" : "Código indisponível"}
          </span>
          <h2>
            Sua presença
            <br />
            começa por aqui.
          </h2>
          <p>
            <b>01</b> Abra a câmera do seu celular.
          </p>
          <p>
            <b>02</b> Aponte para o QR Code e abra o link.
          </p>
          <p>
            <b>03</b> Entre, permita a localização e confirme.
          </p>
          <div className="validity">
            <Clock3 size={19} />
            {valid
              ? `Este código renova em até ${left}s`
              : "A confirmação exige conexão."}
          </div>
        </div>
      </div>
      <p className="projection-footer">
        Aguarde a mensagem de confirmação no seu celular.{" "}
        <span>Uma entrada · Carga horária integral</span>
      </p>
    </div>
  );
}
function Privacy() {
  return (
    <div className="panel prose">
      <PageHeading
        eyebrow="TRANSPARÊNCIA"
        title="Localização no momento da entrada"
      />
      <h2>O que é registrado</h2>
      <p>
        Ao confirmar a presença, o sistema solicita uma nova leitura de
        latitude, longitude, precisão estimada e horário de captura. O servidor
        registra também o horário de recebimento e a carga horária prevista na
        atividade.
      </p>
      <h2>Por que solicitamos a posição</h2>
      <p>
        A localização compõe a evidência da tentativa de entrada na atividade. O
        servidor aceita novas presenças a até 100 m das coordenadas do evento. A
        localização é solicitada no momento da confirmação.
      </p>
      <h2>Acesso e relatórios</h2>
      <p>
        Você consulta apenas seu próprio histórico. A organização consulta
        inscritos e frequência dos eventos sob sua responsabilidade. Coordenadas
        não aparecem nos relatórios CSV comuns nem no painel de organização. O
        acesso técnico ao banco deve ser restrito aos responsáveis pela
        operação.
      </p>
      <h2>Antes de um evento com dados reais</h2>
      <p>
        A instituição responsável precisa informar a finalidade, a base legal,
        os responsáveis, o canal para solicitações e o prazo de retenção. A
        autorização do navegador não substitui essas definições. A aplicação
        oferece remoção das coordenadas por prazo configurado, preservando o
        histórico de presença.
      </p>
      <h2>Quando a localização não funciona</h2>
      <p>
        Se a permissão for negada ou a leitura falhar, a presença não será
        confirmada automaticamente. Habilite a localização nas configurações do
        navegador e tente novamente. O fluxo precisa de HTTPS e conexão com a
        internet.
      </p>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await api("/auth/me");
      setUser(r.user);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  return (
    <Auth.Provider value={{ user, loading, refresh }}>
      <BrowserRouter>
        {error ? (
          <div className="narrow panel">
            <Notice>{error}</Notice>
            <Button onClick={() => refresh().catch(() => {})}>
              Reconectar
            </Button>
          </div>
        ) : (
          <Shell />
        )}
      </BrowserRouter>
    </Auth.Provider>
  );
}
