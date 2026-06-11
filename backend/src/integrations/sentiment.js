const axios = require('axios');
const Comment = require('../models/Comment');
const { logger } = require('../utils/logger');

const BATCH_SIZE = 25;
const MODEL = 'claude-haiku-4-5-20251001';

async function analizarSentimientoComentarios(postIds) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('Sentimiento: ANTHROPIC_API_KEY no configurada, saltando análisis.');
    return 0;
  }

  const pendientes = await Comment.find({
    post_id: { $in: postIds },
    sentiment: null,
    content: { $exists: true, $ne: '' },
  }).lean();

  if (!pendientes.length) return 0;

  logger.info(`Sentimiento: analizando ${pendientes.length} comentario(s)...`);
  let procesados = 0;

  for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
    const lote = pendientes.slice(i, i + BATCH_SIZE);
    try {
      const resultados = await analizarLote(lote, apiKey);
      const ops = resultados
        .filter(r => ['positivo', 'neutro', 'negativo'].includes(r.sentimiento))
        .map(r => ({
          updateOne: {
            filter: { _id: r.id },
            update: { $set: { sentiment: r.sentimiento } },
          },
        }));
      if (ops.length) await Comment.bulkWrite(ops);
      procesados += lote.length;
    } catch (err) {
      logger.error('Sentimiento: error en lote:', err.message);
    }
  }

  logger.info(`Sentimiento: ${procesados} comentario(s) procesados.`);
  return procesados;
}

async function analizarLote(comentarios, apiKey) {
  const lista = comentarios.map(c => ({
    id: c._id.toString(),
    texto: (c.content || '').slice(0, 150),
  }));

  const prompt = `Analiza el sentimiento de cada comentario en español rioplatense. Responde ÚNICAMENTE con un array JSON sin texto adicional ni markdown. Cada elemento debe tener "id" (copia exacta del campo id del input) y "sentimiento" (uno de: "positivo", "neutro", "negativo").

${JSON.stringify(lista)}`;

  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }
  );

  const texto = data.content[0].text.trim();
  const json = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(json);
}

module.exports = { analizarSentimientoComentarios };
