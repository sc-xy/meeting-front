const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); 

// 后端API基础URL
const API_BASE_URL = 'http://localhost:8101/api';

let mainWindow;
// 存储当前登录用户信息
let currentUser = null;

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
  // 生成随机会议ID
  const meetingId = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  // 这里会与后端通信创建会议
  console.log(`创建会议: ${meetingId}`);
  
  return {
    success: true,
    meetingId: meetingId
  };
});

// 加入会议
ipcMain.handle('join-meeting', async (event, meetingId) => {
  if (!meetingId) {
    return { success: false, message: '会议ID不能为空' };
  }
  
  // 这里会与后端通信验证会议
  console.log(`加入会议: ${meetingId}`);
  
  return { 
    success: true,
    meetingId: meetingId
  };
});

// 导航到其他页面
ipcMain.on('navigate', (event, page) => {
  mainWindow.loadFile(path.join(__dirname, 'renderer', page));
});

// 离开会议
ipcMain.on('leave-meeting', () => {
    // 这里会与后端通信，通知用户离开会议
    console.log('用户离开会议');
    
    // 导航到会议页面
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'meeting.html'));
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