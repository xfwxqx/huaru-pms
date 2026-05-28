// API 服务封装
const API = {
  base: '/api',
  token: null,

  setToken(token) {
    this.token = token;
    localStorage.setItem('huruo_token', token);
  },

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('huruo_token');
    }
    return this.token;
  },

  clearToken() {
    this.token = null;
    localStorage.removeItem('huruo_token');
  },

  async request(method, url, data = null) {
    const MAX_RETRIES = 10;
    const TIMEOUT = 5000; // 5秒超时
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const headers = { 'Content-Type': 'application/json' };
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);

      try {
        const opts = { method, headers, signal: controller.signal };
        if (data && method !== 'GET') {
          opts.body = JSON.stringify(data);
        }

        // GET请求添加时间戳防止浏览器缓存
        let fetchUrl = this.base + url;
        if (method === 'GET') {
          const separator = url.includes('?') ? '&' : '?';
          fetchUrl += `${separator}_t=${Date.now()}`;
        }

        const res = await fetch(fetchUrl, opts);

        // 先检查状态码，再解析 JSON
        if (!res.ok) {
          let msg = `请求失败 (${res.status})`;
          try {
            const errJson = await res.json();
            msg = errJson.error || msg;
          } catch (_) {
            msg = `${msg} - 服务器返回异常，请刷新页面重试`;
          }
          if (res.status === 401) {
            this.clearToken();
            App && App.navigate && App.navigate('login');
          }
          throw new Error(msg);
        }

        return res.json();
      } catch (e) {
        lastError = e;
        // 只对超时和网络错误重试，HTTP错误直接抛出
        const isRetryable = e.name === 'AbortError' || e.name === 'TypeError';
        if (!isRetryable || attempt === MAX_RETRIES) break;
        
        // 指数退避: 100ms, 200ms, 400ms, ...
        const delay = Math.min(100 * Math.pow(2, attempt), 2000);
        await new Promise(r => setTimeout(r, delay));
      } finally {
        clearTimeout(timer);
      }
    }

    // 所有重试耗尽
    if (lastError && lastError.name === 'AbortError') {
      throw new Error('请求超时，已重试10次仍失败，请检查网络后重试');
    }
    throw lastError || new Error('请求失败');
  },

  get(url) { return this.request('GET', url); },
  post(url, data) { return this.request('POST', url, data); },
  put(url, data) { return this.request('PUT', url, data); },
  delete(url) { return this.request('DELETE', url); },

  // Auth（路径不带 /api 前缀，因为 this.base 已有）
  login(username, password) { return this.post('/auth/login', { username, password }); },
  register(username, password) { return this.post('/auth/register', { username, password }); },
  getMe() { return this.get('/auth/me'); },
  getConfig() { return this.get('/config'); },
  getUsers() { return this.get('/auth/users'); },
  createUser(data) { return this.post('/auth/users', data); },
  updateUserRole(id, role) { return this.put(`/auth/users/${id}`, { role }); },
  resetUserPassword(id, password) { return this.put(`/auth/users/${id}`, { password }); },
  deleteUser(id) { return this.delete(`/auth/users/${id}`); },

  // Logs
  getLogs(page, limit, params = {}) {
    const query = new URLSearchParams();
    query.set('page', page || 1);
    query.set('limit', limit || 50);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.username) query.set('username', params.username);
    if (params.action) query.set('action', params.action);
    return this.get(`/logs?${query.toString()}`);
  },
  getLogUsers() { return this.get('/logs/users'); },
  getLogActions() { return this.get('/logs/actions'); },

  // Projects
  getProjects() { return this.get('/projects'); },
  getProject(id) { return this.get(`/projects/${id}`); },
  createProject(data) { return this.post('/projects', data); },
  updateProject(id, data) { return this.put(`/projects/${id}`, data); },
  deleteProject(id) { return this.delete(`/projects/${id}`); },

  // Products
  getProducts(projectId) { return this.get(`/products?project_id=${projectId}`); },
  createProduct(data) { return this.post('/products', data); },
  updateProduct(id, data) { return this.put(`/products/${id}`, data); },
  deleteProduct(id) { return this.delete(`/products/${id}`); },
  importProducts(projectId, fileDataBase64) { return this.post('/products/import', { project_id: projectId, file_data: fileDataBase64 }); },

  // Progress
  getProgress(productId) { return this.get(`/progress/${productId}`); },
  updateProgress(id, data) { return this.put(`/progress/${id}`, data); },
  batchUpdateProgress(data) { return this.post('/progress/batch', data); },
  getProjectProgress(projectId) { return this.get(`/progress/project/${projectId}`); },
  getWarnings(params = {}) {
    const query = new URLSearchParams();
    if (params.project_id) query.set('project_id', params.project_id);
    if (params.product_id) query.set('product_id', params.product_id);
    const qs = query.toString();
    return this.get(`/progress/warnings/all${qs ? '?' + qs : ''}`);
  },

  // Export - 下载 Excel 文件
  async downloadFile(url) {
    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(this.base + url, { headers });
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    // 解析 RFC 5987 filename*=UTF-8''encoded 格式
    const disposition = res.headers.get('Content-Disposition') || '';
    const starMatch = disposition.match(/filename\*=UTF-8''(.+)$/);
    let filename = starMatch ? decodeURIComponent(starMatch[1]) : 'export.xlsx';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  exportProjects() { return this.downloadFile('/export/projects'); },
  exportProducts(projectId) { return this.downloadFile(`/export/products/${projectId}`); },
};
