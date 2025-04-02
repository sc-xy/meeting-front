const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); 

// 后端API基础URL
const API_BASE_URL = 'http://localhost:8101/api';
const MEETING_CREATE_API_URL = 'http://localhost:8101/api/meeting/create';
const MEETING_QUERY_API_URL = 'http://localhost:8101/api/meeting/query';

// 窗口管理
let mainWindow;

// 存储当前登录用户信息
let currentUser = null;

// 存储当前会议信息
let currentMeetingInfo = null;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    resizable: true,
    center: true,
    show: false
  });

  // 加载登录页面
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 处理登录请求
ipcMain.handle('user-login', async (event, userData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/user/login`, {
            userName: userData.username,
            userPassword: userData.password
        });
        
        // 检查响应状态
        if (response.data && response.data.code === 0) {
            // 登录成功，存储用户信息
            currentUser = {
            id: response.data.data.id,
            username: response.data.data.userName,
            // 生成随机颜色作为头像背景
            avatarColor: '#' + Math.floor(Math.random()*16777215).toString(16),
            // 提取用户名首字母作为头像
            initial: response.data.data.userName.charAt(0).toUpperCase()
            };
            
            return { success: true, message: '登录成功' };
        } else {
            return { success: false, message: response.data.message || '登录失败' };
        }
    } catch (error) {
        console.error('登录请求出错:', error);
        return { 
            success: false, 
            message: error.response?.data?.message || '网络错误，请稍后重试' 
        };
    }
});

// 处理注册请求
ipcMain.handle('user-register', async (event, userData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/user/register`, {
            userName: userData.username,
            userPassword: userData.password,
            checkPassword: userData.confirmPassword
        });
        
        // 检查响应状态
        if (response.data && response.data.code === 0) {
            return { 
            success: true, 
            message: '注册成功', 
            userId: response.data.data 
            };
        } else {
            return { 
            success: false, 
            message: response.data.message || '注册失败' 
            };
        }
    } catch (error) {
        console.error('注册请求出错:', error);
        return { 
            success: false, 
            message: error.response?.data?.message || '网络错误，请稍后重试' 
        };
    }
});

// 获取当前用户信息
ipcMain.handle('get-current-user', async () => {
  return currentUser;
});

// 登出处理
ipcMain.on('logout', () => {
  currentUser = null;
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
});

// 创建会议
ipcMain.handle('create-meeting', async () => {
    try {
      if (!currentUser || !currentUser.id) {
        return { 
          success: false, 
          message: '用户未登录或会话已过期' 
        };
      }
      
      const response = await axios.post(MEETING_CREATE_API_URL, {
        userid: currentUser.id
      });
      
      // 检查响应状态
      if (response.data && response.data.code === 0) {
        // 存储会议信息
        currentMeetingInfo = response.data.data;
        
        return {
          success: true,
          meetingId: response.data.data.meetingId
        };
      } else {
        return { 
          success: false, 
          message: response.data.message || '创建会议失败' 
        };
      }
    } catch (error) {
      console.error('创建会议请求出错:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || '网络错误，请稍后重试' 
      };
    }
});
  
// 加入会议
ipcMain.handle('join-meeting', async (event, meetingId) => {
    try {
        if (!currentUser || !currentUser.id) {
        return { 
            success: false, 
            message: '用户未登录或会话已过期' 
        };
        }
        
        if (!meetingId) {
        return { 
            success: false, 
            message: '请输入有效的会议ID' 
        };
        }
        
        const response = await axios.post(MEETING_QUERY_API_URL, {
        meetingId: meetingId
        });
        
        // 检查响应状态
        if (response.data && response.data.code === 0) {
        // 存储会议信息
        currentMeetingInfo = response.data.data;
        
        return {
            success: true,
            meetingId: response.data.data.meetingId
        };
        } else {
        return { 
            success: false, 
            message: response.data.message || '会议不存在或已结束' 
        };
        }
    } catch (error) {
        console.error('查询会议请求出错:', error);
        return { 
        success: false, 
        message: error.response?.data?.message || '网络错误，请稍后重试' 
        };
    }
});

// 获取会议信息
ipcMain.handle('get-meeting-info', async () => {
    return currentMeetingInfo;
});

// 清除会议信息（离开会议时）
ipcMain.on('leave-meeting', () => {
    console.log('用户离开会议')

    currentMeetingInfo = null;

    console.log('currentMeetingInfo: ', currentMeetingInfo);
    // 原有的导航逻辑保持不变
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'meeting.html'));
});

// 导航到其他页面
ipcMain.on('navigate', (event, page) => {
  mainWindow.loadFile(path.join(__dirname, 'renderer', page));
});
  
// 获取STUN/TURN服务器信息
ipcMain.handle('get-ice-servers', async () => {
  // 实际应用中应从后端获取这些信息
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
}); 

// 处理渲染进程打印日志
ipcMain.handle('log', (event, ...args) => {
    console.log(...args);
})

ipcMain.handle('error', (event, ...args) => {
    console.error(...args);
})

ipcMain.handle('warn', (event, ...args) => {
    console.warn(...args);
})

ipcMain.handle('info', (event, ...args) => {
    console.info(...args);
})

ipcMain.handle('debug', (event, ...args) => {
    console.debug(...args);
})