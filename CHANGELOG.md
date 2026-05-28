# 更新日志

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
