/**
 * 请求缓存模块 - 方案1
 * 用于缓存 API 响应，减少数据库查询
 */

class Cache {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
    this.hitCount = 0;
    this.missCount = 0;
  }

  // 获取缓存
  get(key) {
    const item = this.store.get(key);
    if (!item) {
      this.missCount++;
      return null;
    }

    // 检查是否过期
    const ttl = this.ttls.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttls.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return item;
  }

  // 设置缓存
  set(key, value, ttlSeconds = 60) {
    this.store.set(key, value);
    if (ttlSeconds > 0) {
      this.ttls.set(key, Date.now() + ttlSeconds * 1000);
    }
  }

  // 删除缓存
  del(key) {
    this.store.delete(key);
    this.ttls.delete(key);
  }

  // 按模式清除缓存
  clearPattern(pattern) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        this.ttls.delete(key);
      }
    }
  }

  // 清除所有缓存
  clear() {
    this.store.clear();
    this.ttls.clear();
  }

  // 获取统计
  stats() {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total * 100).toFixed(2) + '%' : '0%',
      size: this.store.size
    };
  }

  // 获取缓存键（根据请求）
  static getKey(req) {
    return req.originalUrl || req.url;
  }
}

// 全局缓存实例
const globalCache = new Cache();

/**
 * 缓存中间件
 * @param {number} duration - 缓存时间（秒）
 * @param {function} keyGenerator - 自定义缓存键生成函数
 */
function cacheMiddleware(duration = 60, keyGenerator = null) {
  return (req, res, next) => {
    // 非 GET 请求不缓存
    if (req.method !== 'GET') {
      return next();
    }

    const key = keyGenerator ? keyGenerator(req) : Cache.getKey(req);
    const cached = globalCache.get(key);

    if (cached) {
      // 添加缓存标记头
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // 劫持 res.json 方法
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      globalCache.set(key, data, duration);
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * 清除缓存中间件
 * @param {string|string[]} pattern - 要清除的缓存模式（可以是单个字符串或字符串数组）
 */
function clearCacheMiddleware(pattern) {
  return (req, res, next) => {
    // 保存原始 json 方法
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // 响应成功后清除相关缓存
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      patterns.forEach(p => globalCache.clearPattern(p));
      return originalJson(data);
    };

    next();
  };
}

module.exports = {
  Cache,
  cache: globalCache,
  cacheMiddleware,
  clearCacheMiddleware
};
