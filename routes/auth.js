const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, logAction } = require('../db');

const JWT_SECRET = 'huruo-pms-secret-key-2026';
const TOKEN_EXPIRY = '7d';

// POST /api/auth/register —— 强制注册为"项目组成员"
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || password.length < 4) {
    return res.status(400).json({ error: '用户名至少2位，密码至少4位' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hashedPwd = bcrypt.hashSync(password, 10);
  const role = '项目组成员'; // 新注册用户统一角色
  const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPwd, role);

  const user = { id: result.lastInsertRowid, username, role };
  logAction(null, username, '用户注册', 'user', result.lastInsertRowid, `新用户"${username}"注册(角色:${role})`);

  const token = jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  res.json({ token, user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const payload = { id: user.id, username: user.username, role: user.role };
  logAction(user.id, user.username, '用户登录', null, null, null);

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  res.json({ token, user: payload });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

// ========== 用户管理（仅系统管理员可操作） ==========

// GET /api/auth/users —— 获取所有用户列表
router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.json({ users });
});

// POST /api/auth/users —— 创建用户（仅管理员）
router.post('/users', (req, res) => {
  if (req.user.role !== '系统管理员') {
    return res.status(403).json({ error: '仅系统管理员可创建用户' });
  }
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || password.length < 4) return res.status(400).json({ error: '用户名至少2位，密码至少4位' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已存在' });

  const hashedPwd = bcrypt.hashSync(password, 10);
  const userRole = role || '项目组成员';
  const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPwd, userRole);

  logAction(req.user.id, req.user.username, '创建用户', 'user', result.lastInsertRowid,
    `创建用户"${username}"(角色:${userRole})`);

  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.json({ user });
});

// PUT /api/auth/users/:id —— 更新用户信息（角色/密码，仅管理员）
router.put('/users/:id', (req, res) => {
  if (req.user.role !== '系统管理员') {
    return res.status(403).json({ error: '仅系统管理员可修改用户信息' });
  }
  const { role, password } = req.body;

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const changes = [];
  if (role && role !== user.role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    changes.push(`角色: ${user.role} → ${role}`);
    logAction(req.user.id, req.user.username, '修改用户角色', 'user', user.id,
      `将用户"${user.username}"角色从"${user.role}"改为"${role}"`);
  }
  if (password) {
    if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
    const hashedPwd = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPwd, req.params.id);
    changes.push('密码已重置');
    logAction(req.user.id, req.user.username, '重置密码', 'user', user.id,
      `重置用户"${user.username}"的密码`);
  }

  if (changes.length === 0) return res.status(400).json({ error: '未提供任何变更' });

  const updated = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json({ user: updated, changes: changes.join('; ') });
});

// DELETE /api/auth/users/:id —— 删除用户（仅管理员）
router.delete('/users/:id', (req, res) => {
  if (req.user.role !== '系统管理员') {
    return res.status(403).json({ error: '仅系统管理员可删除用户' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.username === 'admin') return res.status(403).json({ error: '不能删除admin账号' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logAction(req.user.id, req.user.username, '删除用户', 'user', user.id,
    `删除用户"${user.username}"(角色:${user.role})`);

  res.json({ success: true });
});

module.exports = router;
