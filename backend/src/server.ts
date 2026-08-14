/**
 * PQ Messenger Backend Server
 * WebSocket relay and WebRTC signaling server
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { UserManager } from './services/UserManager';
import { MessageRelay } from './services/MessageRelay';
import { CallSignaling } from './services/CallSignaling';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) // trim and remove trailing slash
  : ['http://localhost:3001'];

// Force-add frontend origins to prevent any further issues
allowedOrigins.push('http://localhost:5173', 'http://192.168.56.1:5173', 'http://10.130.97.178:5173', 'https://pq-messenger-lite.netlify.app');

console.log('[CORS] Allowed Origins initialized as:', allowedOrigins);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected origin: '${origin}'`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Services
const userManager = new UserManager();
const messageRelay = new MessageRelay();
const callSignaling = new CallSignaling(userManager);

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedUsers: userManager.getOnlineUserCount()
  });
});

app.get('/api/users/online', (req, res) => {
  res.json({
    count: userManager.getOnlineUserCount(),
    users: userManager.getOnlineUsers()
  });
});

// WebSocket connection handling
io.on('connection', (socket: Socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // User registration
  socket.on('register', async (data: { userId: string; publicKeys: any }) => {
    try {
      const { userId, publicKeys } = data;

      userManager.registerUser(userId, socket.id, publicKeys);

      socket.emit('registered', {
        success: true,
        userId,
        onlineUsers: userManager.getOnlineUsers()
      });

      // Notify other users
      socket.broadcast.emit('user-online', {
        userId,
        publicKeys
      });

      logger.info(`User registered: ${userId}`);
    } catch (error) {
      logger.error('Registration error:', error);
      socket.emit('error', { message: 'Registration failed' });
    }
  });

  // Message relay
  socket.on('send-message', async (message: any) => {
    try {
      const recipientSocketId = userManager.getSocketId(message.recipient);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive-message', message);

        // Send delivery receipt
        socket.emit('message-delivered', {
          messageId: message.id,
          timestamp: Date.now()
        });

        logger.info(`Message relayed: ${message.id} from ${message.sender} to ${message.recipient}`);
      } else {
        // Recipient offline - in production, queue the message
        socket.emit('message-failed', {
          messageId: message.id,
          reason: 'recipient-offline'
        });

        logger.warn(`Message failed - recipient offline: ${message.recipient}`);
      }
    } catch (error) {
      logger.error('Message relay error:', error);
      socket.emit('error', { message: 'Message delivery failed' });
    }
  });

  // File transfer signaling
  socket.on('send-file-offer', async (offer: any) => {
    try {
      const recipientSocketId = userManager.getSocketId(offer.recipient);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive-file-offer', offer);
        logger.info(`File offer sent: ${offer.fileName} to ${offer.recipient}`);
      }
    } catch (error) {
      logger.error('File offer error:', error);
    }
  });

  socket.on('file-answer', async (answer: any) => {
    try {
      const senderSocketId = userManager.getSocketId(answer.senderId);

      if (senderSocketId) {
        io.to(senderSocketId).emit('file-answer-received', answer);
      }
    } catch (error) {
      logger.error('File answer error:', error);
    }
  });

  // WebRTC call signaling
  socket.on('call-offer', async (offer: any) => {
    try {
      const result = await callSignaling.handleCallOffer(offer, socket.id);

      if (result.success && result.recipientSocketId) {
        io.to(result.recipientSocketId).emit('incoming-call', offer);
        logger.info(`Call offer: ${offer.callerId} → ${offer.recipientId}`);
      } else {
        socket.emit('call-failed', {
          sessionId: offer.sessionId,
          reason: result.reason
        });
      }
    } catch (error) {
      logger.error('Call offer error:', error);
      socket.emit('error', { message: 'Call setup failed' });
    }
  });

  socket.on('call-answer', async (answer: any) => {
    try {
      const callerSocketId = callSignaling.getCallerSocket(answer.sessionId);

      if (callerSocketId) {
        io.to(callerSocketId).emit('call-answered', answer);
        logger.info(`Call answered: session ${answer.sessionId}`);
      }
    } catch (error) {
      logger.error('Call answer error:', error);
    }
  });

  socket.on('ice-candidate', async (candidate: any) => {
    try {
      const peerSocketId = callSignaling.getPeerSocket(candidate.sessionId, socket.id);

      if (peerSocketId) {
        io.to(peerSocketId).emit('ice-candidate', candidate);
      }
    } catch (error) {
      logger.error('ICE candidate error:', error);
    }
  });

  socket.on('end-call', async (data: { sessionId: string }) => {
    try {
      const peerSocketId = callSignaling.getPeerSocket(data.sessionId, socket.id);

      if (peerSocketId) {
        io.to(peerSocketId).emit('call-ended', data);
      }

      callSignaling.endCall(data.sessionId);
      logger.info(`Call ended: session ${data.sessionId}`);
    } catch (error) {
      logger.error('End call error:', error);
    }
  });

  // Typing indicators
  socket.on('typing-start', (data: { userId: string; recipientId: string }) => {
    const recipientSocketId = userManager.getSocketId(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', { userId: data.userId });
    }
  });

  socket.on('typing-stop', (data: { userId: string; recipientId: string }) => {
    const recipientSocketId = userManager.getSocketId(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-stopped-typing', { userId: data.userId });
    }
  });

  // Presence
  socket.on('update-status', (data: { userId: string; status: string }) => {
    userManager.updateUserStatus(data.userId, data.status);
    socket.broadcast.emit('user-status-changed', data);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const userId = userManager.getUserBySocketId(socket.id);

    if (userId) {
      userManager.removeUser(userId);

      // Notify others
      socket.broadcast.emit('user-offline', { userId });

      // End any active calls
      callSignaling.handleUserDisconnect(socket.id);

      logger.info(`User disconnected: ${userId}`);
    } else {
      logger.info(`Client disconnected: ${socket.id}`);
    }
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`PQ Messenger server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, io, httpServer };
