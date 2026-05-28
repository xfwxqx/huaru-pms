// 项目管理页（自适应）
const ProjectsPage = {
  currentProjectId: null,
  currentProject: null,
  products: [],
  // 批量编辑相关
  selectedProductIds: new Set(),
  batchMode: false,  // 是否处于批量编辑模式
  // 筛选相关
  filterKeyword: '',  // 产品名称筛选关键词

  render() {
    return `
      <div class="page-container" style="gap:var(--page-padding);">
        <div class="page-header flex-between" style="flex-shrink:0;">
          <div>
            <div class="page-title">📁 项目管理</div>
            <div class="page-subtitle">管理项目信息与产品进度</div>
          </div>
          <button class="btn btn-primary" id="btn-add-project">+ 新建项目</button>
        </div>

        <div class="projects-page-layout">
          <div class="project-list-panel">
            <div class="card">
              <div class="card-header"><span class="card-title">项目列表</span></div>
              <div class="card-body" id="project-list-container" style="overflow-y:auto;">
                <div class="empty-state"><div class="spinner"></div><p>加载中...</p></div>
              </div>
            </div>
          </div>
          <div class="project-detail-panel" id="project-detail-container" style="padding-right:2px;">
            <div class="empty-state" style="padding:10vh 20px;">
              <div class="icon">👈</div>
              <p>请从左侧列表选择项目</p>
            </div>
          </div>
        </div>
      </div>`;
  },

  async mount() {
    const addBtn = document.getElementById('btn-add-project');
    if (App.canEdit()) {
      addBtn.addEventListener('click', () => this.showProjectModal());
    } else {
      addBtn.style.display = 'none';
    }
    await this.loadProjects();
  },

  async loadProjects() {
    try {
      const res = await API.getProjects();
      const projects = res.projects;
      const container = document.getElementById('project-list-container');

      if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>暂无项目</p></div>';
        return;
      }

      container.innerHTML = projects.map(p => {
        const statusMap = {
          '已立项': 'tag-yellow',
          '进行中': 'tag-blue',
          '已验收': 'tag-green'
        };
        const selected = this.currentProjectId === p.id ? ' selected' : '';
        return `
          <div class="project-item${selected}" data-id="${p.id}" onclick="ProjectsPage.selectProject(${p.id})">
            <div class="pi-name">${p.name}</div>
            <div class="pi-meta">
              <span>👤 ${p.manager || '-'}</span>
              <span>📦 ${p.product_count}个产品</span>
            </div>
            <div class="pi-status"><span class="tag ${statusMap[p.status] || 'tag-gray'}">${p.status}</span></div>
            <div class="pi-meta" style="margin-top:3px;">
              <span>📅 ${p.start_date || '-'} ~ ${p.end_date || '-'}</span>
            </div>
          </div>`;
      }).join('');

      if (this.currentProjectId) {
        this.selectProject(this.currentProjectId);
      }
    } catch (e) {
      console.error('加载项目列表失败:', e);
    }
  },

  async selectProject(id) {
    this.currentProjectId = id;
    // 重置批量选择状态
    this.selectedProductIds.clear();
    this.batchMode = false;
    // 重置筛选关键词
    this.filterKeyword = '';
    document.querySelectorAll('.project-item').forEach(el => {
      el.classList.toggle('selected', parseInt(el.dataset.id) === id);
    });

    try {
      const res = await API.getProject(id);
      this.currentProject = res.project;
      this.products = res.products || [];
      this.renderProjectDetail();
    } catch (e) {
      console.error('加载项目详情失败:', e);
    }
  },

  renderProjectDetail() {
    const p = this.currentProject;
    if (!p) return;

    const canEdit = App.canEdit();
    const container = document.getElementById('project-detail-container');
    const statusMap = {
      '已立项': 'tag-yellow',
      '进行中': 'tag-blue',
      '已验收': 'tag-green'
    };

    const editBtns = canEdit ? `
            <button class="btn btn-outline btn-sm" onclick="ProjectsPage.showProjectModal(${p.id})">✏️ 编辑</button>
            <button class="btn btn-danger btn-sm" onclick="ProjectsPage.deleteProject(${p.id})">🗑️ 删除</button>` : '';

    const addProductBtn = canEdit
      ? '<button class="btn btn-primary btn-sm" onclick="ProjectsPage.showProductModal()">+ 新增产品</button>'
      : '';

    const emptyMsg = canEdit
      ? '暂无产品，请点击"新增产品"'
      : '暂无产品（只读权限，联系项目经理或项目总监添加）';

    // 将 emptyMsg 存到实例上供 renderProductsList 使用
    this._emptyMsg = emptyMsg;

    container.innerHTML = `
      <div class="card" style="flex-shrink:0;margin-bottom:var(--page-padding);">
        <div class="card-header">
          <span class="card-title">📋 ${p.name}</span>
          <div class="flex gap-8">
            ${editBtns}
          </div>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(8px,1vw,12px);font-size:clamp(11px,0.75vw,13px);">
            <div><span class="text-muted">状态：</span><span class="tag ${statusMap[p.status] || 'tag-gray'}">${p.status}</span></div>
            <div><span class="text-muted">项目经理：</span>${p.manager || '-'}</div>
            <div><span class="text-muted">开始时间：</span>${p.start_date || '-'}</div>
            <div><span class="text-muted">结束时间：</span>${p.end_date || '-'}</div>
          </div>
          <div class="mt-12"><span class="text-muted">描述：</span>${p.description || '暂无描述'}</div>
        </div>
      </div>

      <div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column;">
        <div class="card-header" style="flex-wrap:wrap;gap:8px;">
          <span class="card-title">📦 产品列表 (${this.products.length})</span>
          <div style="flex:1;min-width:150px;max-width:300px;">
            <input type="text" id="product-filter-input" placeholder="🔍 搜索产品名称..." 
              style="width:100%;padding:4px 10px;font-size:12px;border:1px solid var(--gray-300);border-radius:4px;"
              oninput="ProjectsPage.filterProducts(this.value)">
          </div>
          <div class="flex gap-8">
            ${canEdit ? `<label class="batch-check-all" style="display:none;align-items:center;gap:4px;font-size:12px;cursor:pointer;user-select:none;" id="batch-check-all-label">
              <input type="checkbox" id="batch-check-all" onchange="ProjectsPage.toggleSelectAll(this.checked)" style="cursor:pointer;">
              全选
            </label>
            <button class="btn btn-outline btn-sm" id="btn-batch-mode" onclick="ProjectsPage.toggleBatchMode()">☑ 批量编辑</button>
            <button class="btn btn-primary btn-sm" id="btn-batch-apply" style="display:none;" onclick="ProjectsPage.showBatchEditModal()">✏️ 批量编辑 (0)</button>
            <button class="btn btn-outline btn-sm" onclick="ProjectsPage.showImportModal()">📥 批量导入</button>` : ''}
            ${addProductBtn}
          </div>
        </div>
        <div class="card-body" id="products-list-container" style="flex:1;overflow-y:auto;min-height:0;">
          ${this.renderProductsList()}
        </div>
      </div>`;
  },

  // 获取筛选后的产品列表
  getFilteredProducts() {
    if (!this.filterKeyword || this.filterKeyword.trim() === '') {
      return this.products;
    }
    const keyword = this.filterKeyword.toLowerCase().trim();
    return this.products.filter(prod =>
      prod.name && prod.name.toLowerCase().includes(keyword)
    );
  },

  // 筛选产品（实时过滤）
  filterProducts(keyword) {
    this.filterKeyword = keyword;
    // 重新渲染产品列表
    const container = document.getElementById('products-list-container');
    if (container) {
      container.innerHTML = this.renderProductsList();
    }
    // 更新产品数量显示
    const filteredCount = this.getFilteredProducts().length;
    const totalCount = this.products.length;
    const titleEl = document.querySelector('.card-title');
    if (titleEl && titleEl.textContent.includes('产品列表')) {
      titleEl.textContent = `📦 产品列表 (${filteredCount}/${totalCount})`;
    }
  },

  renderProductsList() {
    const canEdit = App.canEdit();
    const emptyMsg = this._emptyMsg || (canEdit
      ? '暂无产品，请点击"新增产品"'
      : '暂无产品（只读权限，联系项目经理或项目总监添加）');

    // 应用筛选
    const filteredProducts = this.getFilteredProducts();

    if (filteredProducts.length === 0) {
      const noMatchMsg = this.filterKeyword
        ? `没有匹配"${this.filterKeyword}"的产品`
        : emptyMsg;
      return `<div class="empty-state"><div class="icon">📦</div><p>${noMatchMsg}</p></div>`;
    }

    return filteredProducts.map(prod => {
      const actionBtns = canEdit
        ? `<button class="btn btn-outline btn-sm" onclick="ProjectsPage.showProductModal(${prod.id})">✏️ 编辑</button>
            <button class="btn btn-danger btn-sm" onclick="ProjectsPage.deleteProduct(${prod.id})">🗑️</button>`
        : '';

      const attrLabel = prod.attribute || '自研产品';
      const attrClass = attrLabel === '外购产品' ? 'tag-yellow' : attrLabel === '自研软件' ? 'tag-blue' : 'tag-green';
      const modelInfo = prod.model ? `型号: ${prod.model}` : '';
      const quantityInfo = prod.quantity ? `数量: ${prod.quantity}` : '';
      const desc = prod.description || '';
      const descShort = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
      const metaParts = [modelInfo, quantityInfo, `负责人: ${prod.person_in_charge || '-'}`, descShort].filter(Boolean);

      const isChecked = this.selectedProductIds.has(prod.id);

      return `
      <div class="product-card">
        <div class="pc-header">
          <div style="flex:1;min-width:150px;display:flex;align-items:flex-start;gap:8px;">
            <input type="checkbox" class="batch-checkbox" value="${prod.id}" ${isChecked ? 'checked' : ''} onchange="ProjectsPage.toggleSelectProduct(${prod.id}, this.checked)" style="display:none;margin-top:2px;cursor:pointer;width:16px;height:16px;flex-shrink:0;">
            <div style="flex:1;">
              <div class="pc-name">📦 ${prod.name} <span class="tag ${attrClass}">${attrLabel}</span></div>
              <div class="text-sm text-muted">${metaParts.join(' | ')}</div>
            </div>
          </div>
          <div class="flex gap-8" style="flex-shrink:0;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="ProjectsPage.toggleProductProgress(${prod.id}, this)">📊 进度</button>
            ${actionBtns}
          </div>
        </div>
        <div id="product-progress-${prod.id}" class="mt-12"></div>
      </div>`;
    }).join('');
  },

  async toggleProductProgress(productId, btnEl) {
    const container = document.getElementById(`product-progress-${productId}`);
    if (!container) return;

    // 如果已经有内容，则关闭
    if (container.innerHTML.trim() !== '') {
      container.innerHTML = '';
      if (btnEl) btnEl.textContent = '📊 进度';
      return;
    }

    // 先显示加载状态
    container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>加载中...</p></div>';
    if (btnEl) { btnEl.textContent = '⏳ 加载中...'; btnEl.disabled = true; }

    try {
      await this.loadProductProgress(productId);
      if (btnEl) { btnEl.textContent = '📊 收起'; btnEl.disabled = false; }
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>加载失败，请重试</p></div>';
      if (btnEl) { btnEl.textContent = '📊 进度'; btnEl.disabled = false; }
    }
  },

  async loadProductProgress(productId) {
    this._currentProgressProductId = productId;
    const container = document.getElementById(`product-progress-${productId}`);
    if (!container) return;

    try {
      const res = await API.getProgress(productId);
      const progress = res.progress || [];
      const canEdit = App.canEdit();

      container.innerHTML = `
        <div class="pp-stages">
          ${progress.map(p => {
            const isOptional = p.stage_index === 2;
            const statusColor = p.status === '已完成' ? 'color:var(--success);' : p.status === '进行中' ? 'color:var(--primary);' : p.status === '不需要' ? 'color:var(--gray-400);opacity:0.7;' : 'color:var(--gray-400);';
            return `
              <div class="pp-stage-row" style="${p.status === '不需要' ? 'opacity:0.6;' : ''}">
                <div class="pp-stage-name" style="${statusColor}">
                  ${p.stage_name}${isOptional ? '<span style="color:var(--gray-400);font-size:11px;">(可选)</span>' : ''}
                </div>
                <div class="pp-stage-dates">
                  <input type="date" value="${p.planned_start || ''}" onchange="ProjectsPage.updateProgressDate(${p.id},'planned_start',this.value)" title="计划开始" ${canEdit ? '' : 'disabled'} ${p.status === '不需要' ? 'disabled' : ''}>
                  <span style="color:var(--gray-300);">~</span>
                  <input type="date" value="${p.planned_end || ''}" onchange="ProjectsPage.updateProgressDate(${p.id},'planned_end',this.value)" title="计划结束" ${canEdit ? '' : 'disabled'} ${p.status === '不需要' ? 'disabled' : ''}>
                </div>
                <div class="pp-stage-status">
                  <select onchange="ProjectsPage.updateProgressStatus(${p.id}, this.value)" style="padding:3px 5px;font-size:11px;border-radius:4px;border:1px solid var(--gray-300);" ${canEdit ? '' : 'disabled'}>
                    <option value="未开始" ${p.status==='未开始'?'selected':''}>未开始</option>
                    <option value="进行中" ${p.status==='进行中'?'selected':''}>进行中</option>
                    <option value="已完成" ${p.status==='已完成'?'selected':''}>已完成</option>
                    <option value="不需要" ${p.status==='不需要'?'selected':''}>不需要</option>
                  </select>
                </div>
              </div>`;
          }).join('')}
        </div>
      `;
    } catch (e) {
      container.innerHTML = '<div class="text-sm" style="color:var(--danger);">加载失败</div>';
    }
  },

  async updateProgressStatus(id, status) {
    try {
      await API.updateProgress(id, { status });
      App.showToast(status === '已完成' ? '状态已更新（计划结束时间已设为当前）' : '状态已更新', 'success');
      // 刷新该产品的进度显示以反映日期变化
      const productId = this._currentProgressProductId;
      if (productId) await this.loadProductProgress(productId);
    } catch (e) {
      App.showToast('更新失败: ' + e.message, 'error');
    }
  },

  async updateProgressDate(id, field, value) {
    try {
      await API.updateProgress(id, { [field]: value });
    } catch (e) {
      App.showToast('更新失败: ' + e.message, 'error');
    }
  },

  showProjectModal(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? '编辑项目' : '新建项目';
    const p = isEdit ? this.currentProject : {};
    const statusOptions = ['已立项', '进行中', '已验收'];

    Modal.show(title, `
      <div class="form-group">
        <label class="form-label">项目名称 *</label>
        <input type="text" class="form-input" id="proj-name" value="${isEdit ? (p.name || '') : ''}" placeholder="请输入项目名称">
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <textarea class="form-textarea" id="proj-desc" placeholder="请输入项目描述">${isEdit ? (p.description || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">项目经理</label>
        <input type="text" class="form-input" id="proj-manager" value="${isEdit ? (p.manager || '') : ''}" placeholder="请输入项目经理姓名">
      </div>
      <div class="form-group">
        <label class="form-label">项目状态</label>
        <select class="form-select" id="proj-status">
          ${statusOptions.map(s => `<option value="${s}" ${isEdit && p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">开始时间</label>
          <input type="date" class="form-input" id="proj-start" value="${isEdit ? (p.start_date || '') : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">结束时间</label>
          <input type="date" class="form-input" id="proj-end" value="${isEdit ? (p.end_date || '') : ''}">
        </div>
      </div>
    `, async () => {
      const name = document.getElementById('proj-name').value.trim();
      if (!name) { App.showToast('项目名称不能为空', 'error'); return false; }

      const data = {
        name,
        description: document.getElementById('proj-desc').value.trim(),
        manager: document.getElementById('proj-manager').value.trim(),
        status: document.getElementById('proj-status').value,
        start_date: document.getElementById('proj-start').value,
        end_date: document.getElementById('proj-end').value,
      };

      try {
        if (isEdit) {
          await API.updateProject(id, data);
          App.showToast('项目已更新', 'success');
        } else {
          await API.createProject(data);
          App.showToast('项目已创建', 'success');
        }
        Modal.hide();
        await this.loadProjects();
        if (isEdit && this.currentProjectId === id) {
          await this.selectProject(id);
        }
      } catch (e) {
        App.showToast(e.message, 'error');
        return false;
      }
      return true;
    });
  },

  async deleteProject(id) {
    if (!confirm('确定要删除该项目吗？该项目下的所有产品也将被删除。')) return;
    try {
      await API.deleteProject(id);
      App.showToast('项目已删除', 'success');
      this.currentProjectId = null;
      this.currentProject = null;
      this.products = [];
      document.getElementById('project-detail-container').innerHTML =
        '<div class="empty-state" style="padding:10vh 20px;"><div class="icon">👈</div><p>请从左侧列表选择项目</p></div>';
      await this.loadProjects();
    } catch (e) {
      App.showToast('删除失败: ' + e.message, 'error');
    }
  },

  showProductModal(id = null) {
    if (!this.currentProjectId) {
      App.showToast('请先选择项目', 'warning');
      return;
    }

    const isEdit = id !== null;
    const title = isEdit ? '编辑产品' : '新增产品';
    const prod = isEdit ? this.products.find(p => p.id === id) : {};
    const attrOptions = ['自研产品', '外购产品', '自研软件'];
    const currentAttr = isEdit ? (prod.attribute || '自研产品') : '自研产品';

    Modal.show(title, `
      <div class="form-group">
        <label class="form-label">产品名称 *</label>
        <input type="text" class="form-input" id="prod-name" value="${isEdit ? (prod.name || '') : ''}" placeholder="请输入产品名称">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">产品型号</label>
          <input type="text" class="form-input" id="prod-model" value="${isEdit ? (prod.model || '') : ''}" placeholder="请输入产品型号">
        </div>
        <div class="form-group">
          <label class="form-label">数量</label>
          <input type="number" class="form-input" id="prod-quantity" value="${isEdit ? (prod.quantity || 1) : 1}" min="1" placeholder="数量">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">属性 *</label>
        <select class="form-select" id="prod-attribute">
          ${attrOptions.map(a => `<option value="${a}" ${currentAttr === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">不同属性对应不同的产品进度阶段</div>
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <textarea class="form-textarea" id="prod-desc" placeholder="请输入产品描述">${isEdit ? (prod.description || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">负责人</label>
        <input type="text" class="form-input" id="prod-person" value="${isEdit ? (prod.person_in_charge || '') : ''}" placeholder="请输入负责人">
      </div>
    `, async () => {
      const name = document.getElementById('prod-name').value.trim();
      if (!name) { App.showToast('产品名称不能为空', 'error'); return false; }

      const data = {
        name,
        model: document.getElementById('prod-model').value.trim(),
        quantity: parseInt(document.getElementById('prod-quantity').value) || 1,
        attribute: document.getElementById('prod-attribute').value,
        description: document.getElementById('prod-desc').value.trim(),
        person_in_charge: document.getElementById('prod-person').value.trim(),
      };

      try {
        if (isEdit) {
          await API.updateProduct(id, data);
          App.showToast('产品已更新', 'success');
        } else {
          data.project_id = this.currentProjectId;
          await API.createProduct(data);
          App.showToast('产品已创建', 'success');
        }
        Modal.hide();
        await this.selectProject(this.currentProjectId);
      } catch (e) {
        App.showToast(e.message, 'error');
        return false;
      }
      return true;
    });
  },

  async deleteProduct(id) {
    if (!confirm('确定要删除该产品吗？其进度数据也将被删除。')) return;
    try {
      await API.deleteProduct(id);
      App.showToast('产品已删除', 'success');
      await this.selectProject(this.currentProjectId);
    } catch (e) {
      App.showToast('删除失败: ' + e.message, 'error');
    }
  },

  // ==================== 批量编辑 ====================

  toggleBatchMode() {
    this.batchMode = !this.batchMode;
    const checkboxes = document.querySelectorAll('.batch-checkbox');
    const allCheckLabel = document.getElementById('batch-check-all-label');
    const batchApplyBtn = document.getElementById('btn-batch-apply');
    const batchModeBtn = document.getElementById('btn-batch-mode');
    
    if (this.batchMode) {
      // 进入批量编辑模式
      checkboxes.forEach(cb => cb.style.display = '');
      if (allCheckLabel) allCheckLabel.style.display = '';
      if (batchApplyBtn) batchApplyBtn.style.display = '';
      if (batchModeBtn) batchModeBtn.textContent = '✖ 取消批量';
      this.selectedProductIds.clear();
      document.getElementById('batch-check-all').checked = false;
      // 同步已勾选的checkbox
      checkboxes.forEach(cb => cb.checked = false);
    } else {
      // 退出批量编辑模式
      checkboxes.forEach(cb => { cb.style.display = 'none'; cb.checked = false; });
      if (allCheckLabel) allCheckLabel.style.display = 'none';
      if (batchApplyBtn) batchApplyBtn.style.display = 'none';
      if (batchModeBtn) batchModeBtn.textContent = '☑ 批量编辑';
      this.selectedProductIds.clear();
    }
    this.updateBatchButton();
  },

  toggleSelectProduct(productId, checked) {
    if (checked) {
      this.selectedProductIds.add(productId);
    } else {
      this.selectedProductIds.delete(productId);
      document.getElementById('batch-check-all').checked = false;
    }
    this.updateBatchButton();
  },

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.batch-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = checked;
      if (checked) {
        this.selectedProductIds.add(parseInt(cb.value));
      } else {
        this.selectedProductIds.delete(parseInt(cb.value));
      }
    });
    this.updateBatchButton();
  },

  updateBatchButton() {
    const batchApplyBtn = document.getElementById('btn-batch-apply');
    const checkAll = document.getElementById('batch-check-all');
    if (batchApplyBtn) {
      const count = this.selectedProductIds.size;
      batchApplyBtn.textContent = `✏️ 批量编辑 (${count})`;
      batchApplyBtn.disabled = count === 0;
    }
    if (checkAll) {
      const allCbs = document.querySelectorAll('.batch-checkbox');
      checkAll.checked = allCbs.length > 0 && this.selectedProductIds.size === allCbs.length;
    }
  },

  showBatchEditModal() {
    if (this.selectedProductIds.size === 0) {
      App.showToast('请先勾选要编辑的产品', 'warning');
      return;
    }

    const STAGE_NAMES = [
      '图纸受控与BOM确认', '烧录程序发布', '初样确认', '物料采购/成品采购',
      '工艺受控', '正样确认', '生产组装', '应用程序发布',
      '配置升级', '成品检验', '打包发货'
    ];

    const statusOptions = ['<option value="">不修改</option>',
      '<option value="未开始">未开始</option>',
      '<option value="进行中">进行中</option>',
      '<option value="已完成">已完成</option>',
      '<option value="不需要">不需要</option>'
    ].join('');

    const stageRows = STAGE_NAMES.map((name, idx) => `
      <tr id="batch-row-${idx}">
        <td style="text-align:center;padding:6px 8px;">
          <input type="checkbox" class="batch-stage-cb" value="${idx}" onchange="ProjectsPage._toggleBatchRow(${idx}, this.checked)" style="accent-color:var(--primary);cursor:pointer;width:16px;height:16px;">
        </td>
        <td style="padding:6px 8px;font-size:12px;white-space:nowrap;">阶段${idx+1}: ${name}</td>
        <td style="padding:6px 4px;"><input type="date" class="batch-field batch-start-${idx}" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid var(--gray-300);border-radius:4px;" disabled></td>
        <td style="padding:6px 4px;"><input type="date" class="batch-field batch-end-${idx}" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid var(--gray-300);border-radius:4px;" disabled></td>
        <td style="padding:6px 4px;"><select class="batch-field batch-status-${idx}" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid var(--gray-300);border-radius:4px;" disabled>${statusOptions}</select></td>
      </tr>
    `).join('');

    Modal.show('批量编辑产品进度', `
      <div style="margin-bottom:12px;padding:8px 12px;background:var(--primary-bg);border-radius:6px;font-size:13px;color:var(--primary);font-weight:500;">
        📋 已选择 <strong>${this.selectedProductIds.size}</strong> 个产品
      </div>
      <div style="margin-bottom:8px;font-size:12px;color:var(--gray-500);">
        <a href="javascript:void(0)" onclick="document.querySelectorAll('.batch-stage-cb').forEach(c=>{c.checked=true;ProjectsPage._toggleBatchRow(parseInt(c.value),true)})" style="color:var(--primary);">全选所有阶段</a>
        &nbsp;|&nbsp;
        <a href="javascript:void(0)" onclick="document.querySelectorAll('.batch-stage-cb').forEach(c=>{c.checked=false;ProjectsPage._toggleBatchRow(parseInt(c.value),false)})" style="color:var(--primary);">清除选择</a>
        &nbsp;<span style="color:var(--gray-400);">勾选阶段后可分别设置每个阶段的日期和状态</span>
      </div>
      <div style="max-height:50vh;overflow-y:auto;border:1px solid var(--gray-200);border-radius:6px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--gray-50);position:sticky;top:0;z-index:1;">
              <th style="width:36px;text-align:center;padding:8px 6px;font-size:12px;">☑</th>
              <th style="width:140px;padding:8px 6px;font-size:12px;">阶段</th>
              <th style="padding:8px 6px;font-size:12px;">计划开始</th>
              <th style="padding:8px 6px;font-size:12px;">计划结束</th>
              <th style="padding:8px 6px;font-size:12px;">状态</th>
            </tr>
          </thead>
          <tbody>${stageRows}</tbody>
        </table>
      </div>
    `, async () => {
      const checkedCbs = document.querySelectorAll('.batch-stage-cb:checked');
      if (checkedCbs.length === 0) {
        App.showToast('请至少勾选一个阶段', 'error');
        return false;
      }

      const stageConfigs = [];
      checkedCbs.forEach(cb => {
        const idx = parseInt(cb.value);
        const plannedStart = document.querySelector(`.batch-start-${idx}`).value;
        const plannedEnd = document.querySelector(`.batch-end-${idx}`).value;
        const status = document.querySelector(`.batch-status-${idx}`).value;

        // 该阶段至少填写了一个字段
        if (plannedStart || plannedEnd || status) {
          const cfg = { stage_index: idx };
          if (plannedStart) cfg.planned_start = plannedStart;
          if (plannedEnd) cfg.planned_end = plannedEnd;
          if (status) cfg.status = status;
          stageConfigs.push(cfg);
        }
      });

      if (stageConfigs.length === 0) {
        App.showToast('请至少为一个阶段填写要更新的字段', 'error');
        return false;
      }

      const data = {
        product_ids: Array.from(this.selectedProductIds),
        stage_configs: stageConfigs
      };

      return await this.submitBatchEdit(data);
    });
  },

  // 切换批量编辑中某行的启用/禁用状态
  _toggleBatchRow(idx, enabled) {
    const fields = document.querySelectorAll(`.batch-start-${idx}, .batch-end-${idx}, .batch-status-${idx}`);
    fields.forEach(f => {
      f.disabled = !enabled;
      if (!enabled) {
        if (f.tagName === 'SELECT') f.value = '';
        else f.value = '';
      }
    });
  },

  async submitBatchEdit(data) {
    try {
      const res = await API.batchUpdateProgress(data);
      App.showToast(`${res.message}`, 'success');
      Modal.hide();
      
      // 退出批量模式并刷新
      this.toggleBatchMode();
      await this.selectProject(this.currentProjectId);
      
      return true;
    } catch (e) {
      App.showToast('批量更新失败: ' + e.message, 'error');
      return false;
    }
  },

  // ==================== 批量导入 ====================

  showImportModal() {
    if (!this.currentProjectId) {
      App.showToast('请先选择项目', 'warning');
      return;
    }

    Modal.show('📥 批量导入产品', `
      <div style="margin-bottom:16px;">
        <div style="margin-bottom:12px;padding:10px 14px;background:var(--primary-bg);border-radius:6px;font-size:13px;color:var(--primary);">
          <strong>说明：</strong>上传 Excel 文件（.xlsx），系统将自动创建产品及对应的进度阶段。
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-weight:500;margin-bottom:6px;font-size:13px;">选择 Excel 文件</label>
          <input type="file" id="import-file" accept=".xlsx,.xls" style="font-size:13px;">
        </div>
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px;">
          <strong>Excel 表头要求（第一行为表头）：</strong>
          <div style="margin-top:4px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:4px;padding:8px 10px;font-family:monospace;font-size:11px;line-height:1.8;">
            产品名称<span style="color:var(--danger);">*</span> | 产品型号 | 数量 | 属性 | 描述 | 负责人<br>
            <span style="color:var(--gray-400);font-size:10px;">属性可选值：自研产品、外购产品、自研软件（默认：自研产品）</span>
          </div>
        </div>
        <div style="text-align:center;">
          <a href="javascript:void(0)" onclick="ProjectsPage.downloadImportTemplate()" style="color:var(--primary);font-size:13px;text-decoration:underline;">
            📥 下载示例模板
          </a>
        </div>
      </div>
    `, async () => {
      const fileInput = document.getElementById('import-file');
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        App.showToast('请选择 Excel 文件', 'error');
        return false;
      }

      const file = fileInput.files[0];
      if (!file.name.match(/\.xlsx?$/i)) {
        App.showToast('请选择 .xlsx 或 .xls 格式的文件', 'error');
        return false;
      }

      try {
        // 读取文件为 base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            resolve(dataUrl.split(',')[1]); // 去掉 data:application/...;base64, 前缀
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        App.showToast('正在导入...', 'warning');

        const res = await API.importProducts(this.currentProjectId, base64);
        App.showToast(res.message, 'success');
        Modal.hide();
        await this.selectProject(this.currentProjectId);
        return true;
      } catch (e) {
        // 尝试从服务器获取详细错误信息
        let errMsg = e.message || '导入失败';
        // 如果错误消息包含 details，展示前3条
        if (errMsg.includes('数据校验失败')) {
          errMsg = '数据校验失败，请检查 Excel 文件内容';
        }
        App.showToast(errMsg, 'error');
        return false;
      }
    });
  },

  downloadImportTemplate() {
    // 使用 SheetJS 在浏览器端生成示例 Excel
    const XLSX = window.XLSX;
    if (!XLSX) {
      App.showToast('模板加载中，请稍后重试', 'warning');
      return;
    }

    const data = [
      { '产品名称': '示例产品A', '产品型号': 'XJ-001', '数量': 2, '属性': '自研产品', '描述': '这是一个示例产品', '负责人': '张三' },
      { '产品名称': '示例产品B', '产品型号': 'WG-002', '数量': 1, '属性': '外购产品', '描述': '', '负责人': '李四' },
      { '产品名称': '示例产品C', '产品型号': '', '数量': 1, '属性': '自研软件', '描述': '软件产品示例', '负责人': '' },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    // 设置列宽
    ws['!cols'] = [
      { wch: 20 }, // 产品名称
      { wch: 15 }, // 产品型号
      { wch: 8 },  // 数量
      { wch: 12 }, // 属性
      { wch: 30 }, // 描述
      { wch: 12 }, // 负责人
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '产品导入模板');
    XLSX.writeFile(wb, '产品导入模板.xlsx');
  }
};
