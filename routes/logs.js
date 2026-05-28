const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/logs —— 获取操作日志（支持分页和筛选）
router.get('/', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  // 筛选参数
  const startDate = req.query.start_date || '';
  const endDate = req.query.end_date || '';
  const username = req.query.username || '';
  const action = req.query.action || '';

  let whereClauses = [];
  let whereParams = [];

  if (startDate) {
    whereClauses.push('created_at >= ?');
    whereParams.push(startDate + ' 00:00:00');
  }
  if (endDate) {
    whereClauses.push('created_at <= ?');
    whereParams.push(endDate + ' 23:59:59');
  }
  if (username) {
    whereClauses.push('username = ?');
    whereParams.push(username);
  }
  if (action) {
    whereClauses.push('action = ?');
    whereParams.push(action);
  }

  const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countSQL = `SELECT COUNT(*) as cnt FROM operation_logs ${whereSQL}`;
  const total = db.prepare(countSQL).get(...whereParams).cnt;

  const dataSQL = `SELECT * FROM operation_logs ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const logs = db.prepare(dataSQL).all(...whereParams, limit, offset);

  res.json({ logs, total, page, limit });
});

// GET /api/logs/users —— 获取出现过日志记录的用户名列表（用于筛选项）
router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT DISTINCT username FROM operation_logs WHERE username IS NOT NULL ORDER BY username').all();
  res.json({ users: users.map(u => u.username) });
});

// GET /api/logs/actions —— 获取所有操作类型列表（用于筛选项）
router.get('/actions', (req, res) => {
  const db = getDb();
  const actions = db.prepare('SELECT DISTINCT action FROM operation_logs ORDER BY action').all();
  res.json({ actions: actions.map(a => a.action) });
});

module.exports = router;
