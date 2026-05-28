/**
 * 迁移模板 - 复制此文件并重命名为 NNN-描述.js（如 001-add-column.js）
 *
 * 使用方式：
 *   1. 复制本文件为 migrations/001-xxx.js
 *   2. 编写 up(db) 函数中的 SQL
 *   3. （可选）编写 down(db) 函数用于回滚
 *   4. 重启服务，迁移会自动执行
 *
 * 注意：
 *   - 文件名决定执行顺序（按字母排序）
 *   - 已执行过的迁移不会重复执行（记录在 schema_migrations 表中）
 *   - 迁移失败会停止后续迁移
 *   - db 对象支持: db.exec(sql), db.prepare(sql).run(...params), db.prepare(sql).all(...)
 */

// 迁移执行函数（必须）
function up(db) {
  // 示例1：新增列
  // db.exec("ALTER TABLE products ADD COLUMN new_column TEXT DEFAULT ''");

  // 示例2：新建表
  // db.exec(`
  //   CREATE TABLE IF NOT EXISTS new_table (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     name TEXT NOT NULL,
  //     created_at DATETIME DEFAULT (datetime('now','localtime'))
  //   );
  // `);

  // 示例3：更新数据
  // db.prepare("UPDATE products SET status = ? WHERE status = ?").run('新状态', '旧状态');

  // 示例4：带参数的操作
  // db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run('version', 'V3.0');
}

// 回滚函数（可选，用于手动回滚）
function down(db) {
  // db.exec("ALTER TABLE products DROP COLUMN new_column");
  // db.exec("DROP TABLE IF EXISTS new_table");
}

module.exports = { up, down };
