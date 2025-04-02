const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  login: (userData) => ipcRenderer.invoke('user-login', userData),
  register: (userData) => ipcRenderer.invoke('user-register', userData),
  navigate: (page) => ipcRenderer.send('navigate', page),
  logout: () => ipcRenderer.send('logout'),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  createMeeting: () => ipcRenderer.invoke('create-meeting'),
  joinMeeting: (meetingId) => ipcRenderer.invoke('join-meeting', meetingId),
  getMeetingInfo: () => ipcRenderer.invoke('get-meeting-info'),
  leaveMeeting: () => ipcRenderer.send('leave-meeting'),
  getIceServers: () => ipcRenderer.invoke('get-ice-servers'),
  log: (logs) => ipcRenderer.invoke('log', logs)
});

// 暴露控制台方法给渲染进程
contextBridge.exposeInMainWorld('electronConsole', {
    log: (...args) => {
        ipcRenderer.invoke('log', ...args);
    },
    error: (...args) => {
        ipcRenderer.invoke('error', ...args);
    },
    warn: (...args) => {
        ipcRenderer.invoke('warn', ...args);
    },
    info: (...args) => {
        ipcRenderer.invoke('info', ...args);
    },
    debug: (...args) => {
        ipcRenderer.invoke('debug', ...args);
    }
});