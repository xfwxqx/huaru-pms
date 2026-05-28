// 用户管理页（仅系统管理员可见）
const UsersPage = {
  render() {
    return `
      <div class="page-container" style="gap:var(--page-padding);">
        <div class="page-header flex-between" style="flex-shrink:0;">
          <div>
            <div class="page-title">👥 用户管理</div>
            <div class="page-subtitle">管理系统用户：创建、编辑角色、重置密码</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="UsersPage.showAddModal()">+ 添加用户</button>
        </div>
        <div class="card" style="flex:1;min-height:0;">
          <div class="card-header"><span class="card-title">用户列表</span></div>
          <div class="card-body" id="users-table-container" style="overflow-y:auto;">
            <div class="empty-state"><div class="spinner"></div><p>加载中...</p></div>
          </div>
        </div>
      </div>`;
  },

  async mount() {
    await this.loadUsers();
  },

  async loadUsers() {
    try {
      const res = await API.getUsers();
      const users = res.users || [];
      const container = document.getElementById('users-table-container');

      if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">👤</div><p>暂无用户</p></div>';
        return;
      }

      const roleOptions = ['系统管理员', '项目总监', '项目经理', '项目组成员'];

      container.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>用户名</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${users.map(u => {
                const isAdmin = u.username === 'admin';
                return `
                <tr>
                  <td>${u.id}</td>
                  <td><strong>${u.username}${isAdmin ? ' <span style="color:var(--primary);font-size:11px;">(内置)</span>' : ''}</strong></td>
                  <td>
                    ${isAdmin
                      ? `<span class="tag tag-blue">${u.role}</span>`
                      : `<select onchange="UsersPage.changeRole(${u.id}, this.value)" style="padding:3px 6px;font-size:12px;border-radius:4px;border:1px solid var(--gray-300);">
                          ${roleOptions.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>`
                    }
                  </td>
                  <td style="font-size:12px;color:var(--gray-500);">${u.created_at || '-'}</td>
                  <td>
                    <div class="flex gap-8" style="flex-wrap:wrap;">
                      ${!isAdmin ? `<button class="btn btn-outline btn-sm" onclick="UsersPage.showPasswordModal(${u.id}, '${u.username}')">🔑 密码</button>` : ''}
                      ${!isAdmin ? `<button class="btn btn-danger btn-sm" onclick="UsersPage.deleteUser(${u.id}, '${u.username}')">🗑️ 删除</button>` : '<span class="text-sm text-muted">-</span>'}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      document.getElementById('users-table-container').innerHTML =
        `<div class="empty-state"><div class="icon">❌</div><p>加载失败: ${e.message}</p></div>`;
    }
  },

  async changeRole(userId, newRole) {
    try {
      await API.updateUserRole(userId, newRole);
      App.showToast('角色已更新', 'success');
    } catch (e) {
      App.showToast('更新失败: ' + e.message, 'error');
      await this.loadUsers();
    }
  },

  showAddModal() {
    const roleOptions = ['项目组成员', '项目经理', '项目总监', '系统管理员'];
    Modal.show('添加用户', `
      <div class="form-group">
        <label class="form-label">用户名 *</label>
        <input type="text" class="form-input" id="add-username" placeholder="请输入用户名（至少2位）" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">密码 *</label>
        <input type="password" class="form-input" id="add-password" placeholder="请输入密码（至少4位）" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">角色</label>
        <select class="form-select" id="add-role">
          ${roleOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
    `, async () => {
      const username = document.getElementById('add-username').value.trim();
      const password = document.getElementById('add-password').value;
      const role = document.getElementById('add-role').value;

      if (!username || !password) { App.showToast('用户名和密码不能为空', 'error'); return false; }
      if (username.length < 2) { App.showToast('用户名至少2位', 'error'); return false; }
      if (password.length < 4) { App.showToast('密码至少4位', 'error'); return false; }

      try {
        await API.createUser({ username, password, role });
        App.showToast('用户创建成功', 'success');
        Modal.hide();
        await this.loadUsers();
      } catch (e) {
        App.showToast(e.message, 'error');
        return false;
      }
      return true;
    });
  },

  showPasswordModal(userId, username) {
    Modal.show(`重置密码 - ${username}`, `
      <div class="form-group">
        <label class="form-label">新密码 *</label>
        <input type="password" class="form-input" id="reset-password" placeholder="请输入新密码（至少4位）" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">确认密码 *</label>
        <input type="password" class="form-input" id="reset-password2" placeholder="请再次输入新密码">
      </div>
    `, async () => {
      const pwd = document.getElementById('reset-password').value;
      const pwd2 = document.getElementById('reset-password2').value;

      if (!pwd) { App.showToast('密码不能为空', 'error'); return false; }
      if (pwd.length < 4) { App.showToast('密码至少4位', 'error'); return false; }
      if (pwd !== pwd2) { App.showToast('两次密码不一致', 'error'); return false; }

      try {
        await API.resetUserPassword(userId, pwd);
        App.showToast(`用户"${username}"密码已重置`, 'success');
        Modal.hide();
      } catch (e) {
        App.showToast(e.message, 'error');
        return false;
      }
      return true;
    });
  },

  async deleteUser(userId, username) {
    if (!confirm(`确定删除用户"${username}"吗？此操作不可恢复。`)) return;
    try {
      await API.deleteUser(userId);
      App.showToast('用户已删除', 'success');
      await this.loadUsers();
    } catch (e) {
      App.showToast('删除失败: ' + e.message, 'error');
    }
  }
};
