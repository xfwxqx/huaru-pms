// 操作日志页（仅系统管理员可见）
const LogsPage = {
  currentPage: 1,
  limit: 50,

  async render() {
    let userOptions = '<option value="">全部用户</option>';
    let actionOptions = '<option value="">全部操作</option>';
    try {
      const [userRes, actionRes] = await Promise.all([
        API.getLogUsers(), API.getLogActions()
      ]);
      userOptions += (userRes.users || []).map(u => `<option value="${u}">${u}</option>`).join('');
      actionOptions += (actionRes.actions || []).map(a => `<option value="${a}">${a}</option>`).join('');
    } catch (e) { /* ignore */ }

    return `
      <div class="page-container" style="gap:var(--page-padding);">
        <div class="page-header flex-between" style="flex-shrink:0;">
          <div>
            <div class="page-title">📋 操作日志</div>
            <div class="page-subtitle">记录所有用户在系统中的操作行为</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="LogsPage.refresh()">🔄 刷新</button>
        </div>
        <div class="card" style="flex-shrink:0;">
          <div class="card-body">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;" id="logs-filter-bar">
              <label style="font-size:13px;font-weight:600;white-space:nowrap;">筛选：</label>
              <input type="date" id="logs-filter-start" style="padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:12px;min-width:130px;" title="开始日期">
              <span style="color:var(--gray-400);font-size:12px;">至</span>
              <input type="date" id="logs-filter-end" style="padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:12px;min-width:130px;" title="结束日期">
              <select id="logs-filter-user" style="padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:12px;min-width:120px;">${userOptions}</select>
              <select id="logs-filter-action" style="padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:12px;min-width:120px;">${actionOptions}</select>
              <button class="btn btn-ghost btn-sm" id="logs-filter-reset">↺ 重置</button>
              <span class="text-sm text-muted" id="logs-filter-info"></span>
            </div>
          </div>
        </div>
        <div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column;">
          <div class="card-header flex-between">
            <span class="card-title">操作记录</span>
            <span class="text-sm text-muted" id="logs-count">加载中...</span>
          </div>
          <div class="card-body" id="logs-table-container" style="flex:1;overflow-y:auto;min-height:0;">
            <div class="empty-state"><div class="spinner"></div><p>加载中...</p></div>
          </div>
        </div>
        <div class="flex-between" style="flex-shrink:0;" id="logs-pagination"></div>
      </div>`;
  },

  async mount() {
    // 筛选项变化时自动刷新
    const filterIds = ['logs-filter-start', 'logs-filter-end', 'logs-filter-user', 'logs-filter-action'];
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { this.currentPage = 1; this.loadLogs(); });
    });
    document.getElementById('logs-filter-reset').addEventListener('click', () => {
      filterIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      this.currentPage = 1;
      this.loadLogs();
    });

    await this.loadLogs();
  },

  async refresh() {
    this.currentPage = 1;
    await this.loadLogs();
  },

  _getFilterParams() {
    const params = {};
    const start = document.getElementById('logs-filter-start')?.value;
    const end = document.getElementById('logs-filter-end')?.value;
    const user = document.getElementById('logs-filter-user')?.value;
    const action = document.getElementById('logs-filter-action')?.value;
    if (start) params.start_date = start;
    if (end) params.end_date = end;
    if (user) params.username = user;
    if (action) params.action = action;
    return params;
  },

  async loadLogs() {
    try {
      const params = this._getFilterParams();
      const res = await API.getLogs(this.currentPage, this.limit, params);
      const { logs, total, page, limit } = res;
      const totalPages = Math.ceil(total / limit);
      document.getElementById('logs-count').textContent = `共 ${total} 条记录`;

      // 显示当前筛选条件
      const infoEl = document.getElementById('logs-filter-info');
      const infoParts = [];
      if (params.start_date || params.end_date) infoParts.push('时间范围');
      if (params.username) infoParts.push(`用户: ${params.username}`);
      if (params.action) infoParts.push(`操作: ${params.action}`);
      if (infoEl) { infoEl.textContent = infoParts.length > 0 ? `筛选: ${infoParts.join(' | ')}` : ''; infoEl.style.display = infoParts.length > 0 ? 'inline' : 'none'; }

      const container = document.getElementById('logs-table-container');
      if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>暂无操作记录</p></div>';
        document.getElementById('logs-pagination').innerHTML = '';
        return;
      }

      const actionColors = {
        '用户注册': 'tag-green', '用户登录': 'tag-blue', '创建用户': 'tag-green',
        '创建项目': 'tag-blue', '编辑项目': 'tag-yellow', '删除项目': 'tag-red',
        '创建产品': 'tag-blue', '编辑产品': 'tag-yellow', '删除产品': 'tag-red',
        '修改用户角色': 'tag-yellow', '重置密码': 'tag-yellow', '删除用户': 'tag-red',
        '更新进度': 'tag-blue', '导出数据': 'tag-gray',
      };

      container.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>时间</th><th>用户</th><th>操作</th><th>对象</th><th>详情</th></tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="white-space:nowrap;font-size:12px;">${l.created_at || '-'}</td>
                  <td>${l.username || '系统'}</td>
                  <td><span class="tag ${actionColors[l.action] || 'tag-gray'}">${l.action}</span></td>
                  <td style="font-size:12px;color:var(--gray-500);">${l.target_type || '-'}${l.target_id ? ' #' + l.target_id : ''}</td>
                  <td style="font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.detail || ''}">${l.detail || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;

      let pagHtml = '';
      if (totalPages > 1) {
        pagHtml += '<div class="flex gap-8">';
        pagHtml += `<button class="btn btn-outline btn-sm" onclick="LogsPage.goPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;
        pagHtml += `<span class="text-sm text-muted" style="line-height:32px;">${page} / ${totalPages}</span>`;
        pagHtml += `<button class="btn btn-outline btn-sm" onclick="LogsPage.goPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页</button>`;
        pagHtml += '</div>';
      }
      document.getElementById('logs-pagination').innerHTML = pagHtml;

    } catch (e) {
      document.getElementById('logs-table-container').innerHTML =
        `<div class="empty-state"><div class="icon">❌</div><p>加载失败: ${e.message}</p></div>`;
    }
  },

  async goPage(p) {
    this.currentPage = p;
    await this.loadLogs();
  }
};
