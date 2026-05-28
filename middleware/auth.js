const jwt = require('jsonwebtoken');
const JWT_SECRET = 'huruo-pms-secret-key-2026';

// Routes that don't require auth
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/config'];

function authMiddleware(req, res, next) {
  if (PUBLIC_ROUTES.includes(req.path)) {
    return next();
  }
  // Allow OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = authMiddleware;
