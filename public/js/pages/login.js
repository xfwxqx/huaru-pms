// 登录页
const LoginPage = {
  render() {
    const savedUser = localStorage.getItem('huruo_last_user') || '';
    return `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">
            <span class="icon">🛡️</span>
            <h1>华如防务项目管理系统</h1>
            <p>Huaru Defense Project Management System</p>
          </div>

          <div id="login-tabs" style="display:flex;margin-bottom:24px;border-bottom:2px solid var(--gray-200);">
            <button class="btn btn-ghost login-tab active" data-tab="login" style="flex:1;border-bottom:2px solid var(--primary);margin-bottom:-2px;border-radius:0;font-weight:600;">登 录</button>
            <button class="btn btn-ghost login-tab" data-tab="register" style="flex:1;border-radius:0;">注 册</button>
          </div>

          <div id="login-form">
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" id="login-username" placeholder="请输入用户名" value="${savedUser}" autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="login-password" placeholder="请输入密码" autocomplete="current-password">
            </div>
            <div class="login-remember mb-16">
              <input type="checkbox" id="login-remember" ${savedUser ? 'checked' : ''}>
              <span>记住用户名</span>
            </div>
            <button class="btn btn-primary w-full btn-lg" id="login-submit-btn">登 录</button>
          </div>

          <div id="register-form" style="display:none;">
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" id="reg-username" placeholder="请输入用户名（至少2位）">
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="reg-password" placeholder="请输入密码（至少4位）">
            </div>
            <div class="form-group">
              <label class="form-label">确认密码</label>
              <input type="password" class="form-input" id="reg-password2" placeholder="请再次输入密码">
            </div>
            <div class="text-sm text-muted mb-12">注册默认角色为"项目组成员"，如需其他角色请联系管理员</div>
            <button class="btn btn-success w-full btn-lg" id="register-submit-btn">注 册</button>
          </div>

          <div id="login-error" class="form-error text-center mt-12" style="display:none;"></div>
        </div>
      </div>`;
  },

  mount() {
    // Tab 切换
    document.querySelectorAll('.login-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.login-tab').forEach(t => {
          t.classList.remove('active');
          t.style.borderBottom = 'none';
          t.style.fontWeight = 'normal';
        });
        this.classList.add('active');
        this.style.borderBottom = '2px solid var(--primary)';
        this.style.fontWeight = '600';

        const isLogin = this.dataset.tab === 'login';
        document.getElementById('login-form').style.display = isLogin ? 'block' : 'none';
        document.getElementById('register-form').style.display = isLogin ? 'none' : 'block';
        document.getElementById('login-error').style.display = 'none';
      });
    });

    const showError = (msg) => {
      const el = document.getElementById('login-error');
      el.textContent = msg;
      el.style.display = 'block';
    };

    // 登录
    document.getElementById('login-submit-btn').addEventListener('click', async () => {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      if (!username || !password) return showError('请输入用户名和密码');

      const btn = document.getElementById('login-submit-btn');
      btn.disabled = true;
      btn.textContent = '登录中...';

      try {
        const res = await API.login(username, password);
        API.setToken(res.token);
        // 记住用户名
        if (document.getElementById('login-remember').checked) {
          localStorage.setItem('huruo_last_user', username);
        } else {
          localStorage.removeItem('huruo_last_user');
        }
        App.setUser(res.user);
        App.navigate('home');
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
        btn.textContent = '登 录';
      }
    });

    // 回车登录
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('login-submit-btn').click();
    });

    // 注册
    document.getElementById('register-submit-btn').addEventListener('click', async () => {
      const username = document.getElementById('reg-username').value.trim();
      const password = document.getElementById('reg-password').value;
      const password2 = document.getElementById('reg-password2').value;

      if (!username || !password) return showError('请填写所有字段');
      if (username.length < 2) return showError('用户名至少2位');
      if (password.length < 4) return showError('密码至少4位');
      if (password !== password2) return showError('两次密码不一致');

      const btn = document.getElementById('register-submit-btn');
      btn.disabled = true;
      btn.textContent = '注册中...';

      try {
        const res = await API.register(username, password);
        API.setToken(res.token);
        localStorage.setItem('huruo_last_user', username);
        App.setUser(res.user);
        App.navigate('home');
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
        btn.textContent = '注 册';
      }
    });
  }
};
