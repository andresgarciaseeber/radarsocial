require('dotenv').config();
const { conectar } = require('./index');
const SocialAccount   = require('../models/SocialAccount');
const AccountSnapshot = require('../models/AccountSnapshot');
const Post            = require('../models/Post');
const Comment         = require('../models/Comment');
const { logger }      = require('../utils/logger');

// Cuentas de demo (públicas de X, simuladas)
const CUENTAS_DEMO = [
  {
    external_id: 'demo_001',
    handle: 'LRiojaOnline',
    display_name: 'La Rioja Online',
    platform: 'x',
    seguidores_base: 18400,
    crecimiento_diario: 45,
    tweets_base: 3200,
  },
  {
    external_id: 'demo_002',
    handle: 'ElIndependiente',
    display_name: 'El Independiente',
    platform: 'x',
    seguidores_base: 34800,
    crecimiento_diario: 80,
    tweets_base: 8900,
  },
  {
    external_id: 'demo_003',
    handle: 'LaGacetaRiojana',
    display_name: 'La Gaceta Riojana',
    platform: 'x',
    seguidores_base: 9200,
    crecimiento_diario: 20,
    tweets_base: 5400,
  },
];

const POSTS_DEMO = [
  'El gobernador anunció nuevas obras de infraestructura para el interior de la provincia.',
  'Alerta meteorológica: se esperan lluvias intensas para el fin de semana en toda La Rioja.',
  'La economía regional muestra signos de recuperación según el último informe del INDEC.',
  'Festival Nacional del Chaya 2026: todo listo para la celebración más importante del año.',
  'Nuevas inversiones en energía solar para la región del Velazco.',
  'El municipio de la capital implementa plan de movilidad sustentable.',
  'Deporte riojano: el equipo local clasificó a la siguiente ronda del torneo regional.',
  'Turismo: récord de visitantes en el Parque Nacional Talampaya durante el verano.',
  'La provincia lanza programa de becas para estudiantes universitarios del interior.',
  'Conectividad: fibra óptica llega a 12 localidades del norte provincial.',
  'Cultura: apertura de la nueva sede del Museo Histórico Provincial.',
  'Emprendedores riojanos presentaron proyectos en el encuentro de innovación.',
];

const COMENTARIOS_DEMO = [
  '¡Excelente noticia para la provincia!',
  'Ya era hora de que se tomaran medidas al respecto.',
  'Muy importante para el desarrollo de la región.',
  'Esperemos que se concrete pronto.',
  '¿Alguien sabe más detalles sobre esto?',
  'Comparto la noticia, muy relevante.',
  'La comunidad lo venía pidiendo hace tiempo.',
  'Buena gestión.',
  'Hay que seguir de cerca este tema.',
  'Importante para el futuro de nuestra provincia.',
];

function variacion(base, pct = 0.05) {
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct));
}

function fechaHaceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isoDate(n) {
  return fechaHaceDias(n).toISOString().slice(0, 10);
}

async function seed() {
  await conectar();

  logger.info('Limpiando datos de demo anteriores...');
  await SocialAccount.deleteMany({ external_id: { $in: CUENTAS_DEMO.map(c => c.external_id) } });

  for (const cfg of CUENTAS_DEMO) {
    logger.info(`Creando cuenta demo: @${cfg.handle}`);

    const cuenta = await SocialAccount.create({
      platform:          cfg.platform,
      external_id:       cfg.external_id,
      handle:            cfg.handle,
      display_name:      cfg.display_name,
      connection_status: 'conectada',
      connection_method: 'publica',
      connected_at:      fechaHaceDias(35),
    });

    // 30 días de snapshots con crecimiento realista
    for (let dia = 30; dia >= 0; dia--) {
      const seguidores = variacion(cfg.seguidores_base - cfg.crecimiento_diario * dia, 0.02);
      await AccountSnapshot.findOneAndUpdate(
        { social_account_id: cuenta._id, snapshot_date: isoDate(dia) },
        {
          followers:       seguidores,
          following:       variacion(Math.round(seguidores * 0.15), 0.01),
          posts_count:     cfg.tweets_base + (30 - dia) * 3,
          reach:           variacion(seguidores * 8, 0.15),
          impressions:     variacion(seguidores * 22, 0.2),
          engagement_rate: parseFloat((Math.random() * 2.5 + 1.2).toFixed(2)),
          captured_at:     fechaHaceDias(dia),
        },
        { upsert: true }
      );
    }

    // 12 posts en los últimos 30 días
    for (let i = 0; i < 12; i++) {
      const diasAtras    = Math.floor(Math.random() * 28) + 1;
      const likes        = variacion(Math.floor(Math.random() * 800 + 50));
      const commCount    = variacion(Math.floor(Math.random() * 60 + 5));
      const texto        = POSTS_DEMO[i % POSTS_DEMO.length];
      const post = await Post.findOneAndUpdate(
        { social_account_id: cuenta._id, external_post_id: `${cfg.external_id}_post_${i}` },
        {
          social_account_id: cuenta._id,
          external_post_id:  `${cfg.external_id}_post_${i}`,
          type:              'texto',
          content_preview:   texto,
          url:               `https://x.com/${cfg.handle}/status/${cfg.external_id}${i}`,
          published_at:      fechaHaceDias(diasAtras),
          likes,
          comments_count: commCount,
          shares:         variacion(Math.floor(likes * 0.3)),
          views:          variacion(likes * 15),
          last_updated_at: new Date(),
        },
        { upsert: true, new: true }
      );

      // 3-6 comentarios por post
      const cantComent = Math.floor(Math.random() * 4) + 3;
      for (let j = 0; j < cantComent; j++) {
        await Comment.findOneAndUpdate(
          { post_id: post._id, external_comment_id: `comment_${i}_${j}` },
          {
            post_id:             post._id,
            external_comment_id: `comment_${i}_${j}`,
            author_handle:       `usuario_${Math.floor(Math.random() * 999)}`,
            content:             COMENTARIOS_DEMO[(i + j) % COMENTARIOS_DEMO.length],
            published_at:        fechaHaceDias(Math.max(0, diasAtras - j)),
            captured_at:         new Date(),
          },
          { upsert: true }
        );
      }
    }

    logger.info(`  @${cfg.handle}: 30 snapshots + 12 posts + ~45 comentarios`);
  }

  logger.info('');
  logger.info('Demo cargado. Cuentas creadas:');
  CUENTAS_DEMO.forEach(c => logger.info(`  x @${c.handle} — ~${c.seguidores_base.toLocaleString('es-AR')} seguidores`));
  logger.info('');
  logger.info('Levantá el backend y el frontend para ver el dashboard con datos.');
  process.exit(0);
}

seed().catch(err => {
  logger.error('Error en seed-demo:', err.message);
  process.exit(1);
});
