document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素引用
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

  // WebRTC相关变量
  let localStream = null;
  let peerConnections = {};
  let websocket = null;
  let currentUser = null;
  let meetingInfo = null;
  let cameraEnabled = true;
  let micEnabled = true;
  let isConnectionEstablished = false;

  // WebRTC配置
  let iceServers = null;

  // 初始化
  async function initialize() {
    try {
      showLoading('正在初始化会议...');

      // 获取当前用户信息
      currentUser = await window.electronAPI.getCurrentUser();

      // 获取会议信息
      meetingInfo = await window.electronAPI.getMeetingInfo();

      // 检查会话和会议有效性
      if (!currentUser || !meetingInfo) {
        hideLoading();
        alert('会话已过期或会议信息无效，将返回会议中心');
        window.electronAPI.navigate('meeting.html');
        return;
      }

      // 获取ICE服务器配置
      iceServers = await window.electronAPI.getIceServers();

      // 显示会议ID
      meetingIdElement.textContent = meetingInfo.meetingId;

      // 设置用户名和头像
      localUserName.textContent = '我（' + currentUser.username + '）';
      localUserInitial.textContent = currentUser.initial;
      localNoVideo.querySelector('.avatar').style.backgroundColor = currentUser.avatarColor;

      // 初始化本地媒体流
      await setupLocalMedia();

      // 连接到WebSocket信令服务器
      await connectWebsocket();

      // 隐藏加载界面
      hideLoading();

      // 添加系统消息
      addSystemMessage(`已加入房间 ${meetingInfo.meetingId}`);

    } catch (error) {
      hideLoading();
      window.electronConsole.error('初始化错误:', error);
      alert('初始化会议时出错：' + error.message);
      window.electronAPI.navigate('meeting.html');
    }
  }

  // 设置本地媒体流
  async function setupLocalMedia() {
    try {
      window.electronConsole.log('正在获取本地媒体设备...');
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      window.electronConsole.log('媒体流获取成功:', localStream);
      window.electronConsole.log('视频轨道:', localStream.getVideoTracks().length > 0 ? '有' : '无');
      window.electronConsole.log('音频轨道:', localStream.getAudioTracks().length > 0 ? '有' : '无');

      // 明确检查localVideo元素
      if (!localVideo) {
        window.electronConsole.error('未找到本地视频元素!');
        return;
      }

      // 确保视频元素具有正确的属性
      localVideo.autoplay = true;
      localVideo.muted = true;
      localVideo.playsInline = true;

      // 设置视频源并确认
      localVideo.srcObject = localStream;
      window.electronConsole.log('已将媒体流设置到视频元素', localVideo);

      // 添加加载和错误事件监听
      localVideo.onloadedmetadata = () => {
        window.electronConsole.log('视频元数据已加载');
        localVideo.play().catch(e => window.electronConsole.error('视频播放失败:', e));
      };

      localVideo.onerror = (e) => {
        window.electronConsole.error('视频元素错误:', e);
      };

      // 确保视频可见
      if (localNoVideo) {
        localNoVideo.classList.add('hidden');
      }

      updateMediaUI();

    } catch (error) {
      window.electronConsole.error('获取媒体设备失败:', error);

      // 如果获取摄像头失败，尝试只获取音频
      try {
        cameraEnabled = false;
        updateMediaUI();

        window.electronConsole.log('尝试仅获取音频...');
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        alert('无法访问摄像头，将只使用麦克风参与会议');

      } catch (audioError) {
        window.electronConsole.error('获取麦克风也失败:', audioError);
        micEnabled = false;
        updateMediaUI();
        alert('无法访问麦克风和摄像头，您将只能接收其他参与者的音视频');

        // 创建一个空的流，以便WebRTC连接可以正常建立
        localStream = new MediaStream();
      }
    }
  }

  // 连接到WebSocket信令服务器
  async function connectWebsocket() {
    return new Promise((resolve, reject) => {
      const userId = currentUser.id;
      const username = currentUser.username;
      const wsUrl = `ws://localhost:8101/api/websocket/${userId}/${username}`;

      websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        window.electronConsole.log('WebSocket连接已建立');

        // 发送加入房间消息
        sendToSignalServer('JOIN_ROOM', {
          userId: userId,
          meetingId: meetingInfo.meetingId,
          username: currentUser.username
        });
      };

      websocket.onmessage = (event) => {
        handleSignalingMessage(event.data);
      };

      websocket.onerror = (error) => {
        window.electronConsole.error('WebSocket错误:', error);
        reject(new Error('连接信令服务器失败'));
      };

      websocket.onclose = () => {
        window.electronConsole.log('WebSocket连接已关闭');
        if (!isConnectionEstablished) {
          reject(new Error('信令服务器连接关闭'));
        }
      };

      // 等待连接建立和加入房间确认
      let maxRetries = 10;
      let retryCount = 0;

      const checkConnection = setInterval(() => {
        if (isConnectionEstablished) {
          clearInterval(checkConnection);
          resolve();
        } else if (retryCount >= maxRetries) {
          clearInterval(checkConnection);
          reject(new Error('连接信令服务器超时'));
        }
        retryCount++;
      }, 1000);
    });
  }

  // 处理来自信令服务器的消息
  function handleSignalingMessage(message) {
    try {
      const data = JSON.parse(message);
      window.electronConsole.log('收到信令消息:', data);

      switch (data.eventName) {
        case 'JOIN_ROOM_SUCCESS':
          // 加入房间成功
          isConnectionEstablished = true;
          window.electronConsole.log('成功加入房间');

          // 开始与房间中其他用户建立连接
          initiateConnections(data.data);
          break;

        case 'OFFER':
          // 收到WebRTC Offer
          handleOffer(data.data);
          break;

        case 'ANSWER':
          // 收到WebRTC Answer
          handleAnswer(data.data);
          break;

        case 'ICE_CANDIDATE':
          // 收到ICE候选项
          handleIceCandidate(data.data);
          break;

        case 'CHAT_MESSAGE':
          // 收到聊天消息
          handleChatMessage(data.data);
          break;
      }
    } catch (error) {
      window.electronConsole.error('处理信令消息出错:', error);
    }
  }

  // 发送消息到信令服务器
  function sendToSignalServer(eventName, data) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      const message = {
        eventName: eventName,
        data: data
      };

      websocket.send(JSON.stringify(message));
    } else {
      window.electronConsole.error('WebSocket未连接，无法发送消息');
    }
  }

  // 初始化与房间中所有用户的连接
  function initiateConnections(roomData) {
    if (roomData && roomData.users) {
      // 遍历房间中的其他用户并创建连接
      roomData.users.forEach(user => {
        if (user.userId !== currentUser.id) {
          createPeerConnectionWithOffer(user.userId, user.username);
        }
      });
    }
  }

  // 创建与特定用户的WebRTC对等连接并发送offer
  async function createPeerConnectionWithOffer(userId, username) {
    await createPeerConnection(userId, username);

    // 作为发起方创建offer
    const peerConnection = peerConnections[userId].connection;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendToSignalServer('OFFER', {
      userId: currentUser.id,
      targetUserId: userId,
      sdp: peerConnection.localDescription
    });
  }

  // 创建与特定用户的WebRTC对等连接
  async function createPeerConnection(userId, username) {
    try {
      // 如果已存在连接，先关闭
      if (peerConnections[userId]) {
        closePeerConnection(userId);
      }

      // 创建新的RTCPeerConnection
      const peerConnection = new RTCPeerConnection(iceServers);

      // 保存连接
      peerConnections[userId] = {
        connection: peerConnection,
        username: username
      };

      // 添加本地流
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // 处理ICE候选项
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendToSignalServer('ICE_CANDIDATE', {
            userId: currentUser.id,
            targetUserId: userId.toString(),
            candidate: event.candidate
          });
        }
      };

      // 处理连接状态变化
      peerConnection.onconnectionstatechange = () => {
        window.electronConsole.log(`与 ${username} 的连接状态改变:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          // 发送建立连接消息
          addSystemMessage(`与 ${username} 的连接已建立`);
        }
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
          closePeerConnection(userId);
        }
      }

      // 处理ICE连接状态变化
      peerConnection.oniceconnectionstatechange = () => {
        window.electronConsole.log(`与 ${username} 的ICE连接状态:`, peerConnection.iceConnectionState);
      };

      // 处理远程流添加
      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          handleRemoteStream(event.streams[0], userId, username);
        }
      };

      window.electronConsole.log(`已创建与 ${username} (${userId}) 的对等连接`);

    } catch (error) {
      window.electronConsole.error(`创建与 ${username} 的连接出错:`, error);
    }
  }

  // 处理收到的offer
  async function handleOffer(data) {
    try {
      const { userId, targetUserId, sdp, username } = data;

      // 确保是发给当前用户的
      if (targetUserId === currentUser.id) {
        // 确保与发送方有连接
        if (!peerConnections[userId]) {
          await createPeerConnection(userId, username || 'Unknown User');
        }

        const peerConnection = peerConnections[userId].connection;

        // 设置远程描述
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

        // 创建应答
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // 发送应答
        sendToSignalServer('ANSWER', {
          userId: currentUser.id,
          targetUserId: userId,
          sdp: peerConnection.localDescription
        });
      }
    } catch (error) {
      window.electronConsole.error('处理offer出错:', error);
    }
  }

  // 处理收到的answer
  async function handleAnswer(data) {
    try {
      const { userId, targetUserId, sdp } = data;

      // 确保是发给当前用户的
      if (targetUserId === currentUser.id && peerConnections[userId]) {
        const peerConnection = peerConnections[userId].connection;

        // 设置远程描述
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (error) {
      window.electronConsole.error('处理answer出错:', error);
    }
  }

  // 处理收到的ICE候选项
  async function handleIceCandidate(data) {
    try {
      const { userId, targetUserId, candidate } = data;

      // 确保是发给当前用户的
      if (targetUserId === currentUser.id && peerConnections[userId]) {
        const peerConnection = peerConnections[userId].connection;

        // 添加ICE候选项
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      window.electronConsole.error('处理ICE候选项出错:', error);
    }
  }

  // 处理远程流
  function handleRemoteStream(stream, userId, username) {
    window.electronConsole.log(`收到来自 ${username} 的流`);

    // 检查是否已经有该用户的视频元素
    let videoContainer = document.getElementById(`participant-${userId}`);

    if (!videoContainer) {
      // 创建新的视频容器
      videoContainer = document.createElement('div');
      videoContainer.className = 'video-container';
      videoContainer.id = `participant-${userId}`;

      // 生成一个随机颜色（或基于用户ID生成一致的颜色）
      const avatarColor = colorFromUserId(userId);
      const userInitial = username.charAt(0).toUpperCase();

      videoContainer.innerHTML = `
        <video id="video-${userId}" autoplay playsinline></video>
        <div class="video-overlay">
          <span class="participant-name">${username}</span>
          <div class="media-indicators">
            <span class="indicator camera-off hidden" id="camera-off-${userId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="indicator mic-off hidden" id="mic-off-${userId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </div>
        <div class="no-video-overlay hidden" id="no-video-${userId}">
          <div class="avatar" style="background-color: ${avatarColor};">
            <span>${userInitial}</span>
          </div>
        </div>
      `;

      videoGrid.appendChild(videoContainer);
    }

    // 设置视频源
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
      videoElement.srcObject = stream;

      // 检查流中是否有视频轨道
      const hasVideoTrack = stream.getVideoTracks().length > 0;
      const hasAudioTrack = stream.getAudioTracks().length > 0;

      // 更新视频状态
      updateRemoteVideoState(userId, hasVideoTrack);

      // 更新音频状态
      updateRemoteAudioState(userId, hasAudioTrack);

      // 监听轨道添加/删除事件
      stream.onaddtrack = (event) => {
        if (event.track.kind === 'video') {
          updateRemoteVideoState(userId, true);
        } else if (event.track.kind === 'audio') {
          updateRemoteAudioState(userId, true);
        }
      };

      stream.onremovetrack = (event) => {
        if (event.track.kind === 'video') {
          updateRemoteVideoState(userId, false);
        } else if (event.track.kind === 'audio') {
          updateRemoteAudioState(userId, false);
        }
      };
    }
  }

  // 更新远程用户视频状态
  function updateRemoteVideoState(userId, hasVideo) {
    const noVideoOverlay = document.getElementById(`no-video-${userId}`);
    const cameraOffIndicator = document.getElementById(`camera-off-${userId}`);

    if (hasVideo) {
      noVideoOverlay.classList.add('hidden');
      cameraOffIndicator.classList.add('hidden');
    } else {
      noVideoOverlay.classList.remove('hidden');
      cameraOffIndicator.classList.remove('hidden');
    }
  }

  // 更新远程用户音频状态
  function updateRemoteAudioState(userId, hasAudio) {
    const micOffIndicator = document.getElementById(`mic-off-${userId}`);

    if (hasAudio) {
      micOffIndicator.classList.add('hidden');
    } else {
      micOffIndicator.classList.remove('hidden');
    }
  }

  // 处理聊天消息
  function handleChatMessage(data) {
    const { userId, username, message } = data;

    // 添加消息到聊天区域
    addChatMessage(username, message, false);

    // 如果聊天面板未打开，可以显示一个提示
    if (!chatPanel.classList.contains('active')) {
      // 闪烁聊天按钮或显示未读消息指示器
      toggleChatBtn.classList.add('has-new-message');

      // 可以考虑显示一个通知
      showNotification(`${username}发来消息`, message);
    }
  }

  // 显示桌面通知
  function showNotification(title, body) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }

  // 关闭与特定用户的连接
  function closePeerConnection(userId) {
    if (peerConnections[userId]) {
      const { connection, username } = peerConnections[userId];

      if (connection) {
        connection.close();
      }

      delete peerConnections[userId];

      // 移除视频元素
      const videoContainer = document.getElementById(`participant-${userId}`);
      if (videoContainer) {
        videoContainer.remove();
      }

      window.electronConsole.log(`已关闭与 ${username} (${userId}) 的连接`);

      // 显示系统消息
      addSystemMessage(`${username} 离开了会议`);
    }
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
      localStream.getVideoTracks().forEach(track => {
        track.enabled = cameraEnabled;
      });

      // 更新音频轨道状态
      localStream.getAudioTracks().forEach(track => {
        track.enabled = micEnabled;
      });
    }

    // 通知其他参与者媒体状态变化
    if (isConnectionEstablished) {
      sendToSignalServer('MEDIA_STATE_CHANGE', {
        userId: currentUser.id,
        videoEnabled: cameraEnabled,
        audioEnabled: micEnabled
      });
    }
  }

  // 添加聊天消息
  function addChatMessage(sender, content, isLocal = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isLocal ? 'outgoing' : 'incoming'}`;

    messageElement.innerHTML = `
      <div class="sender">${sender}</div>
      <div class="content">${content}</div>
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 添加系统消息
  function addSystemMessage(content) {
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.innerHTML = `<p>${content}</p>`;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 发送聊天消息
  function sendChatMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // 添加本地消息到聊天窗口
    addChatMessage(`我 (${currentUser.username})`, message, true);

    // 通过信令服务器发送消息
    sendToSignalServer('CHAT_MESSAGE', {
      userId: currentUser.id,
      username: currentUser.username,
      meetingId: meetingInfo.meetingId,
      message: message
    });

    // 清空输入框
    messageInput.value = '';
  }

  // 离开会议
  function leaveMeeting() {
    // 关闭所有对等连接
    Object.keys(peerConnections).forEach(peerId => {
      closePeerConnection(peerId);
    });

    // 关闭WebSocket连接
    if (websocket) {
      websocket.close();
    }

    // 停止本地媒体流
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // 返回会议中心页面
    window.electronAPI.leaveMeeting();
  }

  // 工具函数：根据用户ID生成一致的颜色
  function colorFromUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  // 显示加载状态
  function showLoading(message) {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay active';
    loadingOverlay.id = 'loadingOverlay';

    loadingOverlay.innerHTML = `
      <div class="spinner"></div>
      <p id="loadingText">${message || '正在加载...'}</p>
    `;

    document.body.appendChild(loadingOverlay);
  }

  // 隐藏加载状态
  function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
  }

  // 事件监听器

  // 复制会议ID
  copyMeetingIdBtn.addEventListener('click', async () => {
    const meetingIdText = meetingIdElement.textContent;

    try {
      await navigator.clipboard.writeText(meetingIdText);

      // 显示提示
      const originalTitle = copyMeetingIdBtn.title;
      copyMeetingIdBtn.title = '已复制!';
      copyMeetingIdBtn.style.color = '#4CAF50';

      setTimeout(() => {
        copyMeetingIdBtn.title = originalTitle;
        copyMeetingIdBtn.style.color = '';
      }, 2000);
    } catch (err) {
      window.electronConsole.error('复制失败:', err);
      alert('复制会议ID失败，请手动复制');
    }
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

    // 移除未读消息指示器
    if (chatPanel.classList.contains('active')) {
      toggleChatBtn.classList.remove('has-new-message');
    }
  });

  // 关闭聊天面板
  closeChat.addEventListener('click', () => {
    chatPanel.classList.remove('active');
  });

  // 发送消息按钮点击
  sendMessageBtn.addEventListener('click', () => {
    sendChatMessage();
  });

  // 发送消息输入框按Enter键发送
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
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

  // 处理页面卸载，确保资源释放
  window.addEventListener('unload', () => {
    // 关闭所有连接并释放资源
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    Object.keys(peerConnections).forEach(peerId => {
      if (peerConnections[peerId].connection) {
        peerConnections[peerId].connection.close();
      }
    });

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    }
  });

  // 添加一个监听器来处理视频元素加载错误
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'VIDEO') {
      window.electronConsole.error('视频加载错误:', e);
      // 显示错误占位符
      const videoContainer = e.target.closest('.video-container');
      if (videoContainer) {
        const noVideoOverlay = videoContainer.querySelector('.no-video-overlay');
        if (noVideoOverlay) {
          noVideoOverlay.classList.remove('hidden');
        }
      }
    }
  }, true);

  // 开始初始化
  initialize();
});