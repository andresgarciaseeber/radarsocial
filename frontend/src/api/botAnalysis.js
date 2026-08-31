import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export async function ejecutarAnalisis(cuentaId, budgetUsd) {
  const body = budgetUsd != null ? { budget_usd: budgetUsd } : {};
  const { data } = await axios.post(`/api/bot-analysis/cuentas/${cuentaId}/ejecutar`, body, { headers: headers() });
  return data;
}

export async function obtenerEstadoAnalisis(cuentaId) {
  const { data } = await axios.get(`/api/bot-analysis/cuentas/${cuentaId}/estado`, { headers: headers() });
  return data;
}

export async function obtenerResultadosAnalisis(cuentaId, runId) {
  const { data } = await axios.get(`/api/bot-analysis/cuentas/${cuentaId}/resultados`, {
    headers: headers(),
    params: runId ? { run_id: runId } : {},
  });
  return data;
}

export async function listarRunsAnalisis(cuentaId) {
  const { data } = await axios.get(`/api/bot-analysis/cuentas/${cuentaId}/runs`, { headers: headers() });
  return data;
}
