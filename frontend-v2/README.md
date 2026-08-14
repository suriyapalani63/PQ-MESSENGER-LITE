# PQ Messenger Lite — Frontend v2

> **⚠️ LOCAL FRONTEND PROTOTYPE — UI-ONLY PHASE**

This is a **local browser prototype** of PQ Messenger Lite. It demonstrates the user interface and interaction flow for a post-quantum-ready secure messenger. **No real cryptography, networking, or cross-browser messaging is implemented.**

---

## Current Status

| Feature | Status |
|---|---|
| Dynamic profile creation (Peer ID + fingerprint) | ✅ Implemented (local only) |
| Add peers by Peer ID | ✅ Implemented (local only) |
| Send & receive text messages | ✅ Local UI simulation only |
| localStorage persistence | ✅ Messages, peers, profile |
| Three-column neon desktop UI | ✅ Implemented |
| ML-KEM post-quantum encryption | ❌ Not implemented |
| Real-time cross-browser messaging | ❌ Not implemented |
| Node.js / MongoDB backend | ❌ Not implemented |
| Socket.IO real-time transport | ❌ Not implemented |
| Peer authentication / verification | ❌ Not implemented |

## Important Disclaimers

1. **No real encryption.** Key fingerprints displayed in the UI are randomly generated demo strings. Actual ML-KEM key encapsulation is not performed.
2. **No cross-browser messaging.** Two separate browser tabs or devices **cannot** exchange messages. All data lives in a single browser's `localStorage`.
3. **Mock service only.** The `messagingService.ts` file is a localStorage wrapper, not a real network service. It does not connect to any server.
4. **Demo fingerprints.** All fingerprints shown are random hex strings for UI demonstration purposes only.

## Future Integration Plan

The next phase will integrate:

- **Node.js + Express** backend for REST APIs and session management.
- **MongoDB** for persistent storage of users, conversations, and messages.
- **Socket.IO** for real-time bidirectional message delivery.
- **ML-KEM (CRYSTALS-Kyber)** for post-quantum key encapsulation.
- **Symmetric ratchet** for forward-secret message encryption.

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install & Run

```bash
cd frontend-v2
npm install
npm run dev
```

The dev server will start at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
frontend-v2/src/
├── contexts/
│   ├── AuthContext.tsx        # User profile state (localStorage)
│   └── ChatContext.tsx         # Peers & messages state (localStorage)
├── services/
│   └── messagingService.ts    # Mock localStorage service (NOT real networking)
├── components/
│   ├── ProfileSetup.tsx       # First-run profile creation screen
│   ├── Sidebar.tsx            # Left navigation sidebar
│   ├── ConversationList.tsx   # Peer conversation list (column 2)
│   ├── ChatArea.tsx           # Message display area (column 3)
│   ├── MessageComposer.tsx    # Message input bar
│   └── Modals/
│       ├── NewChatModal.tsx   # Add peer by Peer ID with validation
│       ├── PeerIdModal.tsx    # View own Peer ID and fingerprint
│       └── SecurityModal.tsx  # Mock session security details
├── types/
│   └── messaging.ts           # Canonical TypeScript type definitions
├── lib/
│   └── mockData.ts            # Deprecated re-export barrel (types only)
├── App.tsx                    # Root component with context providers
├── main.tsx                   # React entry point
└── index.css                  # Tailwind + custom styles
```

## localStorage Keys

All keys are namespaced with `pq_`:

| Key | Description |
|---|---|
| `pq_current_user` | Current user profile JSON |
| `pq_peers_<peerId>` | Peer list for a given user |
| `pq_messages_<peerId1>_<peerId2>` | Messages for a conversation |

## License

Private — All rights reserved.
