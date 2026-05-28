const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { getDb, logAction } = require('../db');
const { ALL_STAGES, getStagesForAttribute } = require('../stages');

// 设置安全的下载文件名 header（支持中文）
function setDownloadHeaders(res, filename) {
  const encoded = encodeURIComponent(filename);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
}

// GET /api/export/projects - 导出所有项目进度为 Excel
router.get('/projects', (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT * FROM projects ORDER BY id').all();

    const rows = [];
    rows.push(['项目ID', '项目名称', '描述', '项目经理', '状态', '开始日期', '结束日期', '产品数', '已完成阶段', '总阶段数', '完成率']);

    for (const p of projects) {
      const products = db.prepare('SELECT id FROM products WHERE project_id = ?').all(p.id);
      let totalStages = 0, doneStages = 0;
      for (const prod of products) {
        const progress = db.prepare('SELECT status FROM product_progress WHERE product_id = ?').all(prod.id);
        totalStages += progress.length;
        doneStages += progress.filter(st => st.status === '已完成').length;
      }
      const rate = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;
      rows.push([p.id, p.name, p.description, p.manager, p.status, p.start_date, p.end_date, products.length, doneStages, totalStages, `${rate}%`]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 }, { wch: 28 }, { wch: 22 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 8 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '项目进度总览');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    setDownloadHeaders(res, `项目进度_${dateStr()}.xlsx`);
    logAction(req.user.id, req.user.username, '导出数据', 'projects', null, '导出项目进度总览');
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('导出项目失败:', e);
    res.status(500).json({ error: '导出失败' });
  }
});

// GET /api/export/products/:projectId - 导出项目下所有产品进度为 Excel
router.get('/products/:projectId', (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const products = db.prepare('SELECT * FROM products WHERE project_id = ? ORDER BY id').all(req.params.projectId);

    const rows = [];
    rows.push([`项目: ${project.name}`, '', `状态: ${project.status}`, `项目经理: ${project.manager || '-'}`, `时间: ${project.start_date || '-'} ~ ${project.end_date || '-'}`]);
    rows.push([]);

    const header = ['产品ID', '产品名称', '属性', '负责人', ...ALL_STAGES, '已完成', '进行中', '未开始', '完成率'];
    rows.push(header);

    for (const prod of products) {
      const progress = db.prepare('SELECT * FROM product_progress WHERE product_id = ? ORDER BY stage_index').all(prod.id);
      const attribute = prod.attribute || '自研产品';
      const productStages = getStagesForAttribute(attribute);
      const stageCount = productStages.length;

      const statuses = ALL_STAGES.map((_, i) => {
        const p = progress.find(pp => pp.stage_index === i);
        return p ? p.status : '-';
      });
      // 仅对属于该产品阶段的进行统计
      let done = 0, active = 0, pending = 0;
      productStages.forEach(idx => {
        const p = progress.find(pp => pp.stage_index === idx);
        if (p && p.status === '已完成') done++;
        else if (p && p.status === '进行中') active++;
        else pending++;
      });
      const rate = stageCount > 0 ? Math.round((done / stageCount) * 100) : 0;
      rows.push([prod.id, prod.name, attribute, prod.person_in_charge || '-', ...statuses, done, active, pending, `${rate}%`]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    const colWidths = [
      { wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 10 },
      ...ALL_STAGES.map(() => ({ wch: 14 })),
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '产品进度明细');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    setDownloadHeaders(res, `产品进度_${project.name}_${dateStr()}.xlsx`);
    logAction(req.user.id, req.user.username, '导出数据', 'products', project.id, `导出项目"${project.name}"产品进度`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('导出产品失败:', e);
    res.status(500).json({ error: '导出失败' });
  }
});

function dateStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = router;
