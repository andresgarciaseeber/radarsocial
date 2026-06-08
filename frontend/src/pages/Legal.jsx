import { useLocation, Link } from 'react-router-dom';

const CONTACTO = 'andresgarciaseeber@gmail.com';
const ACTUALIZADO = '2026-06-08';

const CONTENIDOS = {
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: (
      <>
        <p>
          Radar Social es un panel interno de monitoreo y análisis estadístico de cuentas de redes
          sociales (Facebook, Instagram, X/Twitter y TikTok) propiedad de su administrador. Esta
          política describe qué datos procesa la app y con qué fin.
        </p>

        <h3 style={h3}>Qué datos procesamos</h3>
        <ul style={ul}>
          <li>
            <strong>Datos de perfil de las cuentas conectadas:</strong> nombre de usuario, nombre
            visible, foto de perfil, descripción, cantidad de seguidores/seguidos y publicaciones.
          </li>
          <li>
            <strong>Contenido de las publicaciones y comentarios</strong> de las cuentas conectadas
            (texto, fecha, métricas de interacción como likes, comentarios y compartidos), usado
            únicamente para calcular estadísticas de alcance y participación.
          </li>
          <li>
            <strong>Tokens de acceso (cifrados)</strong> entregados por Meta o X al autorizar la
            conexión, necesarios para consultar periódicamente la información pública/autorizada de
            esas cuentas.
          </li>
        </ul>

        <h3 style={h3}>Para qué los usamos</h3>
        <p>
          Exclusivamente para generar estadísticas y reportes (evolución de seguidores, engagement
          de publicaciones, comentarios recibidos) que se muestran en el panel de administración de
          Radar Social. No usamos estos datos con fines publicitarios ni los vendemos ni compartimos
          con terceros.
        </p>

        <h3 style={h3}>Quién accede</h3>
        <p>
          Solo el/los administradores autenticados del panel (acceso con usuario y contraseña)
          pueden ver esta información. No es un servicio público ni recopila datos de visitantes del
          sitio.
        </p>

        <h3 style={h3}>Cuánto tiempo conservamos los datos</h3>
        <p>
          Mientras la cuenta permanezca conectada para monitoreo. Si se desconecta una cuenta desde
          el panel, dejamos de recolectar nueva información y eliminamos su token de acceso. Ver{' '}
          <Link to="/eliminacion-datos">instrucciones de eliminación de datos</Link>.
        </p>

        <h3 style={h3}>Contacto</h3>
        <p>
          Consultas sobre privacidad o tus datos: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        </p>
      </>
    ),
  },

  terminos: {
    titulo: 'Términos de servicio',
    cuerpo: (
      <>
        <p>
          Radar Social es una herramienta interna de monitoreo y análisis estadístico de cuentas de
          redes sociales. El acceso está restringido a usuarios autorizados mediante autenticación
          con usuario y contraseña.
        </p>

        <h3 style={h3}>Uso del servicio</h3>
        <ul style={ul}>
          <li>El panel solo debe usarse para monitorear cuentas propias o cuentas para las que el administrador cuenta con autorización.</li>
          <li>El acceso es personal e intransferible; el usuario es responsable de mantener segura su contraseña.</li>
          <li>No está permitido usar la información obtenida para fines distintos al análisis estadístico interno.</li>
        </ul>

        <h3 style={h3}>Disponibilidad</h3>
        <p>
          El servicio se ofrece "tal cual". Podemos modificar, suspender o discontinuar funciones del
          panel en cualquier momento, por ejemplo ante cambios en las APIs de las plataformas
          conectadas (Meta, X, TikTok).
        </p>

        <h3 style={h3}>Cambios en estos términos</h3>
        <p>
          Podemos actualizar estos términos para reflejar cambios en el funcionamiento de la app.
          La fecha de la última actualización figura al pie de esta página.
        </p>

        <h3 style={h3}>Contacto</h3>
        <p>
          Consultas: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        </p>
      </>
    ),
  },

  'eliminacion-datos': {
    titulo: 'Eliminación de datos de usuario',
    cuerpo: (
      <>
        <p>
          Si conectaste una cuenta de Facebook, Instagram, X/Twitter o TikTok a Radar Social y
          querés que dejemos de monitorearla y se elimine su información asociada, tenés dos
          opciones:
        </p>

        <h3 style={h3}>1. Desde el panel</h3>
        <p>
          Un administrador puede ir a la sección <strong>"Cuentas"</strong> y eliminar la cuenta
          desde el listado de cuentas monitoreadas. Esto desconecta la cuenta, borra el token de
          acceso guardado y detiene toda recolección futura de datos.
        </p>

        <h3 style={h3}>2. Por correo</h3>
        <p>
          Si querés que además eliminemos el historial de estadísticas, publicaciones y comentarios
          ya recolectados sobre una cuenta, escribinos a{' '}
          <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a> indicando la plataforma y el @usuario de la
          cuenta. Vamos a confirmar la eliminación dentro de los 30 días.
        </p>
      </>
    ),
  },
};

const h3 = { fontSize: '1rem', fontWeight: 700, marginTop: 24, marginBottom: 8, color: 'var(--color-texto)' };
const ul = { paddingLeft: 20, lineHeight: 1.6, fontSize: '0.92rem', color: 'var(--color-texto)' };

export default function Legal() {
  const tipo = useLocation().pathname.replace(/^\//, '');
  const contenido = CONTENIDOS[tipo];

  if (!contenido) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Página no encontrada</h1>
          <p>
            <Link to="/privacidad">Política de privacidad</Link> ·{' '}
            <Link to="/terminos">Términos de servicio</Link> ·{' '}
            <Link to="/eliminacion-datos">Eliminación de datos</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primario)', marginBottom: 4 }}>
          Radar Social
        </h1>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>{contenido.titulo}</h2>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--color-texto)' }}>
          {contenido.cuerpo}
        </div>
        <p style={{ marginTop: 32, fontSize: '0.78rem', color: 'var(--color-texto-secundario)' }}>
          Última actualización: {ACTUALIZADO}
        </p>
      </div>
    </div>
  );
}

const wrap = {
  minHeight: '100vh',
  background: 'var(--color-fondo)',
  display: 'flex',
  justifyContent: 'center',
  padding: '48px 16px',
};

const card = {
  background: 'var(--color-superficie)',
  borderRadius: 12,
  padding: '36px 40px',
  width: '100%',
  maxWidth: 720,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};
