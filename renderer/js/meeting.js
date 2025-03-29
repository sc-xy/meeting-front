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
    createMeetingBtn.addEventListener('click', async () => {
      showLoading("正在创建会议...");
      
      try {
        const result = await window.electronAPI.createMeeting();
        
        if (result.success) {
          // 保存会议ID，跳转到会议室页面
          localStorage.setItem('currentMeetingId', result.meetingId);
          localStorage.setItem('isMeetingHost', 'true');
          window.electronAPI.navigate('room.html');
        } else {
          hideLoading();
          alert('创建会议失败: ' + result.message);
        }
      } catch (error) {
        hideLoading();
        console.error('创建会议出错:', error);
        alert('创建会议过程中发生错误，请稍后重试');
      }
    });
    
    // 加入会议按钮事件
    const joinMeetingBtn = document.getElementById('joinMeetingBtn');
    const meetingIdInput = document.getElementById('meetingIdInput');
    
    joinMeetingBtn.addEventListener('click', async () => {
      const meetingId = meetingIdInput.value.trim();
      
      if (!meetingId) {
        alert('请输入会议ID');
        meetingIdInput.focus();
        return;
      }
      
      showLoading("正在加入会议...");
      
      try {
        const result = await window.electronAPI.joinMeeting(meetingId);
        
        if (result.success) {
          // 保存会议ID，跳转到会议室页面
          localStorage.setItem('currentMeetingId', meetingId);
          localStorage.setItem('isMeetingHost', 'false');
          window.electronAPI.navigate('room.html');
        } else {
          hideLoading();
          alert('加入会议失败: ' + result.message);
        }
      } catch (error) {
        hideLoading();
        console.error('加入会议出错:', error);
        alert('加入会议过程中发生错误，请稍后重试');
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
      const loadingOverlay = document.getElementById('loadingOverlay');
      const loadingText = document.getElementById('loadingText');
      
      loadingText.textContent = message || '正在加载...';
      loadingOverlay.classList.add('active');
    }
    
    // 隐藏加载状态
    function hideLoading() {
      const loadingOverlay = document.getElementById('loadingOverlay');
      loadingOverlay.classList.remove('active');
    }
  });