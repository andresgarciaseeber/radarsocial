import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// Último snapshot de cada cuenta (cards del dashboard)
export async function obtenerResumen() {
  const { data } = await axios.get('/api/metricas/resumen', { headers: headers() });
  return data;
}

// Historial de snapshots de una cuenta (gráfico de tendencia)
// opciones: { desde, hasta, limite }
export async function obtenerHistorial(cuentaId, opciones = {}) {
  const { data } = await axios.get(`/api/metricas/${cuentaId}`, {
    headers: headers(),
    params: opciones,
  });
  return data;
}
