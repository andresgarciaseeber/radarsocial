const config = require('../config');
const { logger } = require('../utils/logger');
const { descifrar } = require('../collector/tokens');
const { refrescarSiNecesario } = require('../collector/collector');
const { parseRateLimitReset, esRateLimitError, sleep } = require('../utils/rateLimiter');
const xClient = require('../integrations/x.client');
const followerHeuristics = require('./followerHeuristics');

const SocialAccount    = require('../models/SocialAccount');
const AccountSnapshot  = require('../models/AccountSnapshot');
const AnalysisRun      = require('../models/AnalysisRun');
const FollowerSnapshot = require('../models/FollowerSnapshot');
const FollowerFlag     = require('../models/FollowerFlag');

function normalizarFollower(user) {
  const pm = user.public_metrics ?? {};
  return {
    follower_external_id: user.id,
    username:             user.username,
    display_name:         user.name,
    follower_count:        pm.followers_count ?? 0,
    following_count:       pm.following_count ?? 0,
    post_count:            pm.tweet_count ?? 0,
    account_created_at:    user.created_at ? new Date(user.created_at) : null,
    verified:              !!user.verified,
    profile_image_url:     user.profile_image_url ?? null,
    is_default_avatar:     followerHeuristics.esAvatarPorDefecto(user.profile_image_url, config),
  };
}

// Tolera duplicados (E11000) de un reintento sobre una página ya parcialmente guardada
async function insertarFollowersTolerante(docs) {
  if (!docs.length) return [];
  try {
    return await FollowerSnapshot.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err.insertedDocs) return err.insertedDocs;
    throw err;
  }
}

async function insertarFlagsTolerante(docs) {
  if (!docs.length) return;
  try {
    await FollowerFlag.insertMany(docs, { ordered: false });
  } catch (err) {
    if (!err.insertedDocs) throw err;
  }
}

async function buscarOCrearCorrida(cuenta, budgetUsd, triggeredBy) {
  let run = await AnalysisRun.findOne({ social_account_id: cuenta._id, status: 'en_progreso' });
  if (run) return run;

  const monto = budgetUsd || config.followerAnalysis.defaultBudgetUsd;
  if (!(monto > 0)) {
    const err = new Error('budget_usd debe ser mayor a 0');
    err.status = 400;
    throw err;
  }

  try {
    return await AnalysisRun.create({
      social_account_id:    cuenta._id,
      triggered_by:         triggeredBy,
      budget_usd:           monto,
      cost_per_profile_usd: config.followerAnalysis.costPerProfileUsd,
      bot_price_usd:        config.followerAnalysis.botPriceUsd,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Carrera: otra invocación ya creó la corrida — reanudarla
      run = await AnalysisRun.findOne({ social_account_id: cuenta._id, status: 'en_progreso' });
      if (run) return run;
    }
    throw err;
  }
}

// Costo cero: usa el último AccountSnapshot del recolector normal si existe.
// Solo llama a la API (1 owned read) si todavía no hay ningún snapshot.
async function bootstrapTotalFollowers(run, cuenta, userToken) {
  if (run.total_followers_reported) return;

  const ultimo = await AccountSnapshot.findOne({ social_account_id: cuenta._id })
    .sort({ snapshot_date: -1 }).lean();
  if (ultimo?.followers) {
    run.total_followers_reported = ultimo.followers;
    return;
  }

  const usuario = await xClient.obtenerUsuario(userToken);
  run.total_followers_reported = usuario.public_metrics?.followers_count || 0;
  run.spent_usd += run.cost_per_profile_usd;
}

async function ejecutarOReanudar(cuentaId, { budgetUsd, triggeredBy } = {}) {
  const cuenta = await SocialAccount.findById(cuentaId);
  if (!cuenta) {
    const err = new Error('Cuenta no encontrada');
    err.status = 404;
    throw err;
  }
  if (cuenta.platform !== 'x' || cuenta.connection_method !== 'oauth' || cuenta.connection_status !== 'conectada') {
    const err = new Error('La cuenta debe ser de X, conectada por OAuth y con estado "conectada"');
    err.status = 400;
    throw err;
  }

  const run = await buscarOCrearCorrida(cuenta, budgetUsd, triggeredBy);
  const margenMs = config.followerAnalysis.wallClockSafetyMarginSeconds * 1000;
  const inicio = Date.now();

  try {
    await refrescarSiNecesario(cuenta);
    const userToken = descifrar(cuenta.access_token);
    if (!userToken) throw new Error('Token descifrado vacío');

    await bootstrapTotalFollowers(run, cuenta, userToken);

    while (true) {
      if (Date.now() - inicio > margenMs) {
        logger.info(`Bot-analysis: margen de tiempo alcanzado, corrida ${run._id} queda en_progreso`);
        break;
      }

      const restante = run.budget_usd - run.spent_usd;
      if (restante < run.cost_per_profile_usd) {
        run.status = 'completado';
        run.finished_at = new Date();
        break;
      }

      const maxResults = Math.min(
        config.followerAnalysis.maxResultsHardCap,
        Math.max(1, Math.floor(restante / run.cost_per_profile_usd))
      );

      let pagina;
      try {
        pagina = await xClient.obtenerSeguidores(cuenta.external_id, userToken, {
          maxResults,
          paginationToken: run.pagination_token || undefined,
        });
      } catch (err) {
        if (!esRateLimitError(err)) throw err;

        const resetAt = parseRateLimitReset(err.response.headers) ?? new Date(Date.now() + 60_000);
        const esperaMs = resetAt.getTime() - Date.now();
        if (esperaMs > 0 && (Date.now() - inicio + esperaMs) < margenMs) {
          logger.warn(`Bot-analysis: rate limit, esperando ${Math.round(esperaMs / 1000)}s`);
          await sleep(esperaMs + 1000);
          continue;
        }
        logger.info(`Bot-analysis: rate limit no entra en el margen de tiempo, corrida ${run._id} queda en_progreso`);
        break;
      }

      if (pagina.users.length === 0) {
        run.status = 'completado';
        run.finished_at = new Date();
        run.pagination_token = null;
        break;
      }

      const normalizados = pagina.users.map(normalizarFollower);
      const docs = normalizados.map(n => ({ ...n, analysis_run_id: run._id, social_account_id: cuenta._id }));
      const insertados = await insertarFollowersTolerante(docs);

      const porId = new Map(normalizados.map(n => [n.follower_external_id, n]));
      const flags = [];
      let vacias = 0, sospechosas = 0;
      for (const doc of insertados) {
        const normalizado = porId.get(doc.follower_external_id);
        const clasificacion = followerHeuristics.clasificarFollower(normalizado, config);
        if (clasificacion.is_empty) vacias++;
        if (clasificacion.is_suspicious) sospechosas++;
        flags.push({
          follower_snapshot_id: doc._id,
          analysis_run_id:      run._id,
          social_account_id:    cuenta._id,
          is_empty:             clasificacion.is_empty,
          is_suspicious:        clasificacion.is_suspicious,
          suspicion_score:      clasificacion.suspicion_score,
          reasons:              clasificacion.reasons,
        });
      }
      await insertarFlagsTolerante(flags);

      run.spent_usd          += pagina.users.length * run.cost_per_profile_usd;
      run.followers_fetched  += pagina.users.length;
      run.vacias_count       += vacias;
      run.sospechosas_count  += sospechosas;
      run.pagination_token    = pagina.nextToken || null;
      run.coverage_pct = run.total_followers_reported > 0
        ? Math.min(100, (run.followers_fetched / run.total_followers_reported) * 100)
        : 0;

      await run.save();

      if (!pagina.nextToken) {
        run.status = 'completado';
        run.finished_at = new Date();
        break;
      }
    }
  } catch (err) {
    run.status = 'error';
    run.last_error = err.message?.slice(0, 500);
    run.finished_at = new Date();
    await run.save();
    throw err;
  }

  if (run.status === 'completado') {
    run.extrapolation_factor = run.followers_fetched > 0
      ? run.total_followers_reported / run.followers_fetched
      : 1;
    run.estimated_flagged_total = Math.round(run.sospechosas_count * run.extrapolation_factor);
    run.estimated_cost_flagged_usd = run.estimated_flagged_total * run.bot_price_usd;
  }

  await run.save();
  return run;
}

module.exports = { ejecutarOReanudar };
