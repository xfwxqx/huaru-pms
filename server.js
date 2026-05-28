const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');
const { config } = require('./config');

const app = express();
const PORT = config.server.port || process.env.PORT || 3456;

// Middleware — CORS must come BEFORE auth
app.use(cors());
app.use(express.json());

// 静态资源：JS/CSS 禁止缓存，避免旧代码残留
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Auth middleware (after CORS/static so OPTIONS & static files skip auth)
const authMiddleware = require('./middleware/auth');

// Public config endpoint (before auth middleware)
app.get('/api/config', (req, res) => {
  res.json({ version: config.app.version });
});

// 公开路由 - 不需要认证（测试记录缓存）
app.use('/api/test-records', require('./routes/test-records'));

app.use('/api', authMiddleware);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/products', require('./routes/products'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/export', require('./routes/export'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/test-records', require('./routes/test-records'));

// SPA fallback — 仅 GET 请求
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize DB then start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('======================================');
    console.log('  华如防务项目管理系统 已启动');
    console.log('======================================');
    console.log(`  本机访问: http://localhost:${PORT}`);
    console.log(`  局域网访问: http://<本机IP>:${PORT}`);
    console.log('======================================');
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
