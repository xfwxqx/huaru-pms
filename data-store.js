/**
 * 内存数据存储模块 - 方案3
 * 启动时加载热点数据到内存，读操作直接走内存
 * 适用于读多写少场景
 */

class DataStore {
  constructor() {
    // 核心数据存储
    this.projects = new Map();           // 项目列表
    this.products = new Map();           // 产品列表
    this.productProgress = new Map();    // 产品进度
    this.users = new Map();              // 用户列表
    
    // 索引
    this.projectProducts = new Map();    // 项目ID -> 产品ID列表
    this.projectCount = 0;
    this.productCount = 0;
    
    // 统计
    this.queryCount = 0;
    this.memoryQueryCount = 0;
    
    this.initialized = false;
  }

  /**
   * 初始化 - 从数据库加载所有数据到内存
   */
  init(db) {
    console.log('[DataStore] 开始加载数据到内存...');
    const startTime = Date.now();

    // 加载项目
    const projects = db.prepare('SELECT * FROM projects ORDER BY id').all();
    projects.forEach(p => {
      this.projects.set(p.id, p);
      this.projectProducts.set(p.id, []);
    });
    this.projectCount = projects.length;

    // 加载产品
    const products = db.prepare('SELECT * FROM products ORDER BY id').all();
    products.forEach(p => {
      this.products.set(p.id, p);
      // 建立项目-产品索引
      if (this.projectProducts.has(p.project_id)) {
        this.projectProducts.get(p.project_id).push(p.id);
      }
    });
    this.productCount = products.length;

    // 加载用户
    const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
    users.forEach(u => {
      this.users.set(u.id, u);
    });

    this.initialized = true;
    const duration = Date.now() - startTime;
    console.log(`[DataStore] 数据加载完成: ${this.projectCount} 项目, ${this.productCount} 产品, ${users.length} 用户 (${duration}ms)`);
  }

  // ==================== 项目操作 ====================
  
  getAllProjects() {
    this.queryCount++;
    this.memoryQueryCount++;
    return Array.from(this.projects.values());
  }

  getProjectById(id) {
    this.queryCount++;
    this.memoryQueryCount++;
    return this.projects.get(id) || null;
  }

  // ==================== 产品操作 ====================

  getAllProducts() {
    this.queryCount++;
    this.memoryQueryCount++;
    return Array.from(this.products.values());
  }

  getProductById(id) {
    this.queryCount++;
    this.memoryQueryCount++;
    return this.products.get(id) || null;
  }

  getProductsByProject(projectId) {
    this.queryCount++;
    this.memoryQueryCount++;
    const productIds = this.projectProducts.get(projectId) || [];
    return productIds.map(id => this.products.get(id)).filter(Boolean);
  }

  // ==================== 进度操作（按需加载）====================
  
  getProgressByProduct(productId) {
    this.queryCount++;
    // 进度数据量大，按需从内存或数据库加载
    if (this.productProgress.has(productId)) {
      this.memoryQueryCount++;
      return this.productProgress.get(productId);
    }
    return null; // 返回null表示需要从数据库加载
  }

  setProgressByProduct(productId, progress) {
    this.productProgress.set(productId, progress);
  }

  // ==================== 用户操作 ====================

  getUserById(id) {
    this.queryCount++;
    this.memoryQueryCount++;
    return this.users.get(id) || null;
  }

  getUserByUsername(username) {
    this.queryCount++;
    this.memoryQueryCount++;
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  // ==================== 写操作 - 更新内存 ====================

  addProject(project) {
    this.projects.set(project.id, project);
    this.projectProducts.set(project.id, []);
    this.projectCount++;
  }

  updateProject(id, data) {
    const existing = this.projects.get(id);
    if (existing) {
      Object.assign(existing, data);
    }
  }

  deleteProject(id) {
    this.projects.delete(id);
    this.projectProducts.delete(id);
    this.projectCount--;
  }

  addProduct(product) {
    this.products.set(product.id, product);
    if (this.projectProducts.has(product.project_id)) {
      this.projectProducts.get(product.project_id).push(product.id);
    }
    this.productCount++;
  }

  updateProduct(id, data) {
    const existing = this.products.get(id);
    if (existing) {
      // 如果项目ID变更，更新索引
      if (data.project_id && data.project_id !== existing.project_id) {
        const oldList = this.projectProducts.get(existing.project_id);
        if (oldList) {
          const idx = oldList.indexOf(id);
          if (idx > -1) oldList.splice(idx, 1);
        }
        if (this.projectProducts.has(data.project_id)) {
          this.projectProducts.get(data.project_id).push(id);
        }
      }
      Object.assign(existing, data);
    }
  }

  deleteProduct(id) {
    const product = this.products.get(id);
    if (product) {
      const list = this.projectProducts.get(product.project_id);
      if (list) {
        const idx = list.indexOf(id);
        if (idx > -1) list.splice(idx, 1);
      }
      this.products.delete(id);
      this.productProgress.delete(id);
      this.productCount--;
    }
  }

  // ==================== 统计信息 ====================

  getStats() {
    return {
      projects: this.projectCount,
      products: this.productCount,
      totalQueries: this.queryCount,
      memoryQueries: this.memoryQueryCount,
      memoryHitRate: this.queryCount > 0 
        ? (this.memoryQueryCount / this.queryCount * 100).toFixed(2) + '%' 
        : '0%',
      progressCached: this.productProgress.size
    };
  }

  resetStats() {
    this.queryCount = 0;
    this.memoryQueryCount = 0;
  }
}

// 单例实例
const dataStore = new DataStore();

module.exports = dataStore;
