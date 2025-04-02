document.addEventListener('DOMContentLoaded', async () => {
  // 获取当前登录用户信息
  const currentUser = await window.electronAPI.getCurrentUser();
  if (!currentUser) {
    // 如果没有登录，返回登录页面
    window.electronAPI.navigate('index.html');
    return;
  }

  // 更新用户信息显示
  const username = document.getElementById('username');
  const avatar = document.getElementById('avatar');
  const userInitial = document.getElementById('userInitial');

  username.textContent = currentUser.username;
  userInitial.textContent = currentUser.initial;
  avatar.style.backgroundColor = currentUser.avatarColor;

  // 登出按钮事件
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    window.electronAPI.logout();
  });

  // 创建会议按钮事件
  const createMeetingBtn = document.getElementById('createMeetingBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  createMeetingBtn.addEventListener('click', async () => {
    showLoading("正在创建会议...");

    try {
      const result = await window.electronAPI.createMeeting();

      if (result.success) {
        // 保存会议ID，跳转到会议室页面
        localStorage.setItem('currentMeetingId', result.meetingId);
        window.electronAPI.navigate('room.html');
      } else {
        hideLoading();
        showError('创建会议失败', result.message);
      }
    } catch (error) {
      hideLoading();
      console.error('创建会议出错:', error);
      showError('创建会议错误', '创建会议过程中发生错误，请稍后重试');
    }
  });

  // 加入会议按钮事件
  const joinMeetingBtn = document.getElementById('joinMeetingBtn');
  const meetingIdInput = document.getElementById('meetingIdInput');

  joinMeetingBtn.addEventListener('click', async () => {
    const meetingId = meetingIdInput.value.trim();

    if (!meetingId) {
      showError('输入错误', '请输入会议ID');
      meetingIdInput.focus();
      return;
    }

    showLoading("正在加入会议...");

    try {
      const result = await window.electronAPI.joinMeeting(meetingId);

      if (result.success) {
        // 保存会议ID，跳转到会议室页面
        localStorage.setItem('currentMeetingId', meetingId);
        window.electronAPI.navigate('room.html');
      } else {
        hideLoading();
        showError('加入会议失败', result.message);
      }
    } catch (error) {
      hideLoading();
      console.error('加入会议出错:', error);
      showError('加入会议错误', '加入会议过程中发生错误，请稍后重试');
    }
  });

  // 回车键加入会议
  meetingIdInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      joinMeetingBtn.click();
    }
  });

  // 显示加载状态
  function showLoading(message) {
    loadingText.textContent = message || '正在加载...';
    loadingOverlay.classList.add('active');
  }

  // 隐藏加载状态
  function hideLoading() {
    loadingOverlay.classList.remove('active');
  }

  // 显示错误弹窗 - 添加这个函数来展示更好的错误提示
  function showError(title, message) {
    // 创建错误弹窗
    const errorModalHTML = `
        <div class="error-modal-overlay">
          <div class="error-modal">
            <div class="error-header">
              <h3>${title}</h3>
              <button class="close-error">&times;</button>
            </div>
            <div class="error-body">
              <p>${message}</p>
            </div>
            <div class="error-footer">
              <button class="error-ok-btn">确定</button>
            </div>
          </div>
        </div>
      `;

    // 添加到DOM
    const errorContainer = document.createElement('div');
    errorContainer.innerHTML = errorModalHTML;
    document.body.appendChild(errorContainer);

    // 添加事件监听
    const overlay = document.querySelector('.error-modal-overlay');
    const closeBtn = document.querySelector('.close-error');
    const okBtn = document.querySelector('.error-ok-btn');

    function closeModal() {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(errorContainer);
      }, 300);
    }

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);
  }
});