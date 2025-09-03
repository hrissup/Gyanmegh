<script>
  import { onMount } from 'svelte';
  import { io } from 'socket.io-client';
  import Whiteboard from './Whiteboard.svelte';
  import Chat from './Chat.svelte';
  import DownloadManager from './DownloadManager.svelte';
  import NotesViewer from './NotesViewer.svelte';

  let roomId = '';
  let studentName = '';
  let status = 'Enter a room name and choose a role to begin.';
  let isJoined = false;
  let statusColor = 'text-base-content';
  let chatMessages = [];
  let userRole = '';
  
  let socket;
  let localStream;
  let peerConnections = {};
  let dataChannels = {};
  let localAudioElement;
  let remoteAudioElement;
  let whiteboardComponent;
  
  // Audio control states
  let isLocalMuted = false;
  let isRemoteMuted = false;
  let localVolume = 1;
  let remoteVolume = 1;
  let localAudioLevel = 0;
  let remoteAudioLevel = 0;
  
  // Recording states
  let isRecording = false;
  let recordingStartTime = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingDuration = 0;
  let recordingTimer = null;
  let whiteboardSnapshots = [];
  let snapshotInterval = null;
  let connectedStudents = [];

  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  onMount(() => {
    socket = io('http://localhost:3001');
    socket.on('connect', () => console.log('Connected to signaling server with ID:', socket.id));
    setupSocketListeners();
  });

  async function handleJoin(role) {
    if (!roomId.trim()) {
      alert('Please enter a room ID.');
      return;
    }
    
    if (!studentName.trim()) {
      alert('Please enter your name.');
      return;
    }
    
    userRole = role;
    isJoined = true;
    status = `Joining room "${roomId}" as a ${role}...`;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      localAudioElement.srcObject = localStream;
      
      // Start audio level monitoring
      startAudioLevelMonitoring();
      
      status = `✅ Joined room "${roomId}" as a ${role}.`;
      statusColor = 'text-green-500';
      const joinData = { role, studentName: studentName };
      console.log('Joining room with data:', joinData);
      socket.emit('join-room', roomId, joinData);
      
      // Request existing participants in the room
      socket.emit('get-room-participants', roomId);
    } catch (err) {
      console.error('Error getting user media', err);
      status = '❌ Could not access microphone. Please check permissions.';
      statusColor = 'text-red-500';
      isJoined = false;
    }
  }

  function startAudioLevelMonitoring() {
    if (!localStream) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(localStream);
    
    microphone.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function updateAudioLevel() {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      localAudioLevel = average / 255; // Normalize to 0-1
    }
    
    setInterval(updateAudioLevel, 100);
  }

  function startRemoteAudioLevelMonitoring(remoteStream) {
    if (!remoteStream) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const remoteSource = audioContext.createMediaStreamSource(remoteStream);
    
    remoteSource.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function updateRemoteAudioLevel() {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      remoteAudioLevel = average / 255; // Normalize to 0-1
    }
    
    setInterval(updateRemoteAudioLevel, 100);
  }

  function toggleLocalMute() {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isLocalMuted = !audioTrack.enabled;
      }
    }
  }

  function toggleRemoteMute() {
    if (remoteAudioElement) {
      remoteAudioElement.muted = !remoteAudioElement.muted;
      isRemoteMuted = remoteAudioElement.muted;
    }
  }

  function updateLocalVolume(event) {
    localVolume = event.target.value;
    if (localAudioElement) {
      localAudioElement.volume = localVolume;
    }
  }

  function updateRemoteVolume(event) {
    remoteVolume = event.target.value;
    if (remoteAudioElement) {
      remoteAudioElement.volume = remoteVolume;
    }
  }

  // Lecture recording functions
  async function startRecording() {
    if (!localStream) {
      alert('No audio stream available');
      return;
    }

    try {
      recordedChunks = [];
      whiteboardSnapshots = [];
      
      mediaRecorder = new MediaRecorder(localStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `lecture-${roomId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Save to local storage for later access
        saveRecordingToStorage(blob);
      };

      mediaRecorder.start(1000); // Collect data every second
      isRecording = true;
      recordingStartTime = Date.now();
      
      // Start recording timer
      recordingTimer = setInterval(() => {
        recordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
      }, 1000);
      
      // Start whiteboard snapshot capture
      startWhiteboardSnapshots();
      
      status = `🎙️ Recording audio & whiteboard...`;
      statusColor = 'text-red-500';
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not start recording. Please check permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      
      if (snapshotInterval) {
        clearInterval(snapshotInterval);
        snapshotInterval = null;
      }
      
      // Save whiteboard notes
      saveWhiteboardNotes();
      
      status = `✅ Audio & whiteboard notes saved!`;
      statusColor = 'text-green-500';
      recordingDuration = 0;
    }
  }

  function startWhiteboardSnapshots() {
    if (!whiteboardComponent) return;
    
    // Take initial snapshot
    takeWhiteboardSnapshot();
    
    // Take snapshots every 5 seconds
    snapshotInterval = setInterval(() => {
      takeWhiteboardSnapshot();
    }, 5000);
  }

  function takeWhiteboardSnapshot() {
    console.log('Taking whiteboard snapshot...');
    console.log('whiteboardComponent:', whiteboardComponent);
    
    if (!whiteboardComponent) {
      console.log('No whiteboard component available');
      return;
    }
    
    const canvas = whiteboardComponent.getCanvas();
    console.log('canvas:', canvas);
    
    if (!canvas) {
      console.log('No canvas available for snapshot');
      return;
    }
    
    try {
      const timestamp = Date.now() - recordingStartTime;
      
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('Snapshot blob created, size:', blob.size);
          whiteboardSnapshots.push({
            timestamp: timestamp,
            blob: blob,
            dataUrl: canvas.toDataURL('image/png')
          });
          console.log('Total snapshots:', whiteboardSnapshots.length);
        } else {
          console.log('Failed to create blob from canvas');
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Error taking whiteboard snapshot:', error);
    }
  }

  function saveWhiteboardNotes() {
    console.log('Saving whiteboard notes...');
    console.log('Number of snapshots:', whiteboardSnapshots.length);
    
    if (whiteboardSnapshots.length === 0) {
      console.log('No snapshots to save');
      return;
    }
    
    try {
      // Create a PDF-like document with all snapshots
      const notesData = {
        id: Date.now().toString(),
        roomId: roomId,
        title: `Whiteboard Notes - ${roomId}`,
        date: new Date().toISOString(),
        duration: recordingDuration,
        snapshots: whiteboardSnapshots,
        totalSnapshots: whiteboardSnapshots.length
      };
      
      console.log('Notes data created:', notesData);
      
      // Save to localStorage
      const notes = JSON.parse(localStorage.getItem('whiteboard-notes') || '[]');
      notes.push(notesData);
      localStorage.setItem('whiteboard-notes', JSON.stringify(notes));
      
      // Create downloadable file
      createNotesDownload(notesData);
      
      console.log('Whiteboard notes saved successfully');
    } catch (error) {
      console.error('Error saving whiteboard notes:', error);
    }
  }

  function createNotesDownload(notesData) {
    console.log('Creating notes download...');
    console.log('Notes data:', notesData);
    
    try {
      // Create an HTML file that can be opened in browser
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Whiteboard Notes - ${notesData.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .snapshot { margin: 20px 0; text-align: center; }
            .timestamp { color: #666; font-size: 14px; margin-bottom: 10px; }
            img { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; }
            .info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${notesData.title}</h1>
            <p>Recorded on: ${new Date(notesData.date).toLocaleString()}</p>
            <p>Duration: ${formatDuration(notesData.duration)} | Snapshots: ${notesData.totalSnapshots}</p>
          </div>
      `;
      
      console.log('Processing snapshots...');
      notesData.snapshots.forEach((snapshot, index) => {
        const time = formatDuration(Math.floor(snapshot.timestamp / 1000));
        console.log(`Snapshot ${index + 1} at ${time}`);
        htmlContent += `
          <div class="snapshot">
            <div class="timestamp">Snapshot ${index + 1} - ${time}</div>
            <img src="${snapshot.dataUrl}" alt="Whiteboard snapshot at ${time}" />
          </div>
        `;
      });
      
      htmlContent += '</body></html>';
      
      console.log('HTML content created, length:', htmlContent.length);
      
      // Create and download the HTML file
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard-notes-${roomId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('HTML file download initiated');
      
    } catch (error) {
      console.error('Error creating notes download:', error);
    }
  }

  function saveRecordingToStorage(blob) {
    try {
      const recordings = JSON.parse(localStorage.getItem('lecture-recordings') || '[]');
      const recording = {
        id: Date.now().toString(),
        roomId: roomId,
        title: `Lecture in ${roomId}`,
        duration: recordingDuration,
        size: blob.size,
        date: new Date().toISOString(),
        blob: blob,
        hasWhiteboardNotes: whiteboardSnapshots.length > 0
      };
      
      recordings.push(recording);
      localStorage.setItem('lecture-recordings', JSON.stringify(recordings));
      
      console.log('Recording saved to local storage');
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleDrawEvent(event) {
    const drawData = {
      type: 'draw',
      payload: event.detail
    };
    broadcastData(drawData);
  }

  function handleClearEvent() {
    broadcastData({ type: 'clear' });
  }

  function handleSendChatMessage(event) {
    const messageData = {
      sender: 'Me',
      text: event.detail.text,
      isMine: true
    };
    chatMessages = [...chatMessages, messageData];
    
    broadcastData({
      type: 'chat',
      payload: {
        sender: `Peer ${socket.id.substring(0, 4)}`,
        text: event.detail.text
      }
    });
  }
  
  function broadcastData(data) {
    const serializedData = JSON.stringify(data);
    for (const peerId in dataChannels) {
      const channel = dataChannels[peerId];
      if (channel && channel.readyState === 'open') {
        channel.send(serializedData);
      }
    }
  }

  function setupSocketListeners() {
    socket.on('user-connected', (socketId) => {
      console.log('New user connected:', socketId);
      status = `A new user has joined! Connecting...`;
      const pc = createPeerConnection(socketId);
      
      const dataChannel = pc.createDataChannel('main');
      setupDataChannel(dataChannel, socketId);
      
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          const payload = { target: socketId, caller: socket.id, sdp: pc.localDescription };
          socket.emit('offer', payload);
        });
    });

    socket.on('offer', (payload) => {
      console.log('Received offer from:', payload.caller);
      status = `Receiving a call. Connecting...`;
      const pc = createPeerConnection(payload.caller);
      
      pc.ondatachannel = (event) => {
        console.log('Received data channel');
        setupDataChannel(event.channel, payload.caller);
      };

      pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        .then(() => {
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
          return pc.createAnswer();
        })
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          const payloadAnswer = { target: payload.caller, caller: socket.id, sdp: pc.localDescription };
          socket.emit('answer', payloadAnswer);
        });
    });

    socket.on('answer', (payload) => {
      const pc = peerConnections[payload.caller];
      pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    });

    socket.on('ice-candidate', (payload) => {
      const pc = peerConnections[payload.caller];
      if (pc) pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    socket.on('user-joined', (userInfo) => {
      // Add all other participants to the list
      if (userInfo.socketId !== socket.id) { // Don't add yourself
        connectedStudents = [...connectedStudents, userInfo];
        console.log('User joined:', userInfo);
        console.log('Current participants list:', connectedStudents);
      }
    });

    socket.on('user-left', (socketId) => {
      connectedStudents = connectedStudents.filter(user => user.socketId !== socketId);
      console.log('User left:', socketId);
    });

    socket.on('room-participants', (participants) => {
      // Filter out ourselves from the participants list
      connectedStudents = participants.filter(p => p.socketId !== socket.id);
      console.log('Room participants received:', participants);
      console.log('Filtered participants (excluding self):', connectedStudents);
    });
  }

  function setupDataChannel(channel, peerId) {
    channel.onopen = () => console.log(`Data channel with ${peerId} is open!`);
    channel.onclose = () => console.log(`Data channel with ${peerId} is closed.`);
    channel.onerror = (err) => console.error('Data channel error:', err);
    channel.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'draw') {
        if (whiteboardComponent) {
          whiteboardComponent.drawOnCanvas(data.payload);
        }
      } else if (data.type === 'chat') {
        const newMessage = { ...data.payload, isMine: false };
        chatMessages = [...chatMessages, newMessage];
      } else if (data.type === 'clear') {
        if (whiteboardComponent) {
          whiteboardComponent.clearCanvas();
        }
      }
    };
    dataChannels[peerId] = channel;
  }

  function createPeerConnection(targetSocketId) {
    const pc = new RTCPeerConnection(iceConfig);
    peerConnections[targetSocketId] = pc;

    pc.ontrack = (event) => {
      remoteAudioElement.srcObject = event.streams[0];
      status = `✅ Connection established!`;
      statusColor = 'text-green-500';
      
      // Start monitoring remote audio levels
      startRemoteAudioLevelMonitoring(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const payload = { target: targetSocketId, caller: socket.id, candidate: event.candidate };
        socket.emit('ice-candidate', payload);
      }
    };
    return pc;
  }
</script>

<main class="classroom-container">
  <header class="classroom-header">
          <div class="header-content">
        <div class="title-section">
          <h1 class="main-title">
            <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span class="project-logo-inline">ज्ञानमेघ</span>
            Virtual Classroom
          </h1>
        </div>
        <div class="status-indicator">
          <div class="status-dot {statusColor === 'text-green-500' ? 'connected' : 'disconnected'}"></div>
          <p class="status-text {statusColor}">{status}</p>
        </div>
      </div>
  </header>

  {#if !isJoined}
    <div class="join-section">
      <div class="join-card">
        <div class="join-header">
          <h2 class="join-title">Join a Classroom</h2>
          <p class="join-subtitle">Enter a room name and choose your role to get started</p>
        </div>
        
        <div class="join-form">
          <div class="input-group">
            <label for="roomId" class="input-label">Room Name</label>
            <input 
              id="roomId"
              type="text" 
              bind:value={roomId} 
              placeholder="Enter room name (e.g., Math101)" 
              class="room-input"
            />
          </div>
          
          <div class="input-group">
            <label for="studentName" class="input-label">Your Name</label>
            <input 
              id="studentName"
              type="text" 
              bind:value={studentName} 
              placeholder="Enter your name" 
              class="room-input"
            />
          </div>
          
          <div class="role-buttons">
            <button on:click={() => handleJoin('student')} class="role-btn student-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Join as Student
            </button>
            <button on:click={() => handleJoin('lecturer')} class="role-btn lecturer-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 10v6M2 10v6M20.5 4h-17C2.5 4 2 4.5 2 5v14c0 .5.5 1 1.5 1h17c1 0 1.5-.5 1.5-1V5c0-.5-.5-1-1.5-1z"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
              Join as Lecturer
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="classroom-content">
      <div class="main-workspace">
        <div class="workspace-header">
          <h3 class="workspace-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Interactive Whiteboard
          </h3>
          <div class="workspace-controls">
            <div class="role-badge {userRole}">
              {userRole === 'lecturer' ? 'Lecturer' : 'Student'}
            </div>
            {#if userRole === 'lecturer'}
              <div class="recording-controls">
                {#if !isRecording}
                  <button on:click={startRecording} class="record-btn start">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="3" fill="currentColor"/>
                    </svg>
                    Start Recording
                  </button>
                {:else}
                  <button on:click={stopRecording} class="record-btn stop">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="6" y="6" width="12" height="12"/>
                    </svg>
                    Stop Recording ({formatDuration(recordingDuration)})
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        
        <Whiteboard 
          role={userRole} 
          on:draw={handleDrawEvent} 
          on:clear={handleClearEvent}
          bind:this={whiteboardComponent} 
        />
      </div>

      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="section-header">
            <h3 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </h3>
          </div>
          <Chat messages={chatMessages} on:send={handleSendChatMessage} />
        </div>
        
        <div class="sidebar-section">
          <div class="section-header">
            <h3 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Participants
            </h3>
          </div>
          <div class="students-list">
            {#if connectedStudents.length === 0}
              <p class="no-students">No other participants connected yet</p>
            {:else}
              {#each connectedStudents as user}
                <div class="student-item">
                  <div class="student-info">
                    <span class="student-name">{user.name}</span>
                    <span class="student-status connected">● {user.role === 'lecturer' ? 'Lecturer' : 'Student'}</span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="section-header">
            <h3 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              Audio Streams
            </h3>
          </div>
          <div class="audio-controls">
            <div class="audio-item">
              <div class="audio-header">
                <h4 class="audio-title">My Microphone</h4>
                <div class="audio-controls-row">
                  <button 
                    class="mute-btn {isLocalMuted ? 'muted' : ''}" 
                    on:click={toggleLocalMute}
                    title={isLocalMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {#if isLocalMuted}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                      </svg>
                    {:else}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    {/if}
                  </button>
                  <div class="audio-level-indicator">
                    <div class="level-bar" style="width: {localAudioLevel * 100}%"></div>
                  </div>
                </div>
              </div>
              <div class="volume-control">
                <label class="volume-label">Volume</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={localVolume}
                  on:input={updateLocalVolume}
                  class="volume-slider"
                />
                <span class="volume-value">{Math.round(localVolume * 100)}%</span>
              </div>
              <audio bind:this={localAudioElement} autoplay muted class="audio-element"></audio>
            </div>
            
            <div class="audio-item">
              <div class="audio-header">
                <h4 class="audio-title">Remote Audio</h4>
                <div class="audio-controls-row">
                  <button 
                    class="mute-btn {isRemoteMuted ? 'muted' : ''}" 
                    on:click={toggleRemoteMute}
                    title={isRemoteMuted ? 'Unmute remote audio' : 'Mute remote audio'}
                  >
                    {#if isRemoteMuted}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                      </svg>
                    {:else}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                      </svg>
                    {/if}
                  </button>
                  <div class="audio-level-indicator">
                    <div class="level-bar" style="width: {remoteAudioLevel * 100}%"></div>
                  </div>
                </div>
              </div>
              <div class="volume-control">
                <label class="volume-label">Volume</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={remoteVolume}
                  on:input={updateRemoteVolume}
                  class="volume-slider"
                />
                <span class="volume-value">{Math.round(remoteVolume * 100)}%</span>
              </div>
              <audio bind:this={remoteAudioElement} autoplay class="audio-element"></audio>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <DownloadManager />
        </div>
        
        <div class="sidebar-section">
          <NotesViewer />
        </div>
      </aside>
    </div>
  {/if}
</main>

<style>
  .classroom-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 0;
  }

  .classroom-header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .project-logo-inline {
    font-size: 1.75rem;
    font-weight: 700;
    color: #667eea;
    margin-right: 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .title-section {
    display: flex;
    justify-content: center;
    align-items: center;
    grid-column: 2;
  }

  /* Responsive design for smaller screens */
  @media (max-width: 768px) {
    .header-content {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      text-align: center;
    }
    
    .project-logo-inline {
      font-size: 1.5rem;
      margin-right: 0.5rem;
    }
    
    .main-title {
      font-size: 1.5rem;
    }
  }

  .main-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .title-icon {
    width: 2rem;
    height: 2rem;
    color: #667eea;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    grid-column: 3;
    justify-self: end;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }

  .status-dot.connected {
    background: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  }

  .status-dot.disconnected {
    background: #ef4444;
  }

  .status-text {
    font-size: 0.875rem;
    font-weight: 500;
    margin: 0;
  }

  .join-section {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 100px);
    padding: 2rem;
  }

  .join-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 3rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 500px;
    width: 100%;
  }

  .join-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .join-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .join-subtitle {
    color: #6b7280;
    font-size: 1rem;
    margin: 0;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .room-input {
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s ease;
    background: white;
    color: #000000;
  }

  .room-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .role-buttons {
    display: flex;
    gap: 1rem;
  }

  .role-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .role-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .student-btn {
    background: #f3f4f6;
    color: #374151;
  }

  .student-btn:hover {
    background: #e5e7eb;
    transform: translateY(-1px);
  }

  .lecturer-btn {
    background: #667eea;
    color: white;
  }

  .lecturer-btn:hover {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .classroom-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: 2rem;
    min-height: calc(100vh - 100px);
  }

  .main-workspace {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .workspace-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
  }

  .workspace-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .workspace-title svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .workspace-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .role-badge {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .role-badge.lecturer {
    background: rgba(102, 126, 234, 0.2);
    color: #667eea;
  }

  .role-badge.student {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .recording-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .record-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .record-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .record-btn.start {
    background: #ef4444;
    color: white;
  }

  .record-btn.start:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .record-btn.stop {
    background: #6b7280;
    color: white;
  }

  .record-btn.stop:hover {
    background: #4b5563;
    transform: translateY(-1px);
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .sidebar-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .section-header {
    margin-bottom: 1rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .section-title svg {
    width: 1.25rem;
    height: 1.25rem;
    color: #667eea;
  }

  .audio-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .audio-item {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .audio-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .audio-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .audio-controls-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .mute-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mute-btn:hover {
    border-color: #667eea;
    background: #f8fafc;
  }

  .mute-btn.muted {
    background: #ef4444;
    border-color: #ef4444;
    color: white;
  }

  .mute-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .audio-level-indicator {
    flex: 1;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .level-bar {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 4px;
    transition: width 0.1s ease;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .volume-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    min-width: 50px;
  }

  .volume-slider {
    flex: 1;
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    -webkit-appearance: none;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .volume-slider::-webkit-slider-thumb:hover {
    background: #5a67d8;
    transform: scale(1.1);
  }

  .volume-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  .volume-slider::-moz-range-thumb:hover {
    background: #5a67d8;
    transform: scale(1.1);
  }

  .volume-value {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    min-width: 35px;
    text-align: right;
  }

  .audio-element {
    display: none;
  }

  .students-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .no-students {
    color: #6b7280;
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  .student-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .student-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .student-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .student-status {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .student-status.connected {
    color: #10b981;
  }

  @media (max-width: 1024px) {
    .classroom-content {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    .sidebar {
      order: -1;
    }
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
    
    .role-buttons {
      flex-direction: column;
    }
    
    .classroom-content {
      padding: 1rem;
    }
    
    .join-card {
      padding: 2rem;
      margin: 1rem;
    }
    
    .workspace-controls {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>