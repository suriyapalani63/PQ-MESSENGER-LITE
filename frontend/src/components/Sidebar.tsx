import { MessageSquare, Folder, UserCircle, Settings, ShieldCheck, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  activeTab: 'messages' | 'files';
  setActiveTab: (tab: 'messages' | 'files') => void;
  onOpenPeerIdModal: () => void;
}

type NavItem = 
  | { id: 'messages' | 'files'; label: string; icon: typeof MessageSquare; onClick?: undefined }
  | { id: 'peerId'; label: string; icon: typeof MessageSquare; onClick: () => void };

export function Sidebar({ activeTab, setActiveTab, onOpenPeerIdModal }: SidebarProps) {
  const { currentUser, logout } = useAuth();

  const navItems: NavItem[] = [
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'files', label: 'Files', icon: Folder },
    { id: 'peerId', label: 'My Peer ID', icon: UserCircle, onClick: onOpenPeerIdModal },
  ];

  return (
    <div className="w-[250px] bg-bg-sidebar border-r border-border-neon flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-neon-blue" />
          </div>
          <h1 className="text-lg font-bold text-text-main tracking-wide">PQ LITE</h1>
        </div>
        <p className="text-xs text-text-sec uppercase tracking-widest font-medium">Secure Communication</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 mt-4 space-y-2">
        {navItems.map((item) => {
          const isActive = item.id !== 'peerId' && activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-primary/10 text-neon-blue border-l-2 border-neon-blue'
                  : 'text-text-sec hover:bg-white/5 hover:text-text-main border-l-2 border-transparent',
              )}
            >
              <Icon className={clsx('w-5 h-5', isActive ? 'text-neon-blue' : 'text-text-sec')} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 mt-auto">
        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-neon-blue flex items-center justify-center text-white font-bold">
                  {currentUser?.name.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-bg-card" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-text-main truncate max-w-[100px]">
                  {currentUser?.name ?? 'Unknown'}
                </span>
                <span className="text-[10px] text-text-sec uppercase tracking-wider">
                  {currentUser?.peerId ?? '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={logout}
                title="Log out (clear profile)"
                className="text-text-sec hover:text-red-400 transition-colors p-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button className="text-text-sec hover:text-neon-blue transition-colors p-1">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span className="text-xs text-text-sec">Local tab connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
