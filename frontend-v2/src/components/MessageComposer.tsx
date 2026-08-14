import { useState, useRef } from 'react'
import { Paperclip, Send, Lock, Loader2 } from 'lucide-react'
import type { FileAttachment } from '@/types/messaging'
import { formatFileSize } from '@/services/messagingService'
import { generateFileId, storeFile, validateFileName, isAllowedMimeType, MAX_FILE_SIZE } from '@/services/fileStore'

interface MessageComposerProps {
  onSendMessage: (text: string) => void;
  onSendFileMessage: (fileAttachment: FileAttachment) => void;
  disabled: boolean;
}

export function MessageComposer({ onSendMessage, onSendFileMessage, disabled }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clear the input so selecting the same file again works
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!validateFileName(file.name)) {
      alert('Invalid file name.');
      return;
    }
    if (!isAllowedMimeType(file.type)) {
      alert(`File type not allowed: ${file.type || 'Unknown'}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(`File size exceeds 5MB limit. (${formatFileSize(file.size)})`);
      return;
    }

    setIsUploading(true);
    try {
      const fileId = generateFileId();
      await storeFile(fileId, file.name, file.type, file);
      
      const fileAttachment: FileAttachment = {
        fileId,
        name: file.name,
        size: formatFileSize(file.size),
        mimeType: file.type,
        byteSize: file.size,
      };
      
      onSendFileMessage(fileAttachment);
    } catch (err) {
      console.error('Failed to store file:', err);
      alert('Failed to store file locally.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 bg-bg-sidebar border-t border-border-neon z-20 shrink-0">
      <div className="flex items-end gap-4">
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
        />
        
        <button 
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="p-3.5 bg-bg-card border border-white/10 rounded-xl text-text-sec hover:text-neon-blue hover:border-primary/30 transition-colors disabled:opacity-50"
          title="Share a file (max 5MB)"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
        </button>

        <div className="flex-1 bg-bg-card border border-white/10 rounded-xl relative focus-within:border-neon-blue focus-within:ring-1 focus-within:ring-neon-blue transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a secure message..."
            className="w-full bg-transparent p-4 text-[15px] text-text-main placeholder-text-sec resize-none focus:outline-none min-h-[56px] max-h-[150px]"
            rows={1}
          />
          <div className="absolute bottom-2 right-3 text-[10px] text-text-sec">
            {text.length} / 4000
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="h-[56px] px-8 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-glow hover:neon-glow-active"
        >
          SEND <Send className="w-4 h-4" />
        </button>
      </div>
      
      <div className="mt-3 text-center flex flex-col items-center gap-1">
        <span className="text-[11px] text-text-sec font-medium tracking-wide flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3 text-success" />
          Cross-tab demo session active
        </span>
      </div>
    </div>
  )
}
