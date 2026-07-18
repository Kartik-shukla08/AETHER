import React from 'react';
import { MessageSquare, BarChart2, Plus, Trash2, Settings, Terminal } from 'lucide-react';
import styles from './Sidebar.module.css';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  currentView: 'chat' | 'dashboard';
  onChangeView: (view: 'chat' | 'dashboard') => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  currentView,
  onChangeView,
  onOpenSettings,
}) => {
  return (
    <aside className={styles.sidebar}>
      {/* Brand Header */}
      <div className={styles.brand}>
        <Terminal className={styles.brandIcon} />
        <h1>AETHER</h1>
        <span className={styles.badge}>v1.0</span>
      </div>

      {/* Main Navigation */}
      <nav className={styles.nav}>
        <button
          className={`${styles.navItem} ${currentView === 'chat' ? styles.activeNav : ''}`}
          onClick={() => onChangeView('chat')}
        >
          <MessageSquare size={18} />
          <span>Chat Console</span>
        </button>
        <button
          className={`${styles.navItem} ${currentView === 'dashboard' ? styles.activeNav : ''}`}
          onClick={() => onChangeView('dashboard')}
        >
          <BarChart2 size={18} />
          <span>Telemetry Dashboard</span>
        </button>
      </nav>

      {/* Divider */}
      <div className={styles.divider}>
        <span>Conversations</span>
      </div>

      {/* Chat Lists */}
      <div className={styles.conversationSection}>
        <button className={styles.newChatBtn} onClick={onNewConversation}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>

        <div className={styles.conversationsList}>
          {conversations.length === 0 ? (
            <div className={styles.emptyState}>No chats yet</div>
          ) : (
            conversations.map((chat) => (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${
                  activeConversationId === chat.id && currentView === 'chat' ? styles.activeChat : ''
                }`}
                onClick={() => {
                  onChangeView('chat');
                  onSelectConversation(chat.id);
                }}
              >
                <span className={styles.chatTitle} title={chat.title}>
                  {chat.title}
                </span>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => onDeleteConversation(chat.id, e)}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings Footer */}
      <div className={styles.footer}>
        <button className={styles.settingsBtn} onClick={onOpenSettings}>
          <Settings size={18} />
          <span>API Credentials</span>
        </button>
      </div>
    </aside>
  );
};
