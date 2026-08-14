# PQ Messenger Lite 🛡️

A real-time, quantum-resistant end-to-end encrypted messaging platform. 

PQ Messenger Lite is a modern chat application designed to protect user privacy against both classical and future quantum-computing threats. While most modern secure messengers rely on algorithms like RSA or Elliptic Curves (which are vulnerable to Shor's algorithm on a quantum computer), this project implements state-of-the-art **Post-Quantum Cryptography (PQC)** standardized by NIST.

The application guarantees that your data is safe from "Harvest Now, Decrypt Later" attacks by ensuring that the server only acts as a blind relay and never sees plaintext data or private keys.

---

## ✨ Core Features & Technical Achievements

1. **Post-Quantum Key Exchange (ML-KEM-768)**
   Uses NIST's official Module-Lattice-Based Key Encapsulation Mechanism to securely establish shared cryptographic secrets across devices.
   
2. **Post-Quantum Signatures (ML-DSA-65)**
   Authenticates every single message using NIST's Module-Lattice-Based Digital Signature Algorithm, ensuring that no one can tamper with or spoof messages over the network.

3. **End-to-End Encryption (E2EE)**
   Uses HKDF (HMAC-based Key Derivation Function) to derive secure session keys, and AES-GCM to encrypt message payloads and files directly in the browser. 

4. **Real-Time Network Routing**
   Powered by a robust Node.js and Socket.IO backend that handles live peer discovery, presence tracking (online/offline status), and precise delivery receipts without ever storing the messages.

5. **Smart Transport Abstraction**
   The frontend is engineered with a dynamic transport layer that can seamlessly switch between `BroadcastChannel` (for instant local-tab testing) and `Socket.IO` (for real cross-device communication over Wi-Fi/Internet).

---

## 🏗️ Architecture & Tech Stack

- **Frontend (`frontend-v2/`)**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend (`backend/`)**: Node.js, Express, Socket.IO.
- **Cryptography**: `@oqs/liboqs-js` (Open Quantum Safe library compiled to WebAssembly) and the native Web Crypto API.

### Project Structure

```text
pq-messenger-lite/
├── backend/                  # Node.js + Socket.IO Relay Server
│   ├── src/
│   │   ├── services/         # UserManager, CallSignaling
│   │   └── server.ts         # Socket.IO Event Handlers
│   └── package.json
└── frontend-v2/              # React + Vite Web Application
    ├── src/
    │   ├── components/       # ChatArea, Sidebar, UI Elements
    │   ├── contexts/         # AuthContext, ChatContext (State & PQC wiring)
    │   ├── crypto/           # AES-GCM, HKDF, OQS Adapters, Session Store
    │   ├── services/         # Transport layer (Socket.IO + BroadcastChannel)
    │   └── types/            # TypeScript interfaces
    └── package.json
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Start the Backend
Open a terminal and run the backend relay server:
```bash
cd backend
npm install
npm run dev
```

### 2. Start the Frontend
Open a second terminal and run the React application:
```bash
cd frontend-v2
npm install
npm run dev
```
---

## 🔒 Security Disclaimer
This project was developed rapidly as an MVP for a hackathon. While it accurately utilizes NIST-standardized PQC libraries (`liboqs-js`), it has not been audited by security professionals and should not be used in production environments for highly sensitive data.
