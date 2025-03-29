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
  leaveMeeting: () => ipcRenderer.send('leave-meeting'),
  getIceServers: () => ipcRenderer.invoke('get-ice-servers')
});