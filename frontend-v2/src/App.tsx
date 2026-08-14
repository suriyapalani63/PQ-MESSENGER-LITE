/**
 * App.tsx — Root application component.
 *
 * ⚠️  LOCAL FRONTEND PROTOTYPE.
 *   • Wraps the app in AuthProvider → ChatProvider.
 *   • Shows ProfileSetup when no profile exists.
 *   • All state flows through React contexts, not static mock data.
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { Sidebar } from '@/components/Sidebar';
import { ConversationList } from '@/components/ConversationList';
import { ChatArea } from '@/components/ChatArea';
import { MessageComposer } from '@/components/MessageComposer';
import { SecurityModal } from '@/components/Modals/SecurityModal';
import { PeerIdModal } from '@/components/Modals/PeerIdModal';
import { NewChatModal } from '@/components/Modals/NewChatModal';
import { ProfileSetup } from '@/components/ProfileSetup';
import { ShieldCheck, Loader2 } from 'lucide-react';

function AppShell() {
    const { currentUser, isLoading: authLoading, cryptoStatus } = useAuth();
  const {
    peers,
    activePeerId,
    activeMessages,
    isLoading: chatLoading,
    setActivePeerId,
    sendMessage,
    sendFileMessage,
  } = useChat();

  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showPeerIdModal, setShowPeerIdModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // ── Loading state ────────────────────────────────────────────────
  if (authLoading || chatLoading || cryptoStatus === 'initializing') {
    return (
      <div className="flex h-screen bg-bg-base text-text-main font-sans items-center justify-center min-w-[1200px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
          <span className="text-text-sec text-sm tracking-wider uppercase">
            Loading profile & cryptography...
          </span>
        </div>
      </div>
    );
  }

  if (cryptoStatus === 'failed') {
    return (
      <div className="flex h-screen bg-bg-base text-text-main font-sans items-center justify-center min-w-[1200px]">
        <div className="flex flex-col items-center gap-4 text-red-400 max-w-md text-center">
          <ShieldCheck className="w-12 h-12" />
          <h2 className="text-xl font-bold">Cryptography Error</h2>
          <p className="text-sm opacity-80">
            Failed to initialize the post-quantum cryptography module. 
            Ensure your browser supports WebAssembly and the module is correctly built.
          </p>
        </div>
      </div>
    );
  }

  // ── No profile → show setup ──────────────────────────────────────
  if (!currentUser) {
    return <ProfileSetup />;
  }

  const activePeer = peers.find((p) => p.id === activePeerId) ?? null;

  const handleSendMessage = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="flex h-screen bg-bg-base text-text-main font-sans overflow-hidden min-w-[1200px] flex-col">
      {/* Cross-tab Demo Banner */}
      <div className="bg-success/20 border-b border-success/30 text-center py-1.5 px-4 text-xs font-medium text-success tracking-wide flex items-center justify-center gap-2 z-50">
        <ShieldCheck className="w-3.5 h-3.5" />
        Crypto self-test passed — Real PQC (ML-KEM / ML-DSA) active!
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenPeerIdModal={() => setShowPeerIdModal(true)}
        />

      {activeTab === 'messages' && (
        <ConversationList
          activePeerId={activePeerId}
          onSelectPeer={setActivePeerId}
          onNewChat={() => setShowNewChatModal(true)}
        />
      )}

      {/* Main Chat Area */}
      {activeTab === 'messages' ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <ChatArea
            activePeer={activePeer}
            messages={activeMessages}
            onOpenSecurityDetails={() => setShowSecurityModal(true)}
          />
          {activePeer && (
            <MessageComposer
              disabled={false}
              onSendMessage={handleSendMessage}
              onSendFileMessage={sendFileMessage}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 bg-bg-base flex flex-col items-center justify-center bg-grid-pattern">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 neon-glow">
            <ShieldCheck className="w-8 h-8 text-neon-blue" />
          </div>
          <h2 className="text-2xl font-bold text-text-sec">
            File Manager (Coming Soon)
          </h2>
          <p className="text-text-sec/60 text-sm mt-2">
            Encrypted file sharing will be available in a future release.
          </p>
        </div>
      )}

      {/* Modals */}
      {showSecurityModal && activePeer && (
        <SecurityModal
          peer={activePeer}
          onClose={() => setShowSecurityModal(false)}
        />
      )}

      {showPeerIdModal && (
        <PeerIdModal onClose={() => setShowPeerIdModal(false)} />
      )}

      {showNewChatModal && (
        <NewChatModal onClose={() => setShowNewChatModal(false)} />
      )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <AppShell />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
