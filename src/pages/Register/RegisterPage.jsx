import { useEffect, useRef, useState } from "react";
import { register } from "../../services/authService";
import {
  datosIniciales,
  validarCuenta,
  prepararCuenta,
} from "./accountRegistration";

export default function RegisterPage({ onLogin }) {
  const [datos, setDatos] = useState({ ...datosIniciales });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const titulo = useRef(null);
  const envioEnCurso = useRef(false);
  const hayCambios = Object.values(datos).some((valor) => valor !== "");

  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo(0, 0);
  }, [resultado]);

  useEffect(() => {
    if (!hayCambios || resultado) return;
    function avisarSalida(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisarSalida);
    return () => window.removeEventListener("beforeunload", avisarSalida);
  }, [hayCambios, resultado]);

  function cambiarCampo(event) {
    const { name, value } = event.target;
    setDatos({ ...datos, [name]: value });
    setErrores({ ...errores, [name]: undefined });
    setError("");
  }

  function volverAlLogin() {
    if (
      !hayCambios ||
      window.confirm("¿Volver al login? Se perderán los datos sin enviar.")
    ) {
      onLogin();
    }
  }

  async function crearCuenta(event) {
    event.preventDefault();
    if (envioEnCurso.current) return;

    // 1. Revisamos los seis campos antes de contactar al servidor.
    const erroresEncontrados = validarCuenta(datos);
    setErrores(erroresEncontrados);
    setError("");
    const primerError = Object.keys(erroresEncontrados)[0];
    if (primerError) {
      document.getElementById(primerError)?.focus();
      return;
    }

    // 2. Bloqueamos el botón mientras se procesa el envío.
    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const respuesta = await register(prepararCuenta(datos));
      setResultado(respuesta);
      setDatos({ ...datosIniciales });
      setMostrarPassword(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setEnviando(false);
      envioEnCurso.current = false;
    }
  }

  // Reutilizamos el mismo dibujo para no repetir las etiquetas y los errores.
  function campo(nombre, etiqueta, opciones = {}) {
    return (
      <div className="mb-5 min-w-0">
        <label
          className="mb-[9px] block text-[11px] font-semibold"
          htmlFor={nombre}
        >
          {etiqueta}
        </label>
        <input
          className="h-[47px] w-full rounded-lg border border-solid border-[#d8d9d0] bg-white px-[15px] py-0 text-[13px] text-[#163f2e] shadow-[0_1px_2px_#00000006] placeholder:text-[#8991a0] aria-invalid:border-[#a83434]"
          id={nombre}
          name={nombre}
          value={datos[nombre]}
          onChange={cambiarCampo}
          aria-invalid={Boolean(errores[nombre])}
          aria-describedby={errores[nombre] ? `${nombre}-error` : undefined}
          {...opciones}
        />
        {errores[nombre] && (
          <p
            className="mt-[7px] mb-0 text-xs text-[#972a2a]"
            id={`${nombre}-error`}
          >
            {errores[nombre]}
          </p>
        )}
      </div>
    );
  }

  return (
    <main className="grid min-h-svh grid-cols-1 grid-rows-[auto_1fr] min-[761px]:grid-cols-[28%_72%] min-[761px]:grid-rows-1">
      <aside className="flex flex-col justify-between gap-[18px] bg-bosque p-6 text-white min-[761px]:sticky min-[761px]:top-0 min-[761px]:h-svh min-[761px]:gap-16 min-[761px]:overflow-auto min-[761px]:px-[34px] min-[761px]:pt-[42px]">
        <div className="flex items-center gap-[9px] font-serif text-[23px] font-normal">
          ◒ KaabMap
        </div>
        <div className="hidden min-[761px]:block">
          <p className="text-[11px] tracking-[2.4px]">CIATEJ · SURESTE</p>
          <h2 className="my-5 font-serif text-[28px] leading-[1.2] font-normal">
            Crea tu cuenta
          </h2>
          <p className="text-xs leading-[1.8] text-[#e3eee6]">
            Regístrate para acceder a la plataforma.
          </p>
          <p className="text-xs leading-[1.8] text-[#e3eee6]">
            El registro de un meliponario se realiza después, en un apartado
            independiente.
          </p>
        </div>
        <small className="hidden text-[9px] tracking-[1px] min-[761px]:block">
          © 2026 CIATEJ · UNIDAD SURESTE
        </small>
      </aside>

      <section className="px-[22px] py-[30px] min-[761px]:px-9 min-[761px]:py-11">
        <div className="mx-auto max-w-[560px]">
          <h1
            className="mt-7 mb-3 font-serif text-[32px] leading-[1.2] font-normal focus:outline-none"
            ref={titulo}
            tabIndex="-1"
          >
            {resultado ? "Revisa tu acceso" : "Crear cuenta"}
          </h1>
          {resultado ? (
            <div role="status">
              <p>
                {resultado.emailVerificationRequired
                  ? "Si el registro procede, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión."
                  : "Tu sesión está disponible. Puedes continuar al acceso."}
              </p>
              <button
                className="min-h-[49px] w-full rounded-[9px] border border-solid border-bosque bg-bosque p-3 text-[13px] text-white shadow-[0_4px_8px_#082f211b] enabled:hover:bg-[#14513b]"
                onClick={onLogin}
              >
                Ir al login
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={crearCuenta} aria-busy={enviando}>
              <p className="mt-0 mb-[30px] text-xs leading-[1.6] text-[#626e65]">
                Completa tus datos para registrarte en la plataforma.
              </p>
              <fieldset
                className="m-0 min-w-0 border-0 p-0"
                disabled={enviando}
              >
                <div className="grid grid-cols-1 gap-0 min-[421px]:grid-cols-2 min-[421px]:gap-[18px]">
                  {campo("firstName", "Nombre(s)", {
                    autoComplete: "given-name",
                    required: true,
                    maxLength: 150,
                  })}
                  {campo("lastName", "Apellidos", {
                    autoComplete: "family-name",
                    required: true,
                    maxLength: 150,
                  })}
                </div>
                {campo("phone", "Teléfono (opcional)", {
                  type: "tel",
                  autoComplete: "tel",
                  maxLength: 25,
                  placeholder: "9991234567",
                })}
                {campo("email", "Correo electrónico", {
                  type: "email",
                  autoComplete: "email",
                  autoCapitalize: "none",
                  spellCheck: false,
                  required: true,
                })}
                {campo("password", "Contraseña", {
                  type: mostrarPassword ? "text" : "password",
                  autoComplete: "new-password",
                  required: true,
                })}
                {campo("confirmPassword", "Confirmar contraseña", {
                  type: mostrarPassword ? "text" : "password",
                  autoComplete: "new-password",
                  required: true,
                })}
                <p className="text-xs leading-[1.6] text-[#626e65]">
                  Utiliza entre 8 y 128 caracteres.
                </p>
                <label className="m-0 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[7px] border border-solid border-[#d8d9d0] bg-white p-3 text-xs font-normal has-checked:border-[#527765] has-checked:bg-[#f0f6f0]">
                  <input
                    className="h-[15px] w-[15px] shrink-0 p-0 accent-[#0b4730]"
                    type="checkbox"
                    checked={mostrarPassword}
                    onChange={(event) =>
                      setMostrarPassword(event.target.checked)
                    }
                  />
                  Mostrar contraseñas
                </label>
              </fieldset>
              {error && (
                <p
                  className="rounded-[7px] border border-solid border-[#e4b3a9] bg-[#fff0ed] p-3 text-[13px] leading-[1.5] text-[#842a20]"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <div className="mt-8 flex gap-3">
                <button
                  className="min-h-[49px] w-full rounded-[9px] border border-solid border-bosque bg-bosque p-3 text-[13px] text-white shadow-[0_4px_8px_#082f211b] enabled:hover:bg-[#14513b]"
                  type="submit"
                  disabled={enviando}
                >
                  {enviando ? "Creando cuenta…" : "Crear cuenta"}
                </button>
              </div>
              <p className="my-[22px] text-center text-xs">
                ¿Ya tienes cuenta?{" "}
                <button
                  className="border-0 bg-transparent p-0 text-xs text-[#0b5037] hover:underline"
                  type="button"
                  onClick={volverAlLogin}
                  disabled={enviando}
                >
                  Iniciar sesión
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
