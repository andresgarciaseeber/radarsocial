require('dotenv').config();
const { conectar } = require('./index');
const SocialAccount   = require('../models/SocialAccount');
const AccountSnapshot = require('../models/AccountSnapshot');
const Post            = require('../models/Post');
const Comment         = require('../models/Comment');
const { logger }      = require('../utils/logger');

async function clearDemo() {
  await conectar();

  // 1. Encontrar cuentas demo (external_id demo_XXX generado por seed-demo.js)
  const demoIds = ['demo_001', 'demo_002', 'demo_003'];
  const cuentasDemo = await SocialAccount.find({ external_id: { $in: demoIds } }).select('_id handle').lean();

  if (cuentasDemo.length === 0) {
    logger.info('No se encontraron cuentas demo. Nada que limpiar.');
  } else {
    const ids = cuentasDemo.map(c => c._id);
    logger.info(`Cuentas demo encontradas: ${cuentasDemo.map(c => c.handle).join(', ')}`);

    // 2. Buscar posts de esas cuentas (para poder borrar sus comentarios)
    const posts = await Post.find({ social_account_id: { $in: ids } }).select('_id').lean();
    const postIds = posts.map(p => p._id);

    // 3. Borrar en orden: comentarios → posts → snapshots → cuentas
    const rComments  = await Comment.deleteMany({ post_id: { $in: postIds } });
    const rPosts     = await Post.deleteMany({ social_account_id: { $in: ids } });
    const rSnapshots = await AccountSnapshot.deleteMany({ social_account_id: { $in: ids } });
    const rCuentas   = await SocialAccount.deleteMany({ external_id: { $in: demoIds } });

    logger.info(`Eliminados: ${rCuentas.deletedCount} cuenta(s), ${rSnapshots.deletedCount} snapshot(s), ${rPosts.deletedCount} post(s), ${rComments.deletedCount} comentario(s)`);
  }

  // 4. También limpiar Posts, Comments y Snapshots huérfanos (sin cuenta padre)
  const cuentasVivas = await SocialAccount.find({}).select('_id').lean();
  const idsVivas = cuentasVivas.map(c => c._id);

  const huerfanosPosts     = await Post.deleteMany({ social_account_id: { $nin: idsVivas } });
  const huerfanosSnapshots = await AccountSnapshot.deleteMany({ social_account_id: { $nin: idsVivas } });

  const postIdsVivos  = (await Post.find({}).select('_id').lean()).map(p => p._id);
  const huerfanosComm = await Comment.deleteMany({ post_id: { $nin: postIdsVivos } });

  if (huerfanosPosts.deletedCount || huerfanosSnapshots.deletedCount || huerfanosComm.deletedCount) {
    logger.info(`Huérfanos eliminados: ${huerfanosPosts.deletedCount} post(s), ${huerfanosSnapshots.deletedCount} snapshot(s), ${huerfanosComm.deletedCount} comentario(s)`);
  }

  logger.info('Limpieza completa.');
  process.exit(0);
}

clearDemo().catch(err => {
  logger.error('Error en clear-demo:', err.message);
  process.exit(1);
});
