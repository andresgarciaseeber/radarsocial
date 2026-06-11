import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export async function listarCuentas() {
  const { data } = await axios.get('/api/cuentas', { headers: headers() });
  return data;
}

export async function eliminarCuenta(id) {
  const { data } = await axios.delete(`/api/cuentas/${id}`, { headers: headers() });
  return data;
}

export async function obtenerPlataformas() {
  const { data } = await axios.get('/api/plataformas');
  return data;
}

export async function iniciarOAuth(platform) {
  const { data } = await axios.get(`/auth/${platform}/iniciar`, { headers: headers() });
  return data.url;
}

export async function buscarCuentaX(username) {
  const { data } = await axios.get('/api/cuentas/buscar-x', {
    headers: headers(),
    params: { username: username.replace(/^@/, '') },
  });
  return data;
}

export async function agregarCuentaPublica(datos) {
  const { data } = await axios.post('/api/cuentas/agregar-publica', datos, { headers: headers() });
  return data;
}

export async function ejecutarRecolector() {
  const { data } = await axios.post('/api/collect', {}, { headers: headers() });
  return data;
}
