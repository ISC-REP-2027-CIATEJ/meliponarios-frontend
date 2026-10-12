import { useEffect, useRef, useState } from "react";
import {
  getSession,
  hasBackend,
  login,
  logout,
} from "../../services/authService";

function Eye({ visible }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="m3 3 18 18" />}
    </svg>
  );
}

export default function LoginPage({ onRegister, onExplore }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(hasBackend);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  const pending = useRef(false);
  const photo = import.meta.env.VITE_LOGIN_IMAGE?.trim();

  useEffect(() => {
    if (!hasBackend) return;
    let active = true;
    getSession()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch((err) => {
        if (active && err.status !== 401) setError(err.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function showNotice(message) {
    setNotice(message);
    dialog.current.showModal();
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = {};
    if (!email.trim()) next.email = "Escribe tu correo electrónico.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Escribe un correo válido.";
    if (!password) next.password = "Escribe tu contraseña.";
    setErrors(next);
    setError("");
    if (Object.keys(next).length) {
      (next.email ? emailInput : passwordInput).current.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      setUser(await login(email, password));
    } catch (err) {
      setError(err.message);
    } finally {
      setPassword("");
      setVisible(false);
      setBusy(false);
      pending.current = false;
    }
  }

  async function exitSession() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await logout();
      setUser(null);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 bg-crema text-bosque min-[701px]:grid-cols-[45%_55%]">
      <aside
        className="flex flex-col justify-between bg-linear-to-br from-[#42705a] via-[#163f2e] to-[#062d20] bg-cover bg-center p-6 text-white min-[701px]:px-10 min-[701px]:py-[42px] min-[1500px]:px-[65px] min-[1500px]:py-[55px]"
        style={
          photo
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(5,43,29,.12), rgba(5,43,29,.93)), url(${JSON.stringify(photo)})`,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-[9px] font-serif text-[21px] min-[701px]:text-[23px]">
          <svg
            aria-hidden="true"
            width="25"
            height="25"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20 3C10 2 3 6 4 13c0 3 2 5 5 5 7 1 11-6 11-15ZM3 22c2-8 7-12 13-15-5 4-8 8-10 15Z" />
          </svg>
          KaabMap
        </div>
        <div className="max-w-[460px] pt-[22px] pb-1 min-[701px]:py-[60px]">
          <p className="text-[11px] tracking-[2.4px]">CIATEJ · SEDE SURESTE</p>
          <h1 className="mt-[17px] mb-[22px] max-w-[400px] font-serif text-[29px] leading-[1.17] font-medium min-[701px]:max-w-none min-[701px]:text-[clamp(30px,3vw,46px)]">
            Gestión y monitoreo geoespacial de meliponarios.
          </h1>
          <p className="hidden max-w-[345px] text-sm leading-[1.7] text-[#e4e9e4] min-[701px]:block">
            Plataforma para el seguimiento técnico de abejas nativas en la
            región peninsular.
          </p>
        </div>
        <small className="hidden text-[9px] tracking-[1px] min-[701px]:block">
          © 2026 CIATEJ · UNIDAD SURESTE
        </small>
      </aside>

      <section
        className="grid items-center px-6 py-[38px] min-[701px]:px-[35px] min-[701px]:py-16"
        aria-labelledby="access-title"
      >
        <div className="mx-auto w-full max-w-[360px]">
          {onExplore && <button type="button" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-2 text-sm text-bosque enabled:hover:bg-[#ecf0ea]" onClick={onExplore} disabled={busy}><span aria-hidden="true">←</span> Volver a Explorar</button>}
          <h2
            id="access-title"
            className="m-0 mb-4 font-serif text-[30px] leading-[1.2] font-medium"
          >
            {user ? "Sesión iniciada" : "Acceso al Sistema"}
          </h2>
          <p className="m-0 mb-9 text-xs leading-[1.6] tracking-[.3px] text-[#626878]">
            {user
              ? "Tu acceso fue validado por el servidor."
              : "Ingrese sus credenciales para continuar."}
          </p>

          {checking && <p role="status">Comprobando sesión…</p>}

          {!checking && user && (
            <div>
              <p className="my-6 text-sm leading-[1.6]" role="status">
                Bienvenido{user.name ? `, ${user.name}` : ""}. El dashboard se
                implementará en una siguiente etapa.
              </p>
              <button
                className="min-h-[49px] w-full rounded-[9px] border border-solid border-bosque bg-bosque p-3 text-[13px] text-white shadow-sm enabled:hover:bg-[#14513b]"
                onClick={exitSession}
                disabled={busy}
              >
                {busy ? "Cerrando sesión…" : "Cerrar sesión"}
              </button>
            </div>
          )}

          {!checking && !user && (
            <form onSubmit={submit} noValidate aria-busy={busy}>
              <div className="mb-[23px]">
                <label
                  htmlFor="email"
                  className="mb-[9px] block text-xs font-semibold"
                >
                  Correo electrónico
                </label>
                <input
                  className="h-[47px] w-full rounded-lg border border-solid border-[#dce0e5] bg-white px-[15px] text-[13px] text-[#163f2e] shadow-xs placeholder:text-[#8991a0] aria-invalid:border-[#a83434]"
                  ref={emailInput}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="usuario@ciatej.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p
                    className="m-0 mt-[7px] text-xs text-[#972a2a]"
                    id="email-error"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="mb-[23px]">
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="password"
                    className="mb-[9px] block text-xs font-semibold"
                  >
                    Contraseña
                  </label>
                  <button
                    className="border-0 bg-transparent p-0 text-[10px] text-[#0b5037] hover:underline"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      showNotice(
                        "La recuperación de contraseña se conectará cuando el backend proporcione el flujo de recuperación. Todavía no se envían correos desde esta pantalla.",
                      )
                    }
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="h-[47px] w-full rounded-lg border border-solid border-[#dce0e5] bg-white pr-12 pl-[15px] text-[13px] text-[#163f2e] shadow-xs placeholder:text-[#8991a0] aria-invalid:border-[#a83434]"
                    ref={passwordInput}
                    id="password"
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                  />
                  <button
                    className="absolute top-0.5 right-0.5 grid size-[43px] place-items-center rounded-md border-0 bg-transparent p-0 text-[#798393]"
                    type="button"
                    onClick={() => setVisible(!visible)}
                    disabled={busy}
                    aria-label={
                      visible ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    aria-pressed={visible}
                  >
                    <Eye visible={visible} />
                  </button>
                </div>
                {errors.password && (
                  <p
                    className="m-0 mt-[7px] text-xs text-[#972a2a]"
                    id="password-error"
                  >
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="min-h-[49px] w-full rounded-[9px] border border-solid border-bosque bg-bosque p-3 text-[13px] text-white shadow-sm enabled:hover:bg-[#14513b]"
                disabled={busy}
              >
                {busy ? (
                  "Ingresando…"
                ) : (
                  <>
                    Entrar{" "}
                    <span className="ml-2.5" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="mt-3 min-h-[49px] w-full rounded-[9px] border border-solid border-bosque bg-transparent p-3 text-[13px] text-bosque enabled:hover:bg-[#ecf0ea]"
                disabled={busy}
                onClick={onRegister}
              >
                Registrarse
              </button>
            </form>
          )}

          {error && (
            <p
              className="rounded-[7px] border border-solid border-[#e4b3a9] bg-[#fff0ed] p-3 text-[13px] leading-[1.5] text-[#842a20]"
              role="alert"
            >
              {error}
            </p>
          )}
          <footer className="mt-10 border-0 border-t border-solid border-[#eceee8] pt-[29px] text-center text-[8px] tracking-[1.6px] text-[#717986]">
            CIATEJ · SURESTE
          </footer>
        </div>
      </section>

      <dialog
        className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-[15px] border border-solid border-[#d5ddd6] bg-crema p-7 text-bosque backdrop:bg-[#001c16a6]"
        ref={dialog}
        aria-labelledby="notice-title"
      >
        <h2
          id="notice-title"
          className="mt-0 font-serif text-[25px] font-normal"
        >
          Función pendiente
        </h2>
        <p className="mb-6 text-sm leading-[1.6]">{notice}</p>
        <form method="dialog">
          <button className="min-h-[49px] w-full rounded-[9px] border border-solid border-bosque bg-bosque p-3 text-[13px] text-white enabled:hover:bg-[#14513b]">
            Entendido
          </button>
        </form>
      </dialog>
    </main>
  );
}
