// 甘特图组件 - 自适应版本
const Gantt = {
  _resizeObservers: {},

  // 渲染项目甘特图
  renderProjectGantt(projects, containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const doRender = () => {
      this._renderProjectGanttImpl(projects, container);
    };

    // 清理旧的 observer
    if (this._resizeObservers[containerId]) {
      this._resizeObservers[containerId].disconnect();
    }

    // 初始渲染
    doRender();

    // 监听容器大小变化，重新渲染
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        // 去抖动
        clearTimeout(this._resizeTimers && this._resizeTimers[containerId]);
        if (!this._resizeTimers) this._resizeTimers = {};
        this._resizeTimers[containerId] = setTimeout(() => doRender(), 150);
      });
      observer.observe(container);
      this._resizeObservers[containerId] = observer;
    }
  },

  _renderProjectGanttImpl(projects, container) {
    if (!projects || projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>暂无项目数据</p></div>';
      return;
    }

    // 获取容器可用宽度
    const labelW = Math.max(120, Math.min(180, container.clientWidth * 0.15));
    const availW = Math.max(400, container.clientWidth - labelW - 20);

    // 计算时间范围
    const dates = [];
    projects.forEach(p => {
      if (p.start_date) dates.push(new Date(p.start_date));
      if (p.end_date) dates.push(new Date(p.end_date));
    });

    if (dates.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>项目缺少日期信息</p></div>';
      return;
    }

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 1);

    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const totalMonths = Math.ceil(totalDays / 30);

    // 按月份分组，动态计算每列宽度
    const months = [];
    let current = new Date(minDate);
    while (current <= maxDate) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      if (!months.find(m => m.key === key)) {
        months.push({
          key,
          label: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
          days: 0
        });
      }
      months[months.length - 1].days++;
      current.setDate(current.getDate() + 1);
    }

    // 动态列宽：总可用宽度 / 总月数（保证填满）
    const colWidthPerDay = availW / totalDays;
    const colWidthPerMonth = availW / totalMonths;

    // 生成月头
    let headerHtml = `<div class="gantt-header"><div class="gantt-label" style="width:${labelW}px;flex-shrink:0;"></div>`;
    months.forEach(m => {
      const w = m.days * colWidthPerDay;
      headerHtml += `<div class="gantt-header-cell" style="width:${Math.max(40, w)}px;flex-shrink:0;">${m.label}</div>`;
    });
    headerHtml += '</div>';

    // 生成项目行
    let rowsHtml = '';
    projects.forEach((p) => {
      rowsHtml += `
        <div class="gantt-row" data-id="${p.id}" onclick="Gantt.selectProject(${p.id}, this)">
          <div class="gantt-label" style="width:${labelW}px;" title="${p.name}">${p.name}</div>
          <div class="gantt-bars" style="min-width:${availW}px;">
            ${months.map(m => {
              const w = m.days * colWidthPerDay;
              return `<div class="gantt-cell" style="width:${Math.max(40, w)}px;flex-shrink:0;"></div>`;
            }).join('')}
          </div>
        </div>`;
    });

    container.innerHTML = `
      <div class="gantt-container">
        <div class="gantt-chart" style="min-width:${labelW + availW}px;">
          ${headerHtml}
          ${rowsHtml}
        </div>
      </div>`;

    // 延迟添加甘特条
    requestAnimationFrame(() => {
      projects.forEach(p => {
        const start = p.start_date ? new Date(p.start_date) : minDate;
        const end = p.end_date ? new Date(p.end_date) : maxDate;
        const leftDays = Math.max(0, Math.ceil((start - minDate) / (1000 * 60 * 60 * 24)));
        const barDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

        let barColor = 'blue';
        if (p.status === '已验收') barColor = 'green';
        else if (p.status === '进行中') barColor = 'blue';
        else if (p.status === '已立项') barColor = 'yellow';
        else barColor = 'red';

        const row = container.querySelector(`.gantt-row[data-id="${p.id}"]`);
        if (row) {
          const barsContainer = row.querySelector('.gantt-bars');
          if (barsContainer) {
            barsContainer.style.position = 'relative';
            const bar = document.createElement('div');
            bar.className = `gantt-bar ${barColor}`;
            bar.style.left = (leftDays * colWidthPerDay) + 'px';
            bar.style.width = Math.max(20, barDays * colWidthPerDay) + 'px';
            bar.textContent = barDays * colWidthPerDay > 60 ? p.name : '';
            bar.title = `${p.name}\n${p.start_date || '-'} ~ ${p.end_date || '-'}\n状态: ${p.status}`;
            barsContainer.appendChild(bar);

            // 恢复选中状态
            if (Gantt.selectedProjectId === p.id) {
              row.classList.add('selected');
            }
          }
        }
      });
    });
  },

  selectedProjectId: null,

  selectProject(id, rowEl) {
    const container = rowEl ? rowEl.closest('.gantt-container') || rowEl.parentElement.parentElement : null;
    if (container) {
      container.querySelectorAll('.gantt-row').forEach(r => r.classList.remove('selected'));
    }
    if (rowEl) rowEl.classList.add('selected');
    this.selectedProjectId = id;
    if (typeof window.onGanttProjectSelect === 'function') {
      window.onGanttProjectSelect(id);
    }
  },

  // 渲染产品进度甘特图
  renderProductProgress(productsWithProgress, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const doRender = () => {
      this._renderProductProgressImpl(productsWithProgress, container);
    };

    if (this._resizeObservers[containerId]) {
      this._resizeObservers[containerId].disconnect();
    }

    doRender();

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        clearTimeout(this._resizeTimers && this._resizeTimers[containerId]);
        if (!this._resizeTimers) this._resizeTimers = {};
        this._resizeTimers[containerId] = setTimeout(() => doRender(), 150);
      });
      observer.observe(container);
      this._resizeObservers[containerId] = observer;
    }
  },

  _renderProductProgressImpl(productsWithProgress, container) {
    if (!productsWithProgress || productsWithProgress.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>请先选择项目查看产品进度</p></div>';
      return;
    }

    const ALL_STAGES = [
      '图纸受控\nBOM确认', '烧录程序\n发布', '初样确认\n(可选)', '物料采购\n成品采购',
      '工艺受控', '正样确认', '生产组装', '应用程序\n发布',
      '配置升级', '成品检验', '打包发货'
    ];

    const labelW = Math.max(100, Math.min(140, container.clientWidth * 0.13));
    const availW = Math.max(300, container.clientWidth - labelW - 10);
    const cellW = Math.max(14, Math.min(60, availW / ALL_STAGES.length));

    let html = '<div style="display:flex;flex-direction:column;height:100%;">';

    // 固定顶部表头行
    html += `<div style="flex-shrink:0;overflow-x:hidden;border-bottom:2px solid var(--gray-300);padding-bottom:4px;background:#fff;">`;
    html += `<div style="display:flex;">`;
    html += `<div style="width:${labelW}px;flex-shrink:0;padding:2px 8px;"></div>`;
    ALL_STAGES.forEach(s => {
      html += `<div style="width:${cellW}px;flex-shrink:0;text-align:center;font-size:9px;white-space:pre-line;line-height:1.3;color:var(--gray-500);padding:0 1px;">${s}</div>`;
    });
    html += `</div></div>`;

    // 可滚动产品列表
    html += '<div class="pp-body-scroll" style="flex:1;min-height:0;overflow:auto;">';

    // 产品行
    productsWithProgress.forEach(item => {
      const attr = item.product.attribute || '自研产品';
      const attrEmoji = attr === '外购产品' ? '🛒' : attr === '自研软件' ? '💻' : '🔬';

      html += `<div style="display:flex;align-items:center;margin-bottom:2px;">`;
      html += `<div class="progress-gantt-label" style="width:${labelW}px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.product.name}">
        ${attrEmoji} ${item.product.name}
      </div>`;
      html += '<div style="flex:1;display:flex;">';

      // 11列统一渲染
      for (let i = 0; i < ALL_STAGES.length; i++) {
        const prog = item.progress.find(p => p.stage_index === i);
        if (prog) {
          // 跳过"不需要"的阶段，不显示
          if (prog.status === '不需要') {
            html += `<div class="progress-cell" style="width:${cellW}px;flex-shrink:0;" title="${prog.stage_name}: 不需要"></div>`;
          } else {
            let dotClass = 'pending';
            let bg = '';
            let isOverdue = false;
            if (prog.status === '已完成') { dotClass = 'done'; bg = 'background:#dcfce7;'; }
            else if (prog.status === '进行中') {
              // 判断进行中阶段是否超期
              if (prog.planned_end) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const plannedEnd = new Date(prog.planned_end);
                isOverdue = plannedEnd < today;
              }
              if (isOverdue) {
                dotClass = 'overdue';
                bg = 'background:#fef2f2;';
              } else {
                dotClass = 'active';
                bg = 'background:#eff6ff;';
              }
            }
            const titleText = isOverdue
              ? `${prog.stage_name}: ${prog.status} (已超期，计划结束: ${prog.planned_end || '-'})`
              : `${prog.stage_name}: ${prog.status}`;
            html += `<div class="progress-cell" style="${bg}width:${cellW}px;flex-shrink:0;" title="${titleText}">
              <div class="progress-dot ${dotClass}"></div>
            </div>`;
          }
        } else {
          html += `<div class="progress-cell" style="width:${cellW}px;flex-shrink:0;" title="该产品无此阶段"></div>`;
        }
      }

      html += '</div></div>';
    });

    html += '</div></div>';

    container.innerHTML = html;

    // 同步横向滚动
    const bodyEl = container.querySelector('.pp-body-scroll');
    const headerEl = container.querySelector('div[style*="overflow-x:hidden"]');
    if (bodyEl && headerEl) {
      bodyEl.addEventListener('scroll', () => {
        headerEl.scrollLeft = bodyEl.scrollLeft;
      });
    }
  },

  // 渲染项目报表
  renderReport(productsWithProgress, containerId, projectName, cardHeaderId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!productsWithProgress || productsWithProgress.length === 0) {
      if (cardHeaderId) document.getElementById(cardHeaderId).innerHTML = '<span class="card-title">📊 项目详情</span>';
      container.innerHTML = '<div class="empty-state"><div class="icon">📈</div><p>请先选择项目查看报表</p></div>';
      return;
    }

    // 项目总体概览 - 排除"不需要"的阶段
    let totalStages = 0, totalDone = 0;
    productsWithProgress.forEach(item => {
      const validProgress = item.progress.filter(p => p.status !== '不需要');
      totalStages += validProgress.length;
      totalDone += validProgress.filter(p => p.status === '已完成').length;
    });
    const overallPct = totalStages > 0 ? Math.round((totalDone / totalStages) * 100) : 0;
    const pjTitle = projectName ? `${projectName}项目总体进度` : '项目总体进度';

    // 将总体进度放入卡片标题栏
    if (cardHeaderId) {
      const headerEl = document.getElementById(cardHeaderId);
      if (headerEl) {
        headerEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;">
            <span class="card-title">📊 ${pjTitle}</span>
            <div style="flex:1;min-width:100px;display:flex;align-items:center;gap:8px;">
              <div class="pc-progress-bar" style="flex:1;height:8px;border-radius:4px;"><div class="pc-progress-fill" style="width:${overallPct}%;height:8px;border-radius:4px;"></div></div>
              <span style="font-weight:700;font-size:14px;color:var(--primary);white-space:nowrap;">${overallPct}%</span>
            </div>
          </div>`;
      }
    }

    let html = '<div style="overflow-y:auto;height:100%;">';

    productsWithProgress.forEach(item => {
      const attr = item.product.attribute || '自研产品';
      // 过滤掉"不需要"的阶段
      const validProgress = item.progress.filter(p => p.status !== '不需要');
      const total = validProgress.length;
      const done = validProgress.filter(p => p.status === '已完成').length;
      const active = validProgress.filter(p => p.status === '进行中').length;
      const notNeeded = item.progress.filter(p => p.status === '不需要').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      html += `
        <div style="margin-bottom:clamp(12px,2vh,20px);padding-bottom:clamp(8px,1.5vh,16px);border-bottom:1px solid var(--gray-200);">
          <div style="font-weight:600;margin-bottom:6px;">📦 ${item.product.name} <span class="tag tag-green" style="font-size:10px;">${attr}</span></div>
          <div style="font-size:clamp(10px,0.7vw,12px);color:var(--gray-500);margin-bottom:4px;">负责人: ${item.product.person_in_charge || '-'}</div>
          <div class="pc-progress-bar"><div class="pc-progress-fill" style="width:${pct}%"></div></div>
          <div class="pc-progress-text"><span>已完成 ${done}/${total} 阶段${notNeeded > 0 ? ` (不含${notNeeded}个不需要)` : ''}</span><span>${pct}%</span></div>
          <div style="margin-top:6px;display:flex;gap:clamp(6px,1vw,12px);font-size:clamp(10px,0.7vw,12px);flex-wrap:wrap;">
            <span style="color:var(--success);">✅ 已完成: ${done}</span>
            <span style="color:var(--primary);">🔄 进行中: ${active}</span>
            <span style="color:var(--gray-400);">⏳ 未开始: ${total - done - active}</span>
            ${notNeeded > 0 ? '<span style="color:var(--gray-400);">❌ 不需要: ' + notNeeded + '</span>' : ''}
          </div>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  // 清理所有 observer
  destroy() {
    Object.values(this._resizeObservers).forEach(o => o.disconnect());
    this._resizeObservers = {};
    if (this._resizeTimers) {
      Object.values(this._resizeTimers).forEach(t => clearTimeout(t));
      this._resizeTimers = {};
    }
  },

  // 清理特定容器的 observer
  destroyContainer(containerId) {
    if (this._resizeObservers[containerId]) {
      this._resizeObservers[containerId].disconnect();
      delete this._resizeObservers[containerId];
    }
  }
};

// 全局 resize 清理（页面切换时调用）
window.addEventListener('resize', () => {
  // ResizeObserver 会自动处理，这里是兜底
});
