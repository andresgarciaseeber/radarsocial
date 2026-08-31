// Lee el header x-rate-limit-reset (unix seconds) de una respuesta o error de X.
function parseRateLimitReset(headers) {
  const resetHeader = headers?.['x-rate-limit-reset'];
  if (!resetHeader) return null;
  return new Date(Number(resetHeader) * 1000);
}

function esRateLimitError(err) {
  return err?.response?.status === 429;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { parseRateLimitReset, esRateLimitError, sleep };
