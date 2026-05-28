# 更新日志

## v0.4 (2026-05-28)

### 新增功能

#### 1. 测试看板页 - 测试记录数据管理
**文件**: `public/js/pages/test-dashboard.js`, `routes/test-records.js`, `server.js`

- 新增测试看板页面，用于展示和管理测试记录数据
- **统计数据概览**：测试记录总数、项目数、产品数、版本数、BUG总数、平均测试时长
- **数据可视化图表**：
  - BUG等级分布 - 饼图（严重/重要/轻微/建议）
  - 项目测试统计 - 柱状图（测试项 vs BUG数 vs 版本数）
  - 测试人员工作量 - 横向柱状图
  - 月度测试趋势 - 折线图（带面积填充）
- **数据导入导出**：
  - 支持导入 Excel (.xlsx/.xls) 和 JSON 格式文件
  - 导入文件自动缓存到服务器
  - 导出测试报告为 JSON 格式
- **智能筛选联动**：
  - 支持按项目、产品、测试人员、时间范围筛选
  - 筛选项联动更新：选择任意条件后，其他选项自动过滤为符合条件的值
  - 日期范围自动更新为当前筛选结果的时间区间
- **日期格式兼容**：支持多种 Excel 日期格式（M/D/YY、YYYY-MM-DD 等）自动转换

```javascript
// 测试看板 API
GET  /api/test-records/latest  // 获取最新缓存数据
POST /api/test-records/upload   // 上传并缓存文件
GET  /api/test-records/files    // 获取缓存文件列表
DELETE /api/test-records/files/:name  // 删除缓存文件
```

#### 2. 测试记录文件缓存
**文件**: `routes/test-records.js`, `cache/test-records/`

- 导入 Excel 文件后自动缓存到服务器
- 只保留最新导入的1个文件，新导入时自动删除旧文件
- 页面加载时自动从服务器获取最新缓存数据
- 缓存位置：`cache/test-records/`

### 问题修复

#### 3. 筛选项联动逻辑 - 选择测试人员后项目和产品被重置
**文件**: `public/js/pages/test-dashboard.js`

**问题描述**: 选择项目后再选择测试人员时，项目和产品筛选框被错误重置。

**修复内容**: 重写筛选联动逻辑，计算三个条件的交集，正确更新各下拉选项并保留当前选中值。

```javascript
// 修复后的联动逻辑
_onFilterChange: function(changedEl) {
  // 计算项目+测试人员的交集，用于更新产品选项
  var dataForProduct = baseData.filter(function(d) {
    if (project && d.项目 !== project) return false;
    if (tester && d.测试人员 !== tester) return false;
    return true;
  });
  // ... 更新所有下拉框，保留当前选中值
}
```

#### 4. Excel 日期格式解析 - M/D/YY 格式显示异常
**文件**: `public/js/pages/test-dashboard.js`

**问题描述**: 导入 Excel 文件后，日期显示为 "1/6/26" 格式而非 "2026-01-06"。

**修复内容**: 增强日期解析函数，支持 M/D/YY、M/D/YYYY 等多种 Excel 常见格式。

```javascript
// 新增格式支持
_dateShort: function(d) {
  // M/D/YY 或 M/D/YYYY（Excel常见格式）
  var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    var year = m[3].length === 2 ? (Number(m[3]) < 50 ? '20' + m[3] : '19' + m[3]) : m[3];
    return year + '-' + String(m[1]).padStart(2,'0') + '-' + String(m[2]).padStart(2,'0');
  }
}
```

#### 5. 月度测试趋势无数据 - 日期提取逻辑错误
**文件**: `public/js/pages/test-dashboard.js`

**问题描述**: 月度测试趋势图表无法显示数据，尽管数据中存在版本发布时间。

**修复内容**: 改进月度趋势图的日期提取逻辑，支持 Excel 日期序列号和多种日期格式。

---

## v0.3 (2026-05-27)

### 功能优化

#### 1. 批量导入产品 - Excel 文件批量导入
**文件**: `routes/products.js`, `public/js/api.js`, `public/js/pages/projects.js`, `public/index.html`, `public/templates/产品导入模板.xlsx`

- 新增 `POST /api/products/import` 后端接口，接收 base64 编码的 Excel 文件
- 使用 SheetJS（`xlsx`）解析 Excel，支持 .xlsx 和 .xls 格式
- 支持中英文表头自动映射（产品名称/型号/数量/属性/描述/负责人）
- 数据校验：产品名称必填、属性可选值（自研产品/外购产品/自研软件）、数量正整数
- 批量创建：事务内批量插入产品及对应的进度阶段，自动更新内存缓存
- 前端产品列表新增"📥 批量导入"按钮和导入弹窗
- 弹窗内提供"下载示例模板"链接，浏览器端动态生成 Excel 文件
- 权限控制：仅系统管理员/项目总监/项目经理可用

```javascript
// 前端 API 调用
API.importProducts(projectId, fileDataBase64);

// Excel 表头格式
产品名称* | 产品型号 | 数量 | 属性 | 描述 | 负责人
属性可选值：自研产品、外购产品、自研软件（默认：自研产品）
```

#### 2. 进度展示页 - 超期阶段颜色警示
**文件**: `public/js/components/gantt.js`, `public/css/style.css`

- 产品进度列表中，进行中阶段增加超期判断
- 当阶段状态为"进行中"且 `planned_end` 已过期（计划结束日期 < 今天）时：
  - 小圆球颜色从蓝色变为红色
  - 背景色从浅蓝变为浅红
  - 鼠标悬停提示显示"已超期，计划结束: xxx"

```javascript
// 判断进行中阶段是否超期
if (prog.planned_end) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plannedEnd = new Date(prog.planned_end);
  isOverdue = plannedEnd < today;
}
```

### 问题修复

#### 3. 产品属性修改后刷新不更新 - 数据存储ID类型不匹配
**文件**: `routes/products.js`, `routes/projects.js`, `data-store.js`

**问题描述**: 修改产品属性后提示成功，但刷新页面后显示仍是旧数据。

**根本原因**: `req.params.id` 是字符串类型，而 `dataStore` 的 Map 使用整数类型作为 key，导致内存中的数据未正确更新。

**修复内容**:
- `routes/products.js`: `dataStore.updateProduct()` 和 `dataStore.deleteProduct()` 调用时添加 `parseInt()`
- `routes/projects.js`: `dataStore.updateProject()` 和 `dataStore.deleteProject()` 调用时添加 `parseInt()`

```javascript
// 修复前
dataStore.updateProduct(req.params.id, product);

// 修复后
dataStore.updateProduct(parseInt(req.params.id), product);
```

#### 4. 产品属性修改后刷新不更新 - 缓存清除不完整
**文件**: `cache.js`, `routes/products.js`

**问题描述**: 产品列表通过 `GET /api/projects/:id` 获取，但修改产品时只清除了 `/api/products` 的缓存。

**修复内容**:
- 增强 `clearCacheMiddleware()` 支持数组参数，可同时清除多个缓存模式
- 产品相关的 POST/PUT/DELETE 路由同时清除 `/api/products` 和 `/api/projects` 的缓存

```javascript
// 修复前
router.put('/:id', clearCacheMiddleware('/api/products'), ...);

// 修复后
router.put('/:id', clearCacheMiddleware(['/api/products', '/api/projects']), ...);
```

#### 5. 产品属性修改后刷新不更新 - 浏览器缓存
**文件**: `public/js/api.js`

**修复内容**: 为 GET 请求添加时间戳参数，防止浏览器缓存响应

```javascript
// GET请求添加时间戳防止浏览器缓存
if (method === 'GET') {
  const separator = url.includes('?') ? '&' : '?';
  fetchUrl += `${separator}_t=${Date.now()}`;
}
```

---

## 历史版本

*(后续版本记录将追加于此)*
