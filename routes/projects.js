const express = require('express');
const router = express.Router();
const { getDb, logAction } = require('../db');
const { cacheMiddleware, clearCacheMiddleware } = require('../cache');
const dataStore = require('../data-store');

// GET /api/projects - 使用缓存（30秒）
router.get('/', cacheMiddleware(30), (req, res) => {
  // 从内存存储读取项目列表
  const projects = dataStore.getAllProjects().map(p => ({
    ...p,
    product_count: dataStore.getProductsByProject(p.id).length
  }));
  res.json({ projects });
});

// GET /api/projects/:id - 使用缓存（60秒）
router.get('/:id', cacheMiddleware(60), (req, res) => {
  const projectId = parseInt(req.params.id);
  
  // 从内存存储读取
  const project = dataStore.getProjectById(projectId);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  
  const products = dataStore.getProductsByProject(projectId);
  res.json({ project, products });
});

// POST /api/projects - 清除缓存
router.post('/', clearCacheMiddleware('/api/projects'), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const { name, description, manager, status, start_date, end_date } = req.body;
  if (!name) return res.status(400).json({ error: '项目名称不能为空' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO projects (name, description, manager, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, description || '', manager || '', status || '已立项', start_date || '', end_date || '');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  
  // 更新内存存储
  dataStore.addProject(project);
  
  logAction(req.user.id, req.user.username, '创建项目', 'project', project.id, `创建项目"${project.name}"`);
  res.json({ project });
});

// PUT /api/projects/:id - 清除缓存
router.put('/:id', clearCacheMiddleware('/api/projects'), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const { name, description, manager, status, start_date, end_date } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '项目不存在' });

  db.prepare(
    'UPDATE projects SET name=?, description=?, manager=?, status=?, start_date=?, end_date=? WHERE id=?'
  ).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    manager !== undefined ? manager : existing.manager,
    status || existing.status,
    start_date !== undefined ? start_date : existing.start_date,
    end_date !== undefined ? end_date : existing.end_date,
    req.params.id
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

  // 更新内存存储（使用整数ID）
  dataStore.updateProject(parseInt(req.params.id), project);

  logAction(req.user.id, req.user.username, '编辑项目', 'project', project.id, `编辑项目"${project.name}"`);
  res.json({ project });
});

// DELETE /api/projects/:id - 清除缓存
router.delete('/:id', clearCacheMiddleware('/api/projects'), (req, res) => {
  const EDIT_ROLES = ['系统管理员', '项目总监', '项目经理'];
  if (!EDIT_ROLES.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '项目不存在' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

  // 更新内存存储（使用整数ID）
  dataStore.deleteProject(parseInt(req.params.id));
  
  logAction(req.user.id, req.user.username, '删除项目', 'project', existing.id, `删除项目"${existing.name}"`);
  res.json({ success: true });
});

module.exports = router;
