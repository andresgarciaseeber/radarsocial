import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export async function obtenerAnalytics(cuentaId) {
  const { data } = await axios.get(`/api/analytics/${cuentaId}`, { headers: headers() });
  return data;
}

export async function analizarSentimiento(cuentaId) {
  const { data } = await axios.post(
    `/api/analytics/${cuentaId}/analizar-sentimiento`,
    {},
    { headers: headers() }
  );
  return data;
}
