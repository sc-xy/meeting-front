document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegisterBtn = document.getElementById('showRegister');
  const showLoginBtn = document.getElementById('showLogin');
  const formSlider = document.querySelector('.form-slider');
  
  // 切换到注册表单
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    formSlider.classList.add('show-register');
    setTimeout(() => {
      document.getElementById('regUsername').focus();
    }, 500); // 等待动画完成
  });
  
  // 切换到登录表单
  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    formSlider.classList.remove('show-register');
    setTimeout(() => {
      document.getElementById('username').focus();
    }, 500); // 等待动画完成
  });
  
  // 登录表单提交
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // 显示加载状态
    const loginBtn = document.querySelector('.login-btn');
    const originalBtnText = loginBtn.textContent;
    loginBtn.textContent = '登录中...';
    loginBtn.disabled = true;
    
    try {
      // 调用preload.js中暴露的API进行登录
      const result = await window.electronAPI.login({
        username,
        password
      });
      
      if (result.success) {
        // 登录成功，导航到会议创建/加入页面
        window.electronAPI.navigate('meeting.html');
      } else {
        // 登录失败，显示错误消息
        showNotification('error', '登录失败', result.message || '用户名或密码错误');
        loginBtn.textContent = originalBtnText;
        loginBtn.disabled = false;
      }
    } catch (error) {
      console.error('登录出错:', error);
      showNotification('error', '登录错误', '发生未知错误，请稍后重试');
      loginBtn.textContent = originalBtnText;
      loginBtn.disabled = false;
    }
  });
  
  // 注册表单提交
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    // 简单的密码验证
    if (password !== confirmPassword) {
      showNotification('error', '密码不匹配', '两次输入的密码不一致，请重新输入');
      return;
    }
    
    // 显示加载状态
    const registerBtn = document.querySelector('.register-btn');
    const originalBtnText = registerBtn.textContent;
    registerBtn.textContent = '注册中...';
    registerBtn.disabled = true;
    
    try {
      // 调用preload.js中暴露的API进行注册
      const result = await window.electronAPI.register({
        username,
        password,
        confirmPassword
      });
      
      if (result.success) {
        // 注册成功，显示成功消息并切换到登录表单
        showNotification('success', '注册成功', '您的账号已创建，请登录');
        
        // 切换到登录表单并自动填充用户名
        formSlider.classList.remove('show-register');
        document.getElementById('username').value = username;
        document.getElementById('password').value = '';
        
        setTimeout(() => {
          document.getElementById('password').focus();
        }, 500); // 等待动画完成
      } else {
        // 注册失败
        showNotification('error', '注册失败', result.message || '注册失败，请稍后重试');
      }
    } catch (error) {
      console.error('注册出错:', error);
      showNotification('error', '注册错误', '发生未知错误，请稍后重试');
    } finally {
      registerBtn.textContent = originalBtnText;
      registerBtn.disabled = false;
    }
  });
  
  // 显示通知消息
  function showNotification(type, title, message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
      <div class="notification-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
      <button class="notification-close">×</button>
    `;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 添加动画类
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 设置自动关闭
    const timeout = setTimeout(() => {
      closeNotification(notification);
    }, 5000);
    
    // 添加关闭按钮事件
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      clearTimeout(timeout);
      closeNotification(notification);
    });
  }
  
  // 关闭通知
  function closeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300); // 等待淡出动画完成
  }
});

