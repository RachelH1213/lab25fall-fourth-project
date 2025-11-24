// ✅ FIXED: Remove trailing slash
const socket = io("https://lab25fall-fourth-project.onrender.com");

let roomCode = "";
let isInitiator = false;
let peerConnection;
let dataChannel;
let myText = "";
let partnerText = "";
let currentPrompt = "";
let myPosition = 0;
let partnerPosition = 0;
let storyTemplate = "";
let isDataChannelReady = false;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const roomView = document.getElementById("room-view");
const writingView = document.getElementById("writing-view");
const resultPage = document.getElementById("result-page");

const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const promptEl = document.getElementById("prompt");
const myAnswer = document.getElementById("myAnswer");
const submitBtn = document.getElementById("submitBtn");

// ✅ ADD: Connection status listeners
socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  alert('Cannot connect to server. Please check your internet connection.');
});

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from server');
});

socket.on("receive-template", (template) => {
  storyTemplate = template;
  console.log("📜 Template received:", template);
});

socket.on("receive-prompt", (data) => {
  console.log("📝 Prompt data received:", data);
  
  if (!data || !data.prompt) {
    console.error("❌ Invalid prompt data:", data);
    return;
  }
  
  currentPrompt = data.prompt;
  myPosition = data.position;
  partnerPosition = myPosition === 1 ? 2 : 1;
  
  promptEl.innerHTML = "<strong>Your Prompt</strong>" + currentPrompt;
  console.log("✅ Prompt displayed. Position:", myPosition);
});

socket.on("initiate-webrtc", async (initiator) => {
  console.log("🔗 WebRTC initiating. Initiator:", initiator);
  isInitiator = initiator;
  peerConnection = new RTCPeerConnection(config);

  if (isInitiator) {
    dataChannel = peerConnection.createDataChannel("textChannel");
    setupDataChannel();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("webrtc-offer", { room: roomCode, offer });
    console.log("📤 Offer sent");
  } else {
    peerConnection.ondatachannel = (event) => {
      console.log("📥 DataChannel received");
      dataChannel = event.channel;
      setupDataChannel();
    };
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc-candidate", { room: roomCode, candidate: event.candidate });
    }
  };
});

socket.on("webrtc-offer", async ({ offer }) => {
  console.log("📩 Offer received");
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("webrtc-answer", { room: roomCode, answer });
  console.log("📤 Answer sent");
});

socket.on("webrtc-answer", async ({ answer }) => {
  console.log("📩 Answer received");
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("webrtc-candidate", async ({ candidate }) => {
  if (candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('❌ ICE candidate error', e);
    }
  }
});

joinBtn.onclick = () => {
  roomCode = roomInput.value.trim();
  if (!roomCode) {
    alert("Please enter a room code!");
    return;
  }
  
  console.log("🚪 Joining room:", roomCode);
  socket.emit("join-room", roomCode);
  
  roomView.classList.add("hidden");
  writingView.classList.remove("hidden");
  promptEl.textContent = "Waiting for your partner to join...";
};

submitBtn.onclick = () => {
  myText = myAnswer.value.trim();
  if (!myText) {
    alert("Please write something before sending!");
    return;
  }
  
  if (!isDataChannelReady) {
    alert("Connection not ready. Please wait a moment and try again.");
    console.log("❌ DataChannel not ready. State:", dataChannel?.readyState);
    return;
  }
  
  console.log("✍️ My text:", myText);
  console.log("📍 My position:", myPosition);
  
  try {
    const message = JSON.stringify({ 
      type: 'text', 
      content: myText,
      position: myPosition 
    });
    
    console.log("📤 Sending message:", message);
    dataChannel.send(message);
    
    myAnswer.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Waiting for partner...";
    
    console.log("✅ Message sent successfully");
    showResult();
  } catch (error) {
    console.error("❌ Send error:", error);
    alert("Failed to send message. Please try again.");
  }
};

function setupDataChannel() {
  console.log("⚙️ Setting up DataChannel");
  
  dataChannel.onopen = () => {
    console.log("✅ DataChannel OPEN");
    isDataChannelReady = true;
  };
  
  dataChannel.onclose = () => {
    console.log("❌ DataChannel CLOSED");
    isDataChannelReady = false;
  };
  
  dataChannel.onerror = (error) => {
    console.error("💥 DataChannel error:", error);
  };
  
  dataChannel.onmessage = (event) => {
    console.log("📨 Message received:", event.data);
    
    try {
      const message = JSON.parse(event.data);
      console.log("📦 Parsed message:", message);
      
      if (message.type === 'text') {
        partnerText = message.content;
        console.log("✍️ Partner text saved:", partnerText);
        console.log("🔍 State - myText:", !!myText, "partnerText:", !!partnerText);
        showResult();
      } else if (message.type === 'reset') {
        console.log("🔄 Reset signal received");
        handleRemoteReset();
      }
    } catch (error) {
      console.error("❌ Parse error:", error);
    }
  };
  
  console.log("✅ DataChannel setup complete");
}

function showResult() {
  console.log("🎬 === showResult called ===");
  console.log("   myText:", myText ? `"${myText}"` : "EMPTY");
  console.log("   partnerText:", partnerText ? `"${partnerText}"` : "EMPTY");
  console.log("   myPosition:", myPosition);
  console.log("   storyTemplate:", storyTemplate ? storyTemplate.substring(0, 50) + "..." : "EMPTY");
  
  if (!myText || !partnerText) {
    console.log("⏳ Waiting for both texts");
    return;
  }
  
  if (!storyTemplate) {
    console.log("❌ No template available");
    return;
  }
  
  console.log("✅ Generating story");
  
  let finalStory = storyTemplate;
  if (myPosition === 1) {
    finalStory = finalStory.replace('{answer1}', myText).replace('{answer2}', partnerText);
    console.log("📝 Position 1");
  } else {
    finalStory = finalStory.replace('{answer1}', partnerText).replace('{answer2}', myText);
    console.log("📝 Position 2");
  }
  
  console.log("📖 Final story:", finalStory);
  
  writingView.classList.add("hidden");
  resultPage.classList.remove("hidden");
  
  const poemText = document.getElementById('poemText');
  typewriterEffect(poemText, finalStory);
  
  document.getElementById('writeAnotherBtn').onclick = writeAnother;
  document.getElementById('downloadTxtBtn').onclick = () => downloadAsText(finalStory);
  document.getElementById('downloadImgBtn').onclick = downloadAsImage;
  
  console.log("✅ Story displayed");
}

function typewriterEffect(element, text, speed = 50) {
  element.innerHTML = '';
  let index = 0;
  
  const textSpan = document.createElement('span');
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  
  element.appendChild(textSpan);
  element.appendChild(cursor);
  
  function type() {
    if (index < text.length) {
      textSpan.textContent += text.charAt(index);
      index++;
      setTimeout(type, speed);
    } else {
      cursor.remove();
    }
  }
  
  type();
}

function writeAnother() {
  if (!isDataChannelReady) {
    alert("Connection lost. Please refresh and rejoin the room.");
    return;
  }
  
  console.log("🔄 Initiating reset");
  dataChannel.send(JSON.stringify({ type: 'reset' }));
  resetForNewRound();
}

function handleRemoteReset() {
  console.log("🔄 Handling remote reset");
  resetForNewRound();
}

function resetForNewRound() {
  console.log("🔄 Resetting for new round");
  
  myText = "";
  partnerText = "";
  
  myAnswer.value = "";
  myAnswer.disabled = false;
  submitBtn.disabled = false;
  submitBtn.textContent = "Send";
  
  promptEl.textContent = "Loading new prompt...";
  
  resultPage.classList.add("hidden");
  writingView.classList.remove("hidden");
  
  socket.emit("request-new-prompts", roomCode);
  console.log("✅ Reset complete");
}

function downloadAsText(storyText) {
  const content = "Echo Tale\n\n" + storyText + "\n\n---\nCreated at " + new Date().toLocaleString();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "echo-tale-" + Date.now() + ".txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log("💾 Downloaded as text");
}

function downloadAsImage() {
  if (typeof html2canvas === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => captureAndDownload();
    document.head.appendChild(script);
  } else {
    captureAndDownload();
  }
}

function captureAndDownload() {
  const poemCard = document.querySelector('.poem-card');
  const buttons = document.querySelector('.action-buttons');
  buttons.style.display = 'none';
  
  html2canvas(poemCard, {
    backgroundColor: '#ffffff',
    scale: 2
  }).then(canvas => {
    buttons.style.display = 'flex';
    
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "echo-tale-" + Date.now() + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("💾 Downloaded as image");
    });
  });
}