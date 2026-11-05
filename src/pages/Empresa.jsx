import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Clock,
  CreditCard,
  Landmark,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { REGIMENES_TRIBUTARIOS, TIPOS_CUENTA } from '../lib/constants';

import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const EMPRESA_VACIA = {
  nombre_comercial: '',
  razon_social: '',
  nit: '',
  digito_verificacion: '',
  regimen_tributario: '',
  actividad_economica: '',
  direccion: '',
  ciudad: '',
  departamento_geografico: '',
  telefono: '',
  celular: '',
  email: '',
  sitio_web: '',
  horario: '',
  representante_legal: '',
  documento_representante: '',
  banco: '',
  tipo_cuenta: '',
  numero_cuenta: '',
  titular_cuenta: '',
  notas: '',
  actualizado_en: null,
  actualizado_por: '',
};

const CAMPOS_TEXTO = Object.keys(EMPRESA_VACIA).filter(
  (campo) => campo !== 'actualizado_en' && campo !== 'actualizado_por',
);

const claseInput =
  'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500';

function Campo({ id, etiqueta, ayuda, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-1">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-[10px] text-slate-500 mt-1">{ayuda}</p>}
    </div>
  );
}

function Tarjeta({ icono, titulo, descripcion, children }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-start gap-3 border-b border-slate-800 pb-3">
        <span className="text-blue-500 mt-0.5 shrink-0">{icono}</span>
        <div>
          <h2 className="text-sm font-bold text-white">{titulo}</h2>
          {descripcion && <p className="text-[11px] text-slate-400 mt-0.5">{descripcion}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Empresa({ perfil }) {
  const [empresa, setEmpresa] = useState(EMPRESA_VACIA);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [recarga, setRecarga] = useState(0);

  const { alerta, mostrar, cerrar } = useToast();

  const consultarEmpresa = useCallback(async () => {
    const { data, error: errorConsulta } = await supabase
      .from('empresa_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (errorConsulta) throw errorConsulta;
    return data;
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const fila = await consultarEmpresa();
        if (!activo) return;
        if (fila) {
          // Las columnas nuevas pueden llegar en null: se normalizan a '' para
          // que los inputs controlados y .trim() funcionen sin errores.
          const normalizada = { ...EMPRESA_VACIA };
          CAMPOS_TEXTO.forEach((campo) => {
            normalizada[campo] = fila[campo] ?? '';
          });
          normalizada.actualizado_en = fila.actualizado_en ?? null;
          normalizada.actualizado_por = fila.actualizado_por ?? '';
          setEmpresa(normalizada);
        } else {
          setEmpresa({ ...EMPRESA_VACIA, nombre_comercial: 'YiKev Stratos' });
        }
        setError('');
      } catch (err) {
        if (!activo) return;
        const mensaje = err.message || 'No se pudo cargar la información de la empresa.';
        setError(
          /empresa_config|does not exist|no existe|schema cache/i.test(mensaje)
            ? `${mensaje} — Falta aplicar la migración 003_admin_empresa.sql en Supabase.`
            : mensaje,
        );
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultarEmpresa, recarga]);

  const actualizarCampo = (campo, valor) => {
    setEmpresa((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm('');
  };

  const reintentar = () => {
    setCargando(true);
    setRecarga((valor) => valor + 1);
  };

  const handleGuardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorForm('');

    try {
      const nombre = empresa.nombre_comercial.trim();
      if (!nombre) throw new Error('El nombre comercial es obligatorio.');

      const email = empresa.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('El correo electrónico de la empresa no es válido.');
      }

      const payload = { id: 1 };
      CAMPOS_TEXTO.forEach((campo) => {
        payload[campo] = String(empresa[campo] ?? '').trim();
      });
      payload.actualizado_por = perfil?.nombre_completo || 'Administrador';

      const { error: errorUpsert } = await supabase.from('empresa_config').upsert(payload);

      if (errorUpsert) throw errorUpsert;

      mostrar('¡Empresa actualizada!', 'Los datos de la empresa se guardaron correctamente.', 'exito');
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setErrorForm(err.message || 'No se pudieron guardar los datos de la empresa.');
    } finally {
      setGuardando(false);
    }
  };

  const inicial = (empresa.nombre_comercial || 'Y').charAt(0).toUpperCase();

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Cargando información de la empresa...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      {/* Cabecera */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl font-black">
            {inicial}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-white truncate">
              {empresa.nombre_comercial || 'Configuración de la Empresa'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Datos legales, contacto, representación y cuentas del taller.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={reintentar}
          className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 transition-all shrink-0"
        >
          <RefreshCw size={14} /> Recargar
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-950/60 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs"
        >
          <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
          <p className="flex-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={reintentar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-semibold shrink-0"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">NIT</p>
          <p className="text-sm font-bold text-white font-mono mt-1 truncate">
            {empresa.nit ? `${empresa.nit}${empresa.digito_verificacion ? `-${empresa.digito_verificacion}` : ''}` : 'Sin registrar'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Ciudad</p>
          <p className="text-sm font-bold text-white mt-1 flex items-center gap-1.5 truncate">
            <MapPin size={14} className="text-blue-400 shrink-0" />
            {empresa.ciudad || 'Sin registrar'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Contacto</p>
          <p className="text-sm font-bold text-white mt-1 flex items-center gap-1.5 truncate">
            <Phone size={14} className="text-emerald-400 shrink-0" />
            {empresa.celular || empresa.telefono || 'Sin registrar'}
          </p>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-6">
        {errorForm && (
          <div
            role="alert"
            className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2"
          >
            <AlertCircle size={16} className="shrink-0" />
            {errorForm}
          </div>
        )}

        <Tarjeta
          icono={<Building2 size={18} />}
          titulo="Identificación tributaria"
          descripcion="Información legal con la que se factura y se firman contratos."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo id="empresa-nombre" etiqueta="Nombre comercial *">
              <input
                id="empresa-nombre"
                type="text"
                value={empresa.nombre_comercial}
                onChange={(evento) => actualizarCampo('nombre_comercial', evento.target.value)}
                placeholder="YiKev Stratos"
                className={claseInput}
                required
              />
            </Campo>
            <Campo id="empresa-razon" etiqueta="Razón social">
              <input
                id="empresa-razon"
                type="text"
                value={empresa.razon_social}
                onChange={(evento) => actualizarCampo('razon_social', evento.target.value)}
                placeholder="Nombre legal de la empresa"
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-nit" etiqueta="NIT">
              <input
                id="empresa-nit"
                type="text"
                inputMode="numeric"
                value={empresa.nit}
                onChange={(evento) => actualizarCampo('nit', evento.target.value)}
                placeholder="900000000"
                className={`${claseInput} font-mono`}
              />
            </Campo>
            <Campo id="empresa-dv" etiqueta="Dígito de verificación">
              <input
                id="empresa-dv"
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={empresa.digito_verificacion}
                onChange={(evento) => actualizarCampo('digito_verificacion', evento.target.value)}
                placeholder="—"
                className={`${claseInput} font-mono`}
              />
            </Campo>
            <Campo id="empresa-regimen" etiqueta="Régimen tributario">
              <select
                id="empresa-regimen"
                value={empresa.regimen_tributario}
                onChange={(evento) => actualizarCampo('regimen_tributario', evento.target.value)}
                className={claseInput}
              >
                <option value="">Selecciona una opción...</option>
                {REGIMENES_TRIBUTARIOS.map((regimen) => (
                  <option key={regimen} value={regimen}>
                    {regimen}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="empresa-actividad" etiqueta="Actividad económica">
              <input
                id="empresa-actividad"
                type="text"
                value={empresa.actividad_economica}
                onChange={(evento) => actualizarCampo('actividad_economica', evento.target.value)}
                placeholder="Fabricación e instalación de estructuras metálicas"
                className={claseInput}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta
          icono={<MapPin size={18} />}
          titulo="Contacto y ubicación"
          descripcion="Datos que aparecen en cotizaciones, facturas y hojas de ruta."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Campo id="empresa-direccion" etiqueta="Dirección principal">
                <input
                  id="empresa-direccion"
                  type="text"
                  value={empresa.direccion}
                  onChange={(evento) => actualizarCampo('direccion', evento.target.value)}
                  placeholder="Carrera 1 # 25-30, Centro"
                  className={claseInput}
                />
              </Campo>
            </div>
            <Campo id="empresa-ciudad" etiqueta="Ciudad / municipio">
              <input
                id="empresa-ciudad"
                type="text"
                value={empresa.ciudad}
                onChange={(evento) => actualizarCampo('ciudad', evento.target.value)}
                placeholder="Quibdó"
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-departamento" etiqueta="Departamento">
              <input
                id="empresa-departamento"
                type="text"
                value={empresa.departamento_geografico}
                onChange={(evento) => actualizarCampo('departamento_geografico', evento.target.value)}
                placeholder="Chocó"
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-telefono" etiqueta="Teléfono fijo">
              <input
                id="empresa-telefono"
                type="tel"
                value={empresa.telefono}
                onChange={(evento) => actualizarCampo('telefono', evento.target.value)}
                placeholder="604 000 0000"
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-celular" etiqueta="Celular / WhatsApp">
              <input
                id="empresa-celular"
                type="tel"
                value={empresa.celular}
                onChange={(evento) => actualizarCampo('celular', evento.target.value)}
                placeholder="311 000 0000"
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-email" etiqueta="Correo electrónico">
              <input
                id="empresa-email"
                type="email"
                value={empresa.email}
                onChange={(evento) => actualizarCampo('email', evento.target.value)}
                placeholder="contacto@empresa.com"
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-web" etiqueta="Sitio web">
              <input
                id="empresa-web"
                type="text"
                value={empresa.sitio_web}
                onChange={(evento) => actualizarCampo('sitio_web', evento.target.value)}
                placeholder="www.yikevstratos.com"
                className={claseInput}
              />
            </Campo>
          </div>
        </Tarjeta>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Tarjeta
            icono={<UserCheck size={18} />}
            titulo="Representante legal"
            descripcion="Persona que firma a nombre de la empresa."
          >
            <div className="space-y-4">
              <Campo id="empresa-rep" etiqueta="Nombre completo">
                <input
                  id="empresa-rep"
                  type="text"
                  value={empresa.representante_legal}
                  onChange={(evento) => actualizarCampo('representante_legal', evento.target.value)}
                  placeholder="Nombre del representante"
                  className={claseInput}
                />
              </Campo>
              <Campo id="empresa-rep-doc" etiqueta="Documento de identidad">
                <input
                  id="empresa-rep-doc"
                  type="text"
                  inputMode="numeric"
                  value={empresa.documento_representante}
                  onChange={(evento) =>
                    actualizarCampo('documento_representante', evento.target.value)
                  }
                  placeholder="C.C. 00000000"
                  className={`${claseInput} font-mono`}
                />
              </Campo>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-blue-300">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <p>Solo el rol administrador puede modificar esta información.</p>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta
            icono={<Landmark size={18} />}
            titulo="Información bancaria"
            descripcion="Cuenta para pagos de clientes y transferencias."
          >
            <div className="space-y-4">
              <Campo id="empresa-banco" etiqueta="Banco">
                <input
                  id="empresa-banco"
                  type="text"
                  value={empresa.banco}
                  onChange={(evento) => actualizarCampo('banco', evento.target.value)}
                  placeholder="Bancolombia"
                  className={claseInput}
                />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo id="empresa-tipo-cuenta" etiqueta="Tipo de cuenta">
                  <select
                    id="empresa-tipo-cuenta"
                    value={empresa.tipo_cuenta}
                    onChange={(evento) => actualizarCampo('tipo_cuenta', evento.target.value)}
                    className={claseInput}
                  >
                    <option value="">Selecciona...</option>
                    {TIPOS_CUENTA.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo id="empresa-numero-cuenta" etiqueta="Número de cuenta">
                  <input
                    id="empresa-numero-cuenta"
                    type="text"
                    inputMode="numeric"
                    value={empresa.numero_cuenta}
                    onChange={(evento) => actualizarCampo('numero_cuenta', evento.target.value)}
                    placeholder="000 000000 00"
                    className={`${claseInput} font-mono`}
                  />
                </Campo>
              </div>
              <Campo id="empresa-titular" etiqueta="Titular de la cuenta">
                <input
                  id="empresa-titular"
                  type="text"
                  value={empresa.titular_cuenta}
                  onChange={(evento) => actualizarCampo('titular_cuenta', evento.target.value)}
                  placeholder="Igual a la razón social"
                  className={claseInput}
                />
              </Campo>
            </div>
          </Tarjeta>
        </div>

        <Tarjeta
          icono={<Clock size={18} />}
          titulo="Operación y notas"
          descripcion="Horarios de atención e información interna de la empresa."
        >
          <div className="space-y-4">
            <Campo id="empresa-horario" etiqueta="Horario de atención">
              <input
                id="empresa-horario"
                type="text"
                value={empresa.horario}
                onChange={(evento) => actualizarCampo('horario', evento.target.value)}
                placeholder="Lunes a viernes 8:00 a.m. - 6:00 p.m. / Sábados 8:00 a.m. - 12:00 m."
                className={claseInput}
              />
            </Campo>
            <Campo id="empresa-notas" etiqueta="Notas internas">
              <textarea
                id="empresa-notas"
                rows={3}
                value={empresa.notas}
                onChange={(evento) => actualizarCampo('notas', evento.target.value)}
                placeholder="Información adicional, políticas internas, cobertura, etc."
                className={`${claseInput} resize-y`}
              />
            </Campo>
          </div>
        </Tarjeta>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <BadgeCheck size={14} className="text-emerald-500" />
            {empresa.actualizado_en
              ? `Última actualización: ${new Date(empresa.actualizado_en).toLocaleString('es-CO')}${
                  empresa.actualizado_por ? ` · ${empresa.actualizado_por}` : ''
                }`
              : 'Aún no se ha guardado la información de la empresa.'}
          </p>

          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {guardando ? 'Guardando...' : 'Guardar información'}
          </button>
        </div>
      </form>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-500 flex items-start gap-2">
        <CreditCard size={15} className="shrink-0 mt-0.5 text-slate-500" />
        <p>
          Esta información es privada del sistema. Los colaboradores autenticados pueden consultarla,
          pero solo un administrador puede modificarla. Ningún dato bancario se comparte fuera de la
          empresa.
        </p>
      </div>
    </div>
  );
}
