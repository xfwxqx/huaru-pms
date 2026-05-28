const express = require('express');
const router = express.Router();
const { getDb, logAction } = require('../db');
const { cacheMiddleware, clearCacheMiddleware } = require('../cache');
const dataStore = require('../data-store');
const { ALL_STAGES, getStagesForAttribute } = require('../stages');
const XLSX = require('xlsx');

// GET /api/products?project_id= - 使用缓存（60秒）
router.get('/', cacheMiddleware(60), (req, res) => {
  const { project_id } = req.query;
  let products;
  
  if (project_id) {
    // 从内存存储读取
    products = dataStore.getProductsByProject(parseInt(project_id));
  } else {
    products = dataStore.getAllProducts();
  }
  
  res.json({ products });
});

// GET /api/products/:id - 使用缓存（60秒）
router.get('/:id', cacheMiddleware(60), (req, res) => {
  const productId = parseInt(req.params.id);
  
  // 从内存存储读取产品
  const product = dataStore.getProductById(productId);
  if (!product) return res.status(404).json({ error: '产品不存在' });
  
  // 进度数据按需从内存或数据库加载
  let progress = dataStore.getProgressByProduct(productId);
  if (!progress) {
    const db = getDb();
    progress = db.prepare('SELECT * FROM product_progress WHERE product_id = ? ORDER BY stage_index').all(productId);
    dataStore.setProgressByProduct(productId, progress);
  }
  
  res.json({ product, progress });
});

// POST /api/products - 清除缓存（同时清除项目和产品的缓存）
router.post('/', clearCacheMiddleware(['/api/products', '/api/projects']), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const { project_id, name, model, quantity, attribute, description, person_in_charge } = req.body;
  if (!project_id || !name) return res.status(400).json({ error: '项目ID和产品名称不能为空' });

  const db = getDb();
  const project = db.prepare('SELECT id, name, start_date, end_date FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const attr = attribute || '自研产品';
  const result = db.prepare(
    'INSERT INTO products (project_id, name, model, quantity, attribute, description, person_in_charge) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(project_id, name, model || '', quantity || 1, attr, description || '', person_in_charge || '');

  // 根据属性生成对应的进度阶段
  const stageIndexes = getStagesForAttribute(attr);
  const plannedStart = project.start_date || '';
  const plannedEnd = project.end_date || '';
  const insertProgress = db.prepare(
    'INSERT INTO product_progress (product_id, stage_index, stage_name, status, planned_start, planned_end) VALUES (?, ?, ?, ?, ?, ?)'
  );
  db.transaction(() => {
    for (const idx of stageIndexes) {
      insertProgress.run(result.lastInsertRowid, idx, ALL_STAGES[idx], '未开始', plannedStart, plannedEnd);
    }
  });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  
  // 更新内存存储
  dataStore.addProduct(product);
  
  logAction(req.user.id, req.user.username, '创建产品', 'product', product.id,
    `在项目"${project.name}"中创建产品"${product.name}"(${attr})`);
  res.json({ product });
});

// POST /api/products/import - 批量导入产品（Excel）
router.post('/import', clearCacheMiddleware(['/api/products', '/api/projects']), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });

  const { project_id, file_data } = req.body;
  if (!project_id) return res.status(400).json({ error: '项目ID不能为空' });
  if (!file_data) return res.status(400).json({ error: '未上传文件' });

  const db = getDb();
  const project = db.prepare('SELECT id, name, start_date, end_date FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  // 解析 Excel 文件
  let workbook;
  try {
    const buffer = Buffer.from(file_data, 'base64');
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'Excel 文件解析失败，请检查文件格式' });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return res.status(400).json({ error: 'Excel 文件中没有工作表' });

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) return res.status(400).json({ error: 'Excel 文件中没有数据行' });

  // 列名映射（支持中英文表头）
  const COL_MAP = {
    '产品名称': 'name', '名称': 'name', 'name': 'name',
    '产品型号': 'model', '型号': 'model', 'model': 'model',
    '数量': 'quantity', 'quantity': 'quantity',
    '属性': 'attribute', '产品属性': 'attribute', 'attribute': 'attribute',
    '描述': 'description', 'description': 'description',
    '负责人': 'person_in_charge', 'person_in_charge': 'person_in_charge'
  };

  // 标准化行数据
  const validAttrs = ['自研产品', '外购产品', '自研软件'];
  const errors = [];
  const products = [];

  rows.forEach((row, idx) => {
    // 跳过空行（所有字段都为空）
    const values = Object.values(row).map(v => String(v).trim());
    if (values.every(v => v === '')) return;

    // 标准化字段名
    const normalized = {};
    for (const [key, val] of Object.entries(row)) {
      const colName = String(key).trim();
      const mapped = COL_MAP[colName];
      if (mapped) {
        normalized[mapped] = String(val).trim();
      }
    }

    // 校验必填字段
    if (!normalized.name) {
      errors.push(`第 ${idx + 2} 行：产品名称不能为空`);
      return;
    }

    // 校验属性
    if (normalized.attribute && !validAttrs.includes(normalized.attribute)) {
      errors.push(`第 ${idx + 2} 行：属性"${normalized.attribute}"无效，应为：自研产品/外购产品/自研软件`);
      return;
    }

    // 校验数量
    if (normalized.quantity) {
      const qty = Number(normalized.quantity);
      if (isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
        errors.push(`第 ${idx + 2} 行：数量"${normalized.quantity}"无效，应为正整数`);
        return;
      }
      normalized.quantity = qty;
    } else {
      normalized.quantity = 1;
    }

    products.push(normalized);
  });

  if (errors.length > 0) {
    return res.status(400).json({ error: '数据校验失败', details: errors });
  }

  if (products.length === 0) {
    return res.status(400).json({ error: '没有有效的产品数据可导入' });
  }

  // 批量插入
  const plannedStart = project.start_date || '';
  const plannedEnd = project.end_date || '';
  const insertProduct = db.prepare(
    'INSERT INTO products (project_id, name, model, quantity, attribute, description, person_in_charge) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertProgress = db.prepare(
    'INSERT INTO product_progress (product_id, stage_index, stage_name, status, planned_start, planned_end) VALUES (?, ?, ?, ?, ?, ?)'
  );

  let createdCount = 0;
  const createdNames = [];

  db.transaction(() => {
    for (const prod of products) {
      const attr = prod.attribute || '自研产品';
      const result = insertProduct.run(
        project_id, prod.name, prod.model || '', prod.quantity, attr,
        prod.description || '', prod.person_in_charge || ''
      );

      // 根据属性生成进度阶段
      const stageIndexes = getStagesForAttribute(attr);
      for (const idx of stageIndexes) {
        insertProgress.run(result.lastInsertRowid, idx, ALL_STAGES[idx], '未开始', plannedStart, plannedEnd);
      }

      // 更新内存存储
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
      dataStore.addProduct(product);

      createdCount++;
      createdNames.push(prod.name);
    }
  });

  logAction(req.user.id, req.user.username, '批量导入产品', 'product', project_id,
    `在项目"${project.name}"中批量导入 ${createdCount} 个产品: ${createdNames.join('、')}`);

  res.json({ success: true, message: `成功导入 ${createdCount} 个产品`, count: createdCount });
});

// PUT /api/products/:id - 清除缓存（同时清除项目和产品的缓存）
router.put('/:id', clearCacheMiddleware(['/api/products', '/api/projects']), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const { name, model, quantity, attribute, description, person_in_charge } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '产品不存在' });

  const oldAttr = existing.attribute || '自研产品';
  const newAttr = attribute !== undefined ? attribute : oldAttr;

  db.prepare(
    'UPDATE products SET name=?, model=?, quantity=?, attribute=?, description=?, person_in_charge=? WHERE id=?'
  ).run(name || existing.name,
    model !== undefined ? model : existing.model,
    quantity !== undefined ? quantity : existing.quantity,
    newAttr,
    description !== undefined ? description : existing.description,
    person_in_charge !== undefined ? person_in_charge : existing.person_in_charge,
    req.params.id
  );

  // 如果属性变更，重建进度阶段
  if (newAttr !== oldAttr) {
    db.prepare('DELETE FROM product_progress WHERE product_id = ?').run(req.params.id);
    const stageIndexes = getStagesForAttribute(newAttr);
    const insertProgress = db.prepare(
      'INSERT INTO product_progress (product_id, stage_index, stage_name, status) VALUES (?, ?, ?, ?)'
    );
    db.transaction(() => {
      for (const idx of stageIndexes) {
        insertProgress.run(req.params.id, idx, ALL_STAGES[idx], '未开始');
      }
    });
    // 清除内存中的进度缓存
    dataStore.productProgress.delete(parseInt(req.params.id));
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

  // 更新内存存储（使用整数ID）
  dataStore.updateProduct(parseInt(req.params.id), product);

  logAction(req.user.id, req.user.username, '编辑产品', 'product', product.id, `编辑产品"${product.name}"`);
  res.json({ product });
});

// DELETE /api/products/:id - 清除缓存（同时清除项目和产品的缓存）
router.delete('/:id', clearCacheMiddleware(['/api/products', '/api/projects']), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '产品不存在' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);

  // 更新内存存储（使用整数ID）
  dataStore.deleteProduct(parseInt(req.params.id));
  
  logAction(req.user.id, req.user.username, '删除产品', 'product', existing.id, `删除产品"${existing.name}"`);
  res.json({ success: true });
});

module.exports = router;
