import React, { useState, useEffect } from 'react';
import './App.css';
import io from 'socket.io-client';

function App() {
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

 useEffect(() => {
  try {
    const newSocket = io('http://localhost:5000', {
      autoConnect: false
    });

    newSocket.connect();

    newSocket.on('connect', () => {
      console.log('Connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  } catch (err) {
    console.log('Socket error:', err);
  }
}, []);

  const handleRegister = () => {
    if (userId && socket) {
      socket.emit('register', {
        userId: userId,
        publicKeys: {
          kemPublicKey: 'demo-kem-key',
          dsaPublicKey: 'demo-dsa-key'
        }
      });
      alert('Registered as: ' + userId);
    }
  };

  const handleSendMessage = () => {
    if (message && recipientId && socket) {
      const msg = {
        id: Date.now().toString(),
        type: 'text',
        sender: userId,
        recipient: recipientId,
        timestamp: Date.now(),
        encryptedContent: btoa(message),
        encapsulatedKey: 'demo-key',
        iv: 'demo-iv',
        authTag: 'demo-tag'
      };

      socket.emit('send-message', msg);
      
      setMessages(prev => [...prev, {
        sender: userId,
        content: message,
        timestamp: new Date()
      }]);
      
      setMessage('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔐 PQ Messenger</h1>
        <div className={`status ` + (connected ? 'online' : 'offline')}>
          {connected ? '🟢 Connected' : '🔴 Offline'}
        </div>
      </header>

      <div className="container">
        {!userId ? (
          <div className="login-section">
            <h2>Register</h2>
            <input
              type="text"
              placeholder="Enter your user ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
            />
            <button onClick={handleRegister} disabled={!connected}>
              Register
            </button>
          </div>
        ) : (
          <div className="chat-section">
            <div className="chat-header">
              <h3>Logged in as: {userId}</h3>
              <button onClick={() => setUserId('')}>Logout</button>
            </div>

            <div className="recipient-section">
              <input
                type="text"
                placeholder="Recipient ID"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
              />
            </div>

            <div className="messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message ` + (msg.sender === userId ? 'sent' : 'received')}
                >
                  <div className="message-header">
                    <strong>{msg.sender}</strong>
                    <span className="time">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
            </div>

            <div className="input-section">
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleSendMessage} disabled={!recipientId}>
                Send 🔒
              </button>
            </div>
          </div>
        )}
      </div>

      <footer>
        <p>Post-Quantum Encrypted Messaging</p>
      </footer>
    </div>
  );
}
export default App;

