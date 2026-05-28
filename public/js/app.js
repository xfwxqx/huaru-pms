// 应用主入口 - SPA路由与全局管理（自适应）
const App = {
  currentPage: null,
  user: null,

  async init() {
    const token = API.getToken();
    if (token) {
      try {
        const res = await API.getMe();
        this.user = res.user;
        this.renderLayout();
        this._fetchVersion(); // 在渲染后获取版本号
        this.navigate('home');
      } catch (e) {
        API.clearToken();
        this.renderLayout();
        this._fetchVersion(); // 在渲染后获取版本号
        this.navigate('login');
      }
    } else {
      this.renderLayout();
      this._fetchVersion(); // 在渲染后获取版本号
      this.navigate('login');
    }
  },

  setUser(user) {
    this.user = user;
    this.renderLayout(); // 重建导航栏布局
  },

  renderLayout() {
    const app = document.getElementById('app');
    if (!this.user) {
      app.innerHTML = '<div id="page-content"></div>';
    } else {
      app.innerHTML = `
        <nav class="navbar">
          <div class="navbar-brand">
            <span class="icon">🛡️</span>华如防务项目管理系统
            <span class="version-tag" id="navbar-version"></span>
          </div>
          <button class="navbar-hamburger" id="navbar-hamburger" onclick="App.toggleMobileNav()">
            <span></span><span></span><span></span>
          </button>
          <ul class="navbar-nav" id="navbar-nav">
            <li><a href="#home" class="nav-link" data-page="home">📊 进度展示</a></li>
            <li><a href="#projects" class="nav-link" data-page="projects">📁 项目管理</a></li>
            <li><a href="#warnings" class="nav-link" data-page="warnings">⚠️ 超时预警</a></li>
            <li><a href="#test-dashboard" class="nav-link" data-page="test-dashboard">🧪 测试看板</a></li>
            ${this.user.role === '系统管理员' ? `
            <li><a href="#users" class="nav-link" data-page="users">👥 用户管理</a></li>
            <li><a href="#logs" class="nav-link" data-page="logs">📋 操作日志</a></li>` : ''}
          </ul>
          <div class="navbar-right">
            <span class="navbar-clock" id="navbar-clock">🕐 --:--:--</span>
            <span class="navbar-user">👤 ${this.user.username} <span class="role">(${this.user.role})</span></span>
            <button class="navbar-logout" onclick="App.logout()">退出</button>
          </div>
        </nav>
        <div id="page-content"></div>
      `;

      // 启动时钟
      this._startClock();

      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const page = link.dataset.page;
          this.navigate(page);
          // 移动端：点击导航后自动收起菜单
          this.closeMobileNav();
        });
      });
    }

    if (!document.getElementById('toast-container')) {
      const tc = document.createElement('div');
      tc.id = 'toast-container';
      tc.className = 'toast-container';
      document.body.appendChild(tc);
    }
  },

  async navigate(page) {
    // 清理甘特图的 ResizeObserver
    if (this.currentPage !== page && this.currentPage !== 'login') {
      Gantt.destroy();
    }

    this.currentPage = page;
    const content = document.getElementById('page-content');
    if (!content) return;

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    switch (page) {
      case 'login':
        content.innerHTML = LoginPage.render();
        LoginPage.mount();
        break;
      case 'home':
        content.innerHTML = await HomePage.render();
        await HomePage.mount();
        break;
      case 'projects':
        content.innerHTML = ProjectsPage.render();
        await ProjectsPage.mount();
        break;
      case 'warnings':
        content.innerHTML = await this.renderWarningsPage();
        await this.mountWarningsPage();
        break;
      case 'users':
        content.innerHTML = UsersPage.render();
        await UsersPage.mount();
        break;
      case 'logs':
        content.innerHTML = await LogsPage.render();
        await LogsPage.mount();
        break;
      case 'test-dashboard':
        content.innerHTML = await TestDashboardPage.render();
        await TestDashboardPage.mount();
        break;
      default:
        this.navigate('home');
    }
  },

  // ========== 超时预警页 ==========
  _warningsFilter: { project_id: '', product_id: '' },

  async renderWarningsPage() {
    let projectsHtml = '<option value="">全部项目</option>';
    try {
      const res = await API.getProjects();
      this._allProjects = res.projects || [];
      projectsHtml += this._allProjects.map(p =>
        `<option value="${p.id}">${p.name}</option>`
      ).join('');
    } catch (e) { /* 忽略 */ }

    return `
      <div class="page-container" style="gap:var(--page-padding);">
        <div class="page-header" style="flex-shrink:0;">
          <div class="page-title">⚠️ 超时预警</div>
          <div class="page-subtitle">显示所有超时未完成的项目阶段和产品进度</div>
        </div>
        <div class="card" style="flex-shrink:0;">
          <div class="card-body">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <label style="font-size:13px;font-weight:600;white-space:nowrap;">筛选：</label>
              <select id="warnings-filter-project" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;min-width:160px;">
                ${projectsHtml}
              </select>
              <select id="warnings-filter-product" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;min-width:160px;">
                <option value="">全部产品</option>
              </select>
              <select id="warnings-filter-status" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;min-width:130px;">
                <option value="">全部状态</option>
                <option value="未开始">未开始</option>
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
              </select>
              <button class="btn btn-ghost btn-sm" id="warnings-filter-reset">↺ 重置</button>
              <span class="text-sm text-muted" id="warnings-filter-info"></span>
            </div>
          </div>
        </div>
        <div class="warnings-page-content" id="warnings-content">
          <div class="empty-state"><div class="spinner"></div><p>加载中...</p></div>
        </div>
      </div>`;
  },

  async mountWarningsPage() {
    // 项目变化时重新加载产品列表
    document.getElementById('warnings-filter-project').addEventListener('change', () => {
      const projectId = document.getElementById('warnings-filter-project').value;
      this._loadProductOptions(projectId);
      this._warningsFilter.project_id = projectId;
      this._warningsFilter.product_id = ''; // 切换项目时重置产品筛选
      this.loadWarningsData();
    });
    // 产品变化时自动刷新
    document.getElementById('warnings-filter-product').addEventListener('change', () => {
      this._warningsFilter.product_id = document.getElementById('warnings-filter-product').value;
      this.loadWarningsData();
    });
    // 状态变化时自动刷新
    document.getElementById('warnings-filter-status').addEventListener('change', () => {
      this._warningsFilter.status = document.getElementById('warnings-filter-status').value;
      this.loadWarningsData();
    });
    // 重置
    document.getElementById('warnings-filter-reset').addEventListener('click', () => {
      this._warningsFilter = { project_id: '', product_id: '', status: '' };
      document.getElementById('warnings-filter-project').value = '';
      document.getElementById('warnings-filter-product').value = '';
      document.getElementById('warnings-filter-status').value = '';
      this._loadProductOptions('');
      this.loadWarningsData();
    });

    await this.loadWarningsData();
  },

  // 根据项目ID加载产品下拉选项
  async _loadProductOptions(projectId) {
    const select = document.getElementById('warnings-filter-product');
    if (!select) return;

    let html = '<option value="">全部产品</option>';
    if (projectId) {
      try {
        const res = await API.getProducts(projectId);
        const products = res.products || [];
        html += products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      } catch (e) { /* 忽略 */ }
    }
    select.innerHTML = html;
    select.value = ''; // 重置选中
  },

  async loadWarningsData() {
    const container = document.getElementById('warnings-content');
    const infoEl = document.getElementById('warnings-filter-info');
    if (!container) return;

    try {
      const params = {};
      if (this._warningsFilter.project_id) params.project_id = this._warningsFilter.project_id;
      if (this._warningsFilter.product_id) params.product_id = this._warningsFilter.product_id;

      const res = await API.getWarnings(params);
      let { warnings, projectWarnings } = res;

      // 前端按状态筛选
      if (this._warningsFilter.status) {
        warnings = warnings.filter(w => w.status === this._warningsFilter.status);
      }

      // 更新筛选信息
      const projectName = this._warningsFilter.project_id
        ? (this._allProjects || []).find(p => p.id == this._warningsFilter.project_id)?.name || ''
        : '';
      const productEl = document.getElementById('warnings-filter-product');
      const productName = this._warningsFilter.product_id && productEl
        ? productEl.options[productEl.selectedIndex]?.text || ''
        : '';
      const parts = [projectName, productName].filter(Boolean);
      if (infoEl) infoEl.textContent = parts.length > 0 ? `当前筛选：${parts.join(' | ')}` : '';
      if (infoEl) infoEl.style.display = parts.length > 0 ? 'inline' : 'none';

      let html = '';

      if (projectWarnings && projectWarnings.length > 0) {
        html += `<div class="card" style="flex-shrink:0;margin-bottom:var(--page-padding);">
          <div class="card-header"><span class="card-title" style="color:var(--danger);">🚨 项目超时 (${projectWarnings.length})</span></div>
          <div class="card-body">
            <div class="table-wrap">
              <table>
                <thead><tr><th>项目名称</th><th>状态</th><th>计划结束</th><th>超时天数</th></tr></thead>
                <tbody>`;
        projectWarnings.forEach(p => {
          const days = Math.ceil((new Date() - new Date(p.end_date)) / (1000 * 60 * 60 * 24));
          html += `<tr>
            <td><strong>${p.name}</strong></td>
            <td><span class="tag tag-red">${p.status}</span></td>
            <td>${p.end_date}</td>
            <td style="color:var(--danger);font-weight:600;">${days} 天</td>
          </tr>`;
        });
        html += '</tbody></table></div></div></div>';
      }

      if (warnings && warnings.length > 0) {
        html += `<div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column;">
          <div class="card-header"><span class="card-title" style="color:var(--warning);">⚠️ 产品阶段超时 (${warnings.length})</span></div>
          <div class="card-body" style="flex:1;overflow-y:auto;">
            <div class="table-wrap">
              <table>
                <thead><tr><th>#</th><th>所属项目</th><th>产品</th><th>阶段</th><th>当前状态</th><th>计划结束</th><th>超时天数</th></tr></thead>
                <tbody>`;
        warnings.forEach((w, idx) => {
          const days = Math.ceil((new Date() - new Date(w.planned_end)) / (1000 * 60 * 60 * 24));
          const statusClass = w.status === '进行中' ? 'tag-yellow' : 'tag-red';
          html += `<tr>
            <td style="color:var(--gray-400);font-size:12px;">${idx + 1}</td>
            <td>${w.project_name}</td>
            <td>${w.product_name}</td>
            <td>${w.stage_name}</td>
            <td><span class="tag ${statusClass}">${w.status}</span></td>
            <td>${w.planned_end}</td>
            <td style="color:var(--danger);font-weight:600;">${days} 天</td>
          </tr>`;
        });
        html += '</tbody></table></div></div></div>';
      }

      if (!html) {
        html = '<div class="empty-state" style="padding:10vh;"><div class="icon">✅</div><p>当前没有超时预警，所有项目进度正常</p></div>';
      }

      container.innerHTML = html;
    } catch (e) {
      document.getElementById('warnings-content').innerHTML =
        `<div class="empty-state" style="padding:10vh;"><div class="icon">❌</div><p>加载失败: ${e.message}</p></div>`;
    }
  },

  // ========== 通用方法 ==========
  _clockTimer: null,

  async _fetchVersion() {
    try {
      const res = await API.getConfig();
      const el = document.getElementById('navbar-version');
      if (el && res.version) el.textContent = res.version;
    } catch (e) { /* 忽略 */ }
  },

  // 权限检查：是否可以编辑项目/产品
  canEdit() {
    const role = this.user && this.user.role;
    return role === '系统管理员' || role === '项目总监' || role === '项目经理';
  },

  _startClock() {
    this._stopClock();
    const tick = () => {
      const el = document.getElementById('navbar-clock');
      if (!el) { this._stopClock(); return; }
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const h = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      el.textContent = `${y}-${mo}-${d} ${h}:${mi}:${s}`;
    };
    tick();
    this._clockTimer = setInterval(tick, 1000);
  },

  _stopClock() {
    if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null; }
  },

  logout() {
    this._stopClock();
    API.clearToken();
    this.user = null;
    Gantt.destroy();
    this.renderLayout();
    this.navigate('login');
  },

  // 移动端汉堡菜单
  toggleMobileNav() {
    const nav = document.getElementById('navbar-nav');
    const btn = document.getElementById('navbar-hamburger');
    if (nav) nav.classList.toggle('open');
    if (btn) btn.classList.toggle('open');
  },
  closeMobileNav() {
    const nav = document.getElementById('navbar-nav');
    const btn = document.getElementById('navbar-hamburger');
    if (nav) nav.classList.remove('open');
    if (btn) btn.classList.remove('open');
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};

// 全局 Modal
const Modal = {
  callback: null,

  show(title, bodyHtml, onConfirm) {
    this.callback = onConfirm;
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-box').innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="Modal.hide()">×</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="Modal.hide()">取消</button>
        <button class="btn btn-primary" id="modal-confirm-btn">确认</button>
      </div>`;
    overlay.style.display = 'flex';

    document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
      if (this.callback) {
        const btn = document.getElementById('modal-confirm-btn');
        btn.disabled = true;
        btn.textContent = '处理中...';
        const result = await this.callback();
        if (result === false) {
          btn.disabled = false;
          btn.textContent = '确认';
        }
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    }, { once: true });
  },

  hide() {
    document.getElementById('modal-overlay').style.display = 'none';
    this.callback = null;
  }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => App.init());

window.addEventListener('hashchange', () => {
  const page = location.hash.replace('#', '') || 'home';
  if (App.user || page === 'login') {
    App.navigate(page);
  } else {
    App.navigate('login');
  }
});
