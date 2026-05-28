const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dataStore = require('./data-store');
const { config } = require('./config');

// ====== 数据库路径（支持 config.ini 配置） ======
const DB_PATH = (() => {
  const cfgPath = config.database && config.database.db_path;
  if (cfgPath) {
    return path.isAbsolute(cfgPath) ? cfgPath : path.join(__dirname, cfgPath);
  }
  return path.join(__dirname, 'data.db');
})();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let SQL = null;
let db = null;

// ====== 数据库同步管理器 ======
class DbSyncManager {
  constructor(sqliteWrapper) {
    this.wrapper = sqliteWrapper;
    this.hasChanges = false;
    this.syncTimer = null;
    this.syncInterval = 60000;
    this.isShuttingDown = false;
  }

  markChanged() {
    if (this.isShuttingDown) return;
    this.hasChanges = true;
    this.startSyncTimer();
  }

  startSyncTimer() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      this.syncIfNeeded();
    }, this.syncInterval);
    console.log(`  [DbSync] 定时同步已启动（${this.syncInterval / 1000}秒）`);
  }

  syncIfNeeded() {
    if (!this.hasChanges) return;
    try {
      this.wrapper.save();
      console.log(`  [DbSync] 数据已同步 (${new Date().toLocaleTimeString()})`);
      this.hasChanges = false;
    } catch (e) {
      console.error('  [DbSync] 同步失败:', e.message);
    }
  }

  syncNow() {
    if (this.hasChanges) {
      try {
        this.wrapper.save();
        console.log('  [DbSync] 退出前数据已同步');
        this.hasChanges = false;
      } catch (e) {
        console.error('  [DbSync] 退出同步失败:', e.message);
      }
    }
  }

  stop() {
    this.isShuttingDown = true;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.syncNow();
  }
}

// ====== sql.js 封装 ======
class SqliteWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
    this.syncManager = new DbSyncManager(this);
  }

  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    // 先写临时文件，再原子替换，防止写入中断损坏数据库
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, DB_PATH);
  }

  _queryAll(sql, params = []) {
    const stmt = this._db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  _queryOne(sql, params = []) {
    const rows = this._queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  _run(sql, params = []) {
    this._db.run(sql, params);
    const result = this._queryOne('SELECT last_insert_rowid() as id');
    const lastId = result ? result.id : 0;
    const changes = this._db.getRowsModified();
    if (changes > 0) {
      this.syncManager.markChanged();
    }
    return { lastInsertRowid: lastId, changes };
  }

  exec(sql) {
    this._db.run(sql);
    this.save();
  }

  transaction(fn) {
    this._db.run('BEGIN TRANSACTION');
    try {
      fn();
      this._db.run('COMMIT');
      this.syncManager.markChanged();
    } catch (e) {
      this._db.run('ROLLBACK');
      throw e;
    }
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) { return self._run(sql, params); },
      get(...params) { return self._queryOne(sql, params); },
      all(...params) { return self._queryAll(sql, params); }
    };
  }
}

// ====== 数据完整性检查 ======
function checkDataIntegrity(db) {
  console.log('  [校验] 开始数据完整性检查...');

  let issues = 0;

  // 1. 检查 product_progress 中 product_id 是否存在
  const orphanProgress = db.prepare(`
    SELECT pp.id, pp.product_id, pp.stage_name
    FROM product_progress pp
    LEFT JOIN products p ON pp.product_id = p.id
    WHERE p.id IS NULL
  `).all();

  if (orphanProgress.length > 0) {
    console.warn(`  [校验] 发现 ${orphanProgress.length} 条孤立进度记录（product 不存在），自动清理`);
    db.transaction(() => {
      for (const r of orphanProgress) {
        db.prepare('DELETE FROM product_progress WHERE id = ?').run(r.id);
      }
    });
    issues++;
  }

  // 2. 检查 products 中 project_id 是否存在
  const orphanProducts = db.prepare(`
    SELECT pd.id, pd.name, pd.project_id
    FROM products pd
    LEFT JOIN projects pj ON pd.project_id = pj.id
    WHERE pj.id IS NULL
  `).all();

  if (orphanProducts.length > 0) {
    console.warn(`  [校验] 发现 ${orphanProducts.length} 个孤立产品（project 不存在），自动清理`);
    db.transaction(() => {
      for (const r of orphanProducts) {
        db.prepare('DELETE FROM products WHERE id = ?').run(r.id);
      }
    });
    issues++;
  }

  // 3. 统计
  const stats = {
    projects: db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt,
    products: db.prepare('SELECT COUNT(*) as cnt FROM products').get().cnt,
    progress: db.prepare('SELECT COUNT(*) as cnt FROM product_progress').get().cnt
  };

  if (issues === 0) {
    console.log(`  [校验] 数据完整（${stats.projects}项目/${stats.products}产品/${stats.progress}进度）`);
  } else {
    console.log(`  [校验] 已修复 ${issues} 个问题（${stats.projects}项目/${stats.products}产品/${stats.progress}进度）`);
  }
}

// ====== 初始化 ======
async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();
  const isNewDb = !fs.existsSync(DB_PATH);

  // 加载或创建数据库
  let sqlDb;
  if (!isNewDb) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // 启用外键约束（必须在每次连接时设置）
  sqlDb.run('PRAGMA foreign_keys = ON');

  // 创建 wrapper
  db = new SqliteWrapper(sqlDb);
  console.log(`  [数据库] 路径: ${DB_PATH}`);

  // 4. 初始化表结构
  initDb();

  // 5. 执行迁移
  runMigrations();

  // 6. 数据完整性检查
  checkDataIntegrity(db);

  // 7. 加载内存存储
  dataStore.init(db);

  // 8. 注册退出信号
  setupShutdownHandlers();

  return db;
}

function setupShutdownHandlers() {
  const shutdown = (signal) => {
    console.log(`\n  [系统] 收到 ${signal}，正在保存数据...`);
    if (db && db.syncManager) {
      db.syncManager.stop();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Windows 下 Ctrl+C 可能不触发 SIGINT，额外监听
  if (process.platform === 'win32') {
    process.on('uncaughtException', (err) => {
      console.error('  [系统] 未捕获异常:', err.message);
      if (db && db.syncManager) {
        db.syncManager.stop();
      }
      process.exit(1);
    });
  }
}

function getDb() {
  if (!db) throw new Error('数据库未初始化，请先调用 initDatabase()');
  return db;
}

function initDb() {
  // 启用外键支持
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_info (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '项目组成员',
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      manager TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '已立项',
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      model TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      attribute TEXT DEFAULT '自研产品',
      description TEXT DEFAULT '',
      person_in_charge TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      stage_index INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '未开始',
      planned_start TEXT DEFAULT '',
      planned_end TEXT DEFAULT '',
      actual_start TEXT DEFAULT '',
      actual_end TEXT DEFAULT '',
      updated_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(product_id, stage_index)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT (datetime('now','localtime'))
    );
  `);

  // 种子用户
  const adminCount = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE username = ?').get('admin');
  if (!adminCount || adminCount.cnt === 0) {
    const hashedPwd = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPwd, '系统管理员');
  }
}

// ====== 迁移 ======
function runMigrations() {
  try { db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at DATETIME DEFAULT (datetime(\'now\',\'localtime\')))'); } catch (e) { /* ignore */ }

  const applied = new Set();
  try {
    const rows = db.prepare('SELECT version FROM schema_migrations').all();
    rows.forEach(r => applied.add(r.version));
  } catch (e) { /* ignore */ }

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('  [迁移] migrations 目录不存在');
    return;
  }

  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .sort();

  if (migrationFiles.length === 0) return;

  let executed = 0;
  for (const file of migrationFiles) {
    const version = path.basename(file, '.js');
    if (applied.has(version)) continue;
    try {
      const migration = require(path.join(MIGRATIONS_DIR, file));
      if (typeof migration.up === 'function') {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
        executed++;
        console.log(`  [迁移] ✓ ${version} (${file})`);
      }
    } catch (e) {
      console.error(`  [迁移] ✗ ${version}: ${e.message}`);
      break;
    }
  }
  if (executed > 0) console.log(`  [迁移] 共执行 ${executed} 个`);
}

// ====== 操作日志 ======
function logAction(userId, username, action, targetType, targetId, detail) {
  try {
    getDb().prepare(
      'INSERT INTO operation_logs (user_id, username, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, username, action, targetType || null, targetId || null, detail || null);
  } catch (e) {
    console.error('记录日志失败:', e);
  }
}

module.exports = { initDatabase, getDb, logAction };
