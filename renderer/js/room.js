document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const meetingIdElement = document.getElementById('meetingId');
  const videoGrid = document.getElementById('videoGrid');
  const localVideo = document.getElementById('localVideo');
  const localUserName = document.getElementById('localUserName');
  const localUserInitial = document.getElementById('localUserInitial');
  const localNoVideo = document.getElementById('localNoVideo');
  const localCameraOff = document.getElementById('localCameraOff');
  const localMicOff = document.getElementById('localMicOff');
  const copyMeetingIdBtn = document.getElementById('copyMeetingId');
  const leaveMeetingBtn = document.getElementById('leaveMeetingBtn');
  const toggleCameraBtn = document.getElementById('toggleCamera');
  const toggleMicBtn = document.getElementById('toggleMic');
  const toggleChatBtn = document.getElementById('toggleChat');
  const chatPanel = document.getElementById('chatPanel');
  const closeChat = document.getElementById('closeChat');
  const chatMessages = document.getElementById('chatMessages');
  const messageInput = document.getElementById('messageInput');
  const sendMessageBtn = document.getElementById('sendMessage');
  const leaveConfirmModal = document.getElementById('leaveConfirmModal');
  const cancelLeaveBtn = document.getElementById('cancelLeave');
  const confirmLeaveBtn = document.getElementById('confirmLeave');

  // 状态变量
  let localStream = null;
  let peers = {};
  let currentUser = null;
  let cameraEnabled = true;
  let micEnabled = true;
  let socketConnection = null;
  const meetingId = localStorage.getItem('currentMeetingId');
  const isMeetingHost = localStorage.getItem('isMeetingHost') === 'true';
  
  // 初始化
  async function initialize() {
    try {
      // 获取当前用户信息
      currentUser = await window.electronAPI.getCurrentUser();
      if (!currentUser || !meetingId) {
        alert('会话已过期或会议ID无效，将返回会议中心');
        window.electronAPI.navigate('meeting.html');
        return;
      }
      
      // 显示会议ID
      meetingIdElement.textContent = meetingId;
      
      // 设置用户名和头像
      localUserName.textContent = '我（' + currentUser.username + '）';
      localUserInitial.textContent = currentUser.initial;
      localNoVideo.querySelector('.avatar').style.backgroundColor = currentUser.avatarColor;

      // 初始化本地媒体流
      await setupLocalMedia();
      
      // 连接到信令服务器 (这里是伪代码，实际需要实现WebSocket连接到后端)
      connectSignalingServer();
      
    } catch (error) {
      console.error('初始化错误:', error);
      alert('初始化会议时出错：' + error.message);
    }
  }

  // 设置本地媒体流
  async function setupLocalMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      localVideo.srcObject = localStream;
      
      // 默认都是开启的
      updateMediaUI();
      
    } catch (error) {
      console.error('获取媒体设备失败:', error);
      
      // 如果获取摄像头失败，显示头像
      cameraEnabled = false;
      updateMediaUI();
      
      // 尝试只获取音频
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        alert('无法访问摄像头，将只使用麦克风');
      } catch (audioError) {
        micEnabled = false;
        updateMediaUI();
        alert('无法访问麦克风和摄像头，您将只能接收其他参与者的音视频');
      }
    }
  }
  
  // 连接信令服务器 (伪代码)
  function connectSignalingServer() {
    console.log('连接到信令服务器...');
    
    // 这里应该是实际的WebSocket连接代码
    // socketConnection = new WebSocket(wsUrl);
    
    // 模拟连接成功
    setTimeout(() => {
      console.log('已连接到信令服务器');
      // 加入会议房间
      joinRoom();
    }, 1000);
  }
  
  // 加入会议房间 (伪代码)
  function joinRoom() {
    console.log('加入会议房间:', meetingId);
    
    // 这里应该发送加入房间消息给信令服务器
    // socketConnection.send(JSON.stringify({ type: 'join', roomId: meetingId, userId: currentUser.id }));
    
    // 模拟其他参与者 (实际场景中，会从信令服务器收到已在房间中的用户列表)
    if (!isMeetingHost) {
      simulateRemoteParticipant('主持人');
    }
    
    // 如果是主持人，等待其他人加入
    if (isMeetingHost) {
      // 添加系统消息
      addSystemMessage('您已创建会议，会议号: ' + meetingId);
    } else {
      addSystemMessage('您已加入会议');
    }
  }
  
  // 模拟远程参与者加入 (仅用于演示，实际应从信令服务器接收)
  function simulateRemoteParticipant(name) {
    setTimeout(() => {
      const participantId = 'sim-' + Date.now();
      addRemoteParticipant(participantId, name);
      
      // 添加系统消息
      addSystemMessage(`${name} 加入了会议`);
    }, 2000);
  }
  
  // 添加远程参与者
  function addRemoteParticipant(id, name) {
    // 创建视频容器
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `participant-${id}`;
    
    // 创建视频元素
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.id = `video-${id}`;
    
    // 创建视频覆盖层
    const videoOverlay = document.createElement('div');
    videoOverlay.className = 'video-overlay';
    
    const participantNameSpan = document.createElement('span');
    participantNameSpan.className = 'participant-name';
    participantNameSpan.textContent = name;
    
    const mediaIndicators = document.createElement('div');
    mediaIndicators.className = 'media-indicators';
    
    const cameraOffIndicator = document.createElement('span');
    cameraOffIndicator.className = 'camera-off';
    cameraOffIndicator.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.586 20.586L3.414 5.414M2 8C2 7.46957 2.21071 6.96086 2.58579 6.58579C2.96086 6.21071 3.46957 6 4 6H12C12.5304 6 13.0391 6.21071 13.4142 6.58579C13.7893 6.96086 14 7.46957 14 8V16C14 16.48 13.826 16.92 13.538 17.268M6 6H16L22 12V8C22 6.9 21.1 6 20 6H19M4 22H20C20.5304 22 21.0391 21.7893 21.4142 21.4142C21.7893 21.0391 22 20.5304 22 20V11M2 14V16C2 16.5304 2.21071 17.0391 2.58579 17.4142C2.96086 17.7893 3.46957 18 4 18H10" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
    cameraOffIndicator.style.display = 'none';
    
    const micOffIndicator = document.createElement('span');
    micOffIndicator.className = 'mic-off';
    micOffIndicator.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L22 22M12 6V12M16 8V11C16 12.0609 15.5786 13.0783 14.8284 13.8284C14.0783 14.5786 13.0609 15 12 15C10.9391 15 9.92172 14.5786 9.17157 13.8284C8.42143 13.0783 8 12.0609 8 11M8 11V8M12 19V22M8 22H16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    micOffIndicator.style.display = 'none';
    
    mediaIndicators.appendChild(cameraOffIndicator);
    mediaIndicators.appendChild(micOffIndicator);
    
    videoOverlay.appendChild(participantNameSpan);
    videoOverlay.appendChild(mediaIndicators);
    
    // 创建无视频时的覆盖层
    const noVideoOverlay = document.createElement('div');
    noVideoOverlay.className = 'no-video-overlay hidden';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.style.backgroundColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    
    const initialSpan = document.createElement('span');
    initialSpan.textContent = name.charAt(0).toUpperCase();
    
    avatarDiv.appendChild(initialSpan);
    noVideoOverlay.appendChild(avatarDiv);
    
    // 组装所有元素
    videoContainer.appendChild(video);
    videoContainer.appendChild(videoOverlay);
    videoContainer.appendChild(noVideoOverlay);
    
    // 添加到视频网格
    videoGrid.appendChild(videoContainer);
    
    // 模拟随机的媒体状态 (仅用于演示)
    setTimeout(() => {
      const cameraOn = Math.random() > 0.3;
      const micOn = Math.random() > 0.3;
      
      if (!cameraOn) {
        cameraOffIndicator.style.display = 'flex';
        noVideoOverlay.classList.remove('hidden');
      }
      
      if (!micOn) {
        micOffIndicator.style.display = 'flex';
      }
    }, 1000);
    
    // 实际场景中，这里会建立 WebRTC 连接
    peers[id] = {
      id,
      name,
      // peerConnection: 实际的 RTCPeerConnection 对象
    };
    
    // 模拟视频流 (仅用于演示)
    simulateVideoStream(video);
  }
  
  // 模拟视频流 (仅用于演示)
  function simulateVideoStream(videoElement) {
    // 在实际应用中，视频元素会接收 WebRTC 远程流
    // 这里只是展示一个占位内容
    videoElement.poster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 800 450'%3E%3Crect fill='%23333333' width='800' height='450'/%3E%3Ctext x='400' y='225' font-family='Arial' font-size='30' fill='white' text-anchor='middle' dominant-baseline='middle'%3E远程视频流%3C/text%3E%3C/svg%3E";
  }
  
  // 更新媒体控制UI
  function updateMediaUI() {
    // 更新摄像头状态UI
    if (cameraEnabled) {
      toggleCameraBtn.classList.add('active');
      localCameraOff.classList.add('hidden');
      localNoVideo.classList.add('hidden');
    } else {
      toggleCameraBtn.classList.remove('active');
      localCameraOff.classList.remove('hidden');
      localNoVideo.classList.remove('hidden');
    }
    
    // 更新麦克风状态UI
    if (micEnabled) {
      toggleMicBtn.classList.add('active');
      localMicOff.classList.add('hidden');
    } else {
      toggleMicBtn.classList.remove('active');
      localMicOff.classList.remove('hidden');
    }
    
    // 如果有本地流，更新实际设备状态
    if (localStream) {
      // 更新视频轨道状态
      if (localStream.getVideoTracks().length > 0) {
        localStream.getVideoTracks()[0].enabled = cameraEnabled;
      }
      
      // 更新音频轨道状态
      if (localStream.getAudioTracks().length > 0) {
        localStream.getAudioTracks()[0].enabled = micEnabled;
      }
    }
  }
  
  // 添加系统消息到聊天
  function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.innerHTML = `<p>${message}</p>`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // 添加聊天消息
  function addChatMessage(sender, content, isOutgoing = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    
    const senderElement = document.createElement('div');
    senderElement.className = 'sender';
    senderElement.textContent = sender;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'content';
    contentElement.textContent = content;
    
    messageElement.appendChild(senderElement);
    messageElement.appendChild(contentElement);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // 发送聊天消息 (伪代码)
  function sendChatMessage(message) {
    if (!message.trim()) return;
    
    // 添加到本地聊天
    addChatMessage('我', message, true);
    
    // 实际应用中，应将消息发送到信令服务器
    console.log('发送消息:', message);
    // socketConnection.send(JSON.stringify({ type: 'chat', roomId: meetingId, sender: currentUser.username, message }));
    
    // 清空输入框
    messageInput.value = '';
    
    // 模拟收到回复 (仅用于演示)
    setTimeout(() => {
      addChatMessage(isMeetingHost ? '参与者' : '主持人', '收到你的消息: ' + message);
    }, 1000);
  }
  
  // 离开会议
  function leaveMeeting() {
    // 关闭所有对等连接
    Object.keys(peers).forEach(peerId => {
      // 如果有实际的 RTCPeerConnection，应该在这里关闭
      // if (peers[peerId].peerConnection) {
      //   peers[peerId].peerConnection.close();
      // }
    });
    
    // 关闭本地媒体流
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // 关闭信令连接
    // if (socketConnection) {
    //   socketConnection.close();
    // }
    
    // 清除会议信息
    localStorage.removeItem('currentMeetingId');
    localStorage.removeItem('isMeetingHost');
    
    // 导航回会议中心页面
    window.electronAPI.leaveMeeting();
  }
  
  // 事件监听器
  
  // 复制会议ID
  copyMeetingIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(meetingId)
      .then(() => {
        alert('会议ID已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  });
  
  // 切换摄像头
  toggleCameraBtn.addEventListener('click', () => {
    cameraEnabled = !cameraEnabled;
    updateMediaUI();
  });
  
  // 切换麦克风
  toggleMicBtn.addEventListener('click', () => {
    micEnabled = !micEnabled;
    updateMediaUI();
  });
  
  // 打开/关闭聊天面板
  toggleChatBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('active');
  });
  
  // 关闭聊天面板
  closeChat.addEventListener('click', () => {
    chatPanel.classList.remove('active');
  });
  
  // 发送消息
  sendMessageBtn.addEventListener('click', () => {
    sendChatMessage(messageInput.value);
  });
  
  // 按回车键发送消息
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage(messageInput.value);
    }
  });
  
  // 打开离开会议确认对话框
  leaveMeetingBtn.addEventListener('click', () => {
    leaveConfirmModal.classList.add('active');
  });
  
  // 取消离开会议
  cancelLeaveBtn.addEventListener('click', () => {
    leaveConfirmModal.classList.remove('active');
  });
  
  // 确认离开会议
  confirmLeaveBtn.addEventListener('click', () => {
    leaveMeeting();
  });
  
  // 模拟远程参与者进入/离开 (仅用于演示)
  function simulatePeerEvents() {
    // 模拟参与者进入
    if (isMeetingHost) {
      setTimeout(() => {
        simulateRemoteParticipant('参与者1');
      }, 5000);
      
      setTimeout(() => {
        simulateRemoteParticipant('参与者2');
      }, 8000);
    }
  }
  
  // 开始初始化
  initialize();
  
  // 模拟参与者事件 (仅用于演示)
  simulatePeerEvents();
});