// 首页 - 进度展示（自适应）
const HomePage = {
  _projects: [],
  _selectedProjectId: null,

  async render() {
    return `
      <div class="page-container" style="gap:var(--page-padding);">
        <div class="stats-row" id="home-stats" style="flex-shrink:0;">
          <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-info"><div class="stat-num" id="stat-projects">-</div><div class="stat-label">项目总数</div></div></div>
          <div class="stat-card success"><div class="stat-icon">✅</div><div class="stat-info"><div class="stat-num" id="stat-done">-</div><div class="stat-label">已验收项目</div></div></div>
          <div class="stat-card warning"><div class="stat-icon">🔄</div><div class="stat-info"><div class="stat-num" id="stat-active">-</div><div class="stat-label">进行中项目</div></div></div>
          <div class="stat-card danger"><div class="stat-icon">⚠️</div><div class="stat-info"><div class="stat-num" id="stat-warnings">-</div><div class="stat-label">超时预警</div></div></div>
        </div>
        <div class="card" style="max-height:clamp(180px,28vh,300px);">
          <div class="card-header">
            <span class="card-title">📅 项目进度甘特图</span>
          </div>
          <div class="card-body" id="project-gantt-container" style="min-height:100px;padding:8px 12px;">
            <div class="empty-state"><div class="spinner"></div><p>加载中...</p></div>
          </div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:var(--page-padding);min-height:0;overflow:hidden;">
          <div class="card" style="min-height:0;">
            <div class="card-header" id="project-report-header"><span class="card-title">📊 项目详情</span></div>
            <div class="card-body" id="project-report-container" style="min-height:0;padding:8px 12px;">
              <div class="empty-state"><div class="icon">📈</div><p>请在上方甘特图中点击项目</p></div>
            </div>
          </div>
          <div class="card" style="min-height:0;">
            <div class="card-header"><span class="card-title">📦 产品进度列表</span><span class="text-sm text-muted" id="selected-project-label">请在上方选择项目</span>
            <button class="btn btn-success btn-sm" id="btn-export-products" style="display:none;margin-left:auto;" onclick="HomePage.exportProducts()">📥 导出产品进度</button></div>
            <div class="card-body" id="product-progress-container" style="min-height:0;padding:8px 12px;">
              <div class="empty-state"><div class="icon">📋</div><p>请在上方甘特图中点击项目</p></div>
            </div>
          </div>
        </div>
      </div>`;
  },

  async mount() {
    await this.loadData();
  },

  async loadData() {
    try {
      const [projectsRes, warningsRes] = await Promise.all([
        API.getProjects(),
        API.getWarnings()
      ]);

      const projects = projectsRes.projects;
      this._projects = projects;

      document.getElementById('stat-projects').textContent = projects.length;
      document.getElementById('stat-done').textContent = projects.filter(p => p.status === '已验收').length;
      document.getElementById('stat-active').textContent = projects.filter(p => p.status === '进行中').length;
      document.getElementById('stat-warnings').textContent = (warningsRes.warnings?.length || 0) + (warningsRes.projectWarnings?.length || 0);

      // 记录当前选中，用于重新渲染后恢复
      const prevSelected = Gantt.selectedProjectId;

      Gantt.renderProjectGantt(projects, 'project-gantt-container');

      window.onGanttProjectSelect = (projectId) => this.onProjectSelect(projectId);

      // 自动选中
      if (projects.length > 0) {
        setTimeout(() => {
          const targetId = prevSelected || projects[0].id;
          if (prevSelected) {
            // 恢复选中
            this.onProjectSelect(prevSelected);
          } else {
            const firstRow = document.querySelector('#project-gantt-container .gantt-row');
            if (firstRow) firstRow.click();
          }
        }, 300);
      }
    } catch (e) {
      console.error('加载首页数据失败:', e);
    }
  },

  async onProjectSelect(projectId) {
    this._selectedProjectId = projectId;
    document.getElementById('selected-project-label').textContent = '加载中...';
    try {
      const { products } = await API.getProjectProgress(projectId);
      document.getElementById('selected-project-label').textContent = `已选中项目 (${products.length}个产品)`;
      // 显示导出按钮
      const exportBtn = document.getElementById('btn-export-products');
      if (exportBtn) exportBtn.style.display = '';
      Gantt.renderProductProgress(products, 'product-progress-container');
      const pj = this._projects.find(p => p.id == projectId);
      Gantt.renderReport(products, 'project-report-container', pj ? pj.name : '', 'project-report-header');
    } catch (e) {
      document.getElementById('selected-project-label').textContent = '加载失败';
      console.error(e);
    }
  },

  async exportProducts() {
    if (!this._selectedProjectId) {
      App.showToast('请先选择项目', 'warning');
      return;
    }
    try {
      await API.exportProducts(this._selectedProjectId);
      App.showToast('产品进度导出成功', 'success');
    } catch (e) {
      App.showToast('导出失败: ' + e.message, 'error');
    }
  }
};
