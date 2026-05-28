const express = require('express');
const router = express.Router();
const { getDb, logAction } = require('../db');

// GET /api/progress/:productId
router.get('/:productId', (req, res) => {
  const db = getDb();
  const progress = db.prepare(
    'SELECT * FROM product_progress WHERE product_id = ? ORDER BY stage_index'
  ).all(req.params.productId);
  res.json({ progress });
});

// PUT /api/progress/:id
router.put('/:id', (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const { status, planned_start, planned_end, actual_start, actual_end } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM product_progress WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '进度记录不存在' });

  const updates = [];
  const values = [];

  // 状态设为"已完成"时，强制计划结束时间为当前时间
  if (status === '已完成') {
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    updates.push('planned_end = ?'); values.push(todayStr);
    updates.push('status = ?'); values.push(status);
  } else if (status) {
    updates.push('status = ?'); values.push(status);
  }

  const newPlanStart = planned_start !== undefined ? planned_start : existing.planned_start;
  const newPlanEnd = planned_end !== undefined ? planned_end : existing.planned_end;
  // 状态为已完成时上面已经处理过了planned_end，不需要再处理
  if (status !== '已完成') {
    if (planned_start !== undefined) { updates.push('planned_start = ?'); values.push(planned_start); }
    if (planned_end !== undefined) { updates.push('planned_end = ?'); values.push(planned_end); }
  } else {
    if (planned_start !== undefined) { updates.push('planned_start = ?'); values.push(planned_start); }
  }

  // 计划结束时间不得早于计划开始时间
  if (newPlanEnd && newPlanStart && newPlanEnd < newPlanStart) {
    return res.status(400).json({ error: '计划结束时间不得早于计划开始时间' });
  }

  if (actual_start !== undefined) { updates.push('actual_start = ?'); values.push(actual_start); }
  if (actual_end !== undefined) { updates.push('actual_end = ?'); values.push(actual_end); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now','localtime')");
    values.push(req.params.id);
    db.prepare(`UPDATE product_progress SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const progress = db.prepare('SELECT * FROM product_progress WHERE id = ?').get(req.params.id);
  if (status && status !== existing.status) {
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(existing.product_id);
    const pName = product ? product.name : '未知产品';
    logAction(req.user.id, req.user.username, '更新进度', 'progress', progress.id,
      `产品"${pName}"-${existing.stage_name}: ${existing.status} → ${status}`);
  }
  res.json({ progress });
});

// POST /api/progress/batch - 批量更新产品进度
router.post('/batch', (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });

  const { product_ids, stage_configs } = req.body;
  if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: '请选择至少一个产品' });
  }

  if (!stage_configs || !Array.isArray(stage_configs) || stage_configs.length === 0) {
    return res.status(400).json({ error: '请选择至少一个阶段' });
  }

  // 构建 阶段索引 → 配置 的映射（空字段留空不更新）
  const stageConfigMap = new Map();
  for (const cfg of stage_configs) {
    const si = parseInt(cfg.stage_index);
    stageConfigMap.set(si, {
      planned_start: cfg.planned_start || undefined,
      planned_end: cfg.planned_end || undefined,
      status: cfg.status || undefined
    });
  }

  const stageIndexSet = new Set(stageConfigMap.keys());

  const db = getDb();
  const results = [];
  let errorCount = 0;

  for (const productId of product_ids) {
    // 获取该产品指定阶段的进度记录
    let progressRecords = db.prepare(
      'SELECT * FROM product_progress WHERE product_id = ? ORDER BY stage_index'
    ).all(productId);
    progressRecords = progressRecords.filter(r => stageIndexSet.has(r.stage_index));

    if (progressRecords.length === 0) continue;

    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
    const pName = product ? product.name : '未知产品';

    for (const record of progressRecords) {
      const cfg = stageConfigMap.get(record.stage_index);
      if (!cfg) continue;

      try {
        const updates = [];
        const values = [];

        // 状态设为"已完成"时，强制计划结束时间为当前时间
        if (cfg.status === '已完成') {
          const now = new Date();
          const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
          updates.push('planned_end = ?'); values.push(todayStr);
          updates.push('status = ?'); values.push(cfg.status);
        } else if (cfg.status) {
          updates.push('status = ?'); values.push(cfg.status);
        }

        const plannedStart = cfg.planned_start !== undefined ? cfg.planned_start : record.planned_start;
        const plannedEnd = cfg.planned_end !== undefined ? cfg.planned_end : record.planned_end;

        if (cfg.status !== '已完成') {
          if (cfg.planned_start !== undefined) { updates.push('planned_start = ?'); values.push(cfg.planned_start); }
          if (cfg.planned_end !== undefined) { updates.push('planned_end = ?'); values.push(cfg.planned_end); }
        } else {
          if (cfg.planned_start !== undefined) { updates.push('planned_start = ?'); values.push(cfg.planned_start); }
        }

        // 跳过日期校验中的无效比较
        if (plannedEnd && plannedStart && plannedEnd < plannedStart) {
          continue;
        }

        if (updates.length > 0) {
          updates.push("updated_at = datetime('now','localtime')");
          values.push(record.id);
          db.prepare(`UPDATE product_progress SET ${updates.join(', ')} WHERE id = ?`).run(...values);

          if (cfg.status && cfg.status !== record.status) {
            logAction(req.user.id, req.user.username, '批量更新进度', 'progress', record.id,
              `产品"${pName}"-${record.stage_name}: ${record.status} → ${cfg.status}`);
          }
        }

        results.push({
          id: record.id,
          product_id: productId,
          product_name: pName,
          stage_name: record.stage_name
        });
      } catch (e) {
        errorCount++;
      }
    }
  }

  res.json({
    success: true,
    updated: results.length,
    errors: errorCount,
    message: `成功更新 ${results.length} 条进度记录` + (errorCount > 0 ? `，${errorCount} 条失败` : '')
  });
});

// GET /api/progress/project/:projectId - 获取项目下所有产品进度汇总
router.get('/project/:projectId', (req, res) => {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products WHERE project_id = ? ORDER BY id').all(req.params.projectId);
  const result = [];
  for (const p of products) {
    const progress = db.prepare(
      'SELECT * FROM product_progress WHERE product_id = ? ORDER BY stage_index'
    ).all(p.id);
    result.push({ product: p, progress });
  }
  res.json({ products: result });
});

// GET /api/progress/warnings - 超时预警
// 支持筛选参数：?project_id=X 按项目筛选; ?product_id=X 按产品筛选
router.get('/warnings/all', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const projectId = req.query.project_id ? parseInt(req.query.project_id) : null;
  const productId = req.query.product_id ? parseInt(req.query.product_id) : null;

  let warnings = [];
  let projectWarnings = [];

  // 产品阶段超时
  // 两种情况：(1) 计划结束已过且未完成；(2) 状态为"未开始"（始终预警）
  // 排除状态为"不需要"的阶段
  let sql = `
    SELECT pp.*, pd.name as product_name, pd.project_id, pj.name as project_name
    FROM product_progress pp
    JOIN products pd ON pp.product_id = pd.id
    JOIN projects pj ON pd.project_id = pj.id
    WHERE pp.status != '不需要'
      AND (pp.planned_end != '' AND pp.planned_end < ? AND pp.status != '已完成'
           OR pp.status = '未开始')`;
  const params = [today];
  if (projectId) {
    sql += ' AND pd.project_id = ?';
    params.push(projectId);
  }
  if (productId) {
    sql += ' AND pp.product_id = ?';
    params.push(productId);
  }
  sql += ' ORDER BY pp.planned_end ASC';
  warnings = db.prepare(sql).all(...params);

  // 项目超时（产品筛选时仍显示所属项目）
  let projSql = `
    SELECT * FROM projects
    WHERE end_date != '' AND end_date < ? AND status != '已验收'`;
  const projParams = [today];
  if (projectId) {
    projSql += ' AND id = ?';
    projParams.push(projectId);
  }
  if (productId) {
    // 按产品筛选时，查找该产品所属项目
    projSql += ' AND id = (SELECT project_id FROM products WHERE id = ?)';
    projParams.push(productId);
  }
  projSql += ' ORDER BY end_date ASC';
  projectWarnings = db.prepare(projSql).all(...projParams);

  res.json({ warnings, projectWarnings });
});

module.exports = router;
