# 华如防务项目管理系统

一个轻量级、高性能的项目进度管理系统，专为研发团队设计，支持多项目、多产品的进度跟踪与协作。

## 功能特性

### 核心功能
- **用户认证**：基于 JWT 的身份验证，支持多角色权限控制（系统管理员、项目总监、项目经理、项目成员）
- **项目管理**：项目的创建、编辑、删除，支持项目时间线和状态管理
- **产品管理**：产品信息维护，支持三种产品属性（自研产品、外购产品、自研软件）
- **进度跟踪**：11 阶段进度管理，根据产品属性自动生成对应阶段

### 特色功能
- **甘特图展示**：项目级和产品级进度可视化，支持阶段状态一目了然
- **批量编辑**：多产品、多阶段独立编辑，提升操作效率
- **Excel 导入**：批量导入产品数据，支持中英文表头
- **Excel 导出**：项目进度、产品列表一键导出
- **超期预警**：进行中阶段超期自动标红提醒
- **产品筛选**：实时搜索过滤产品列表
- **操作日志**：完整的操作记录，支持按时间、用户、操作类型查询
- **测试看板**：测试记录数据管理，支持数据可视化、筛选联动、文件缓存、Word报告导出

### 技术亮点
- **内存缓存**：DataStore + 请求级缓存，多用户读取性能提升 5-7 倍
- **定时同步**：脏标记 + 定时写入，减少 IO 开销
- **原子写入**：tmp + rename 模式，防止数据库损坏
- **请求重试**：5s 超时 + 指数退避重试，提升网络容错性

## 技术栈

| 类别 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | sql.js（SQLite WASM） |
| 认证 | JWT + bcryptjs |
| Excel | SheetJS (xlsx) |
| Word | docx (docx-js) |
| 前端 | 原生 JavaScript + CSS |
| 架构 | SPA（单页应用） |

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装运行

```bash
# 克隆仓库
git clone https://github.com/xfwxqx/huaru-pms.git
cd huruo-pms

# 安装依赖
npm install

# 启动服务
npm start
```

服务默认运行在 `http://localhost:3456`

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | admin123 |

> 首次登录后请及时修改密码

## 项目结构

```
huruo-pms/
├── server.js           # 服务入口
├── db.js               # 数据库封装 + 同步管理
├── data-store.js       # 内存数据存储
├── cache.js            # 请求缓存中间件
├── stages.js           # 产品阶段定义
├── config.js           # 配置文件解析
├── config.ini          # 用户配置（数据库路径等）
├── routes/             # API 路由
│   ├── auth.js         # 认证相关
│   ├── projects.js     # 项目管理
│   ├── products.js     # 产品管理
│   ├── progress.js     # 进度管理
│   ├── users.js        # 用户管理
│   └── logs.js         # 操作日志
├── middleware/         # 中间件
│   └── auth.js         # JWT 验证
├── public/             # 前端静态资源
│   ├── index.html      # SPA 入口
│   ├── css/            # 样式文件
│   └── js/
│       ├── api.js      # API 封装
│       ├── app.js      # 应用入口
│       ├── components/ # 组件
│       └── pages/      # 页面模块
└── public/templates/   # Excel 模板
```

## 产品阶段定义

系统支持 11 个标准阶段，根据产品属性自动分配：

| 阶段序号 | 阶段名称 | 自研产品 | 外购产品 | 自研软件 |
|:--------:|----------|:--------:|:--------:|:--------:|
| 0 | 图纸受控与BOM确认 | ✅ | ✅ | ✅ |
| 1 | 烧录程序发布 | ✅ | - | - |
| 2 | 初样确认 | ✅ | ✅* | - |
| 3 | 物料采购/成品采购 | ✅ | ✅ | - |
| 4 | 工艺受控 | ✅ | - | - |
| 5 | 正样确认 | ✅ | - | - |
| 6 | 生产组装 | ✅ | - | - |
| 7 | 应用程序发布 | ✅ | - | ✅ |
| 8 | 配置升级 | ✅ | - | - |
| 9 | 成品检验 | ✅ | ✅ | ✅ |
| 10 | 打包发货 | ✅ | ✅ | ✅ |

> *初样确认为可选阶段

## API 概览

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 项目
- `GET /api/projects` - 获取项目列表
- `GET /api/projects/:id` - 获取项目详情（含产品列表）
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### 产品
- `GET /api/products` - 获取产品列表
- `POST /api/products` - 创建产品
- `POST /api/products/import` - 批量导入产品
- `PUT /api/products/:id` - 更新产品
- `DELETE /api/products/:id` - 删除产品

### 进度
- `GET /api/progress` - 获取进度列表
- `PUT /api/progress/:id` - 更新进度
- `POST /api/progress/batch` - 批量更新进度

### 测试记录
- `GET /api/test-records/latest` - 获取最新缓存的测试数据
- `POST /api/test-records/upload` - 上传并缓存测试数据文件
- `GET /api/test-records/files` - 获取缓存文件列表
- `DELETE /api/test-records/files/:name` - 删除指定缓存文件
- `POST /api/test-records/export-report` - 导出Word分析报告

## 配置说明

编辑 `config.ini` 文件：

```ini
[server]
port = 3456

[database]
; 可自定义数据库文件路径
db_path = ./data.db

[jwt]
secret = your-jwt-secret-key
expires_in = 24h
```

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
