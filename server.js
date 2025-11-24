const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const storyTemplates = [
  {
    structure: "Scientists have discovered that {answer1} is the leading cause of {answer2}. More research is needed.",
    prompts: [
      "What's something you do every day? (Example: 'drinking coffee' or 'checking my phone' or 'talking to myself')",
      "Name random absurd thing in noun phrase format(Example: 'a cat with human eyebrows' or 'asking pigeons for relationship advice' or 'sarguing with a toaster about life choices')"
    ]
  },
  {
    structure: "They say you can't put {answer1} into {answer2}, but I've been doing it for years.",
    prompts: [
      "Describe the first thing you see when you wake up. Format: noun phrase. Example: 'my cat's sleepy face'",
      "Name a food or drink you like (Example: 'pickles' or 'strawberry milk' or 'cold pizza')",
    ]
  }

];

app.use(express.static('public'));

const roomTemplates = new Map();

io.on('connection', (socket) => {
  console.log('✅ A user connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`🚪 User ${socket.id} joined room ${room}`);

    const roomObj = io.sockets.adapter.rooms.get(room);
    const size = roomObj ? roomObj.size : 0;
    console.log(`👥 Room ${room} now has ${size} users`);

    if (size === 2) {
      const clients = [...io.sockets.adapter.rooms.get(room)];
      console.log(`🎮 Starting game for room ${room} with clients:`, clients);
      
      io.to(clients[0]).emit('initiate-webrtc', true);   
      io.to(clients[1]).emit('initiate-webrtc', false);  

      sendTemplatePrompts(room, clients);
    }
  });

  socket.on('request-new-prompts', (room) => {
    console.log(`🔄 Request for new prompts in room ${room}`);
    const clients = [...io.sockets.adapter.rooms.get(room) || []];
    if (clients.length === 2) {
      sendTemplatePrompts(room, clients);
    }
  });

  socket.on("webrtc-offer", ({ room, offer }) => {
    socket.to(room).emit("webrtc-offer", { offer });
  });

  socket.on("webrtc-answer", ({ room, answer }) => {
    socket.to(room).emit("webrtc-answer", { answer });
  });

  socket.on("webrtc-candidate", ({ room, candidate }) => {
    socket.to(room).emit("webrtc-candidate", { candidate });
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

function sendTemplatePrompts(room, clients) {
  const template = storyTemplates[Math.floor(Math.random() * storyTemplates.length)];
  
  roomTemplates.set(room, template);
  
  console.log(`📜 Selected template for room ${room}:`);
  console.log(`   Structure: ${template.structure.substring(0, 60)}...`);
  
  io.to(room).emit('receive-template', template.structure);
  console.log(`   ✅ Sent template structure to room`);
  
  const promptData1 = {
    prompt: template.prompts[0],
    position: 1
  };
  
  const promptData2 = {
    prompt: template.prompts[1],
    position: 2
  };
  
  io.to(clients[0]).emit('receive-prompt', promptData1);
  io.to(clients[1]).emit('receive-prompt', promptData2);
  
  console.log(`   ✅ Sent prompt to client 1 (${clients[0]}):`, promptData1);
  console.log(`   ✅ Sent prompt to client 2 (${clients[1]}):`, promptData2);
}

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log('🚀 Echo Tale server running on http://localhost:' + PORT);
  console.log('📝 Server has', storyTemplates.length, 'story templates loaded');
});