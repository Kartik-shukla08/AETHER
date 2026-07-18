"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, Conversation } from '../components/Sidebar';
import { ChatWindow, Message } from '../components/ChatWindow';
import { DashboardView } from '../components/DashboardView';
import { SettingsModal, getStoredKeys } from '../components/SettingsModal';
import styles from './page.module.css';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:4000';

export default function Home() {
  const [currentView, setCurrentView] = useState<'chat' | 'dashboard'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSelectConversation = (id: string) => {
    // If active generation is running, abort it before switching chats
    if (isGenerating) {
      handleCancelGeneration();
    }
    setActiveConversationId(id);
  };

  const handleNewConversation = async () => {
    const title = prompt('Enter a title for the new chat:', 'New Chat');
    if (!title || !title.trim()) return;

    try {
      const res = await fetch(`${BACKEND_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (res.ok) {
        const newConv = await res.json();
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        setCurrentView('chat');
      }
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const res = await fetch(`${BACKEND_URL}/conversations/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async (
    content: string,
    provider: string,
    model: string,
    stream: boolean
  ) => {
    if (!activeConversationId) return;

    // Append user message immediately in UI
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content,
      provider,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsGenerating(true);

    // Load API Keys from local storage
    const storedKeys = getStoredKeys();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (storedKeys.openai) headers['x-openai-key'] = storedKeys.openai;
    if (storedKeys.gemini) headers['x-gemini-key'] = storedKeys.gemini;
    if (storedKeys.groq) headers['x-groq-key'] = storedKeys.groq;
    if (storedKeys.grok) headers['x-grok-key'] = storedKeys.grok;
    if (storedKeys.openrouter) headers['x-openrouter-key'] = storedKeys.openrouter;

    const payload = {
      conversationId: activeConversationId,
      provider,
      model,
      messages: [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ],
      stream,
    };

    // Instantiate abort controller for cancellation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete chat generation');
      }

      if (stream) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantReply = '';

        // Append placeholder assistant message
        const tempAssistantId = `temp-assistant-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: tempAssistantId,
            role: 'assistant',
            content: '',
            provider,
            createdAt: new Date().toISOString(),
          },
        ]);

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('data: ')) {
                const dataText = trimmedLine.slice(6).trim();
                if (dataText === '[DONE]') {
                  break;
                }
                try {
                  const parsed = JSON.parse(dataText);
                  if (parsed.text) {
                    assistantReply += parsed.text;
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastIdx = updated.length - 1;
                      if (updated[lastIdx] && updated[lastIdx].id === tempAssistantId) {
                        updated[lastIdx] = { ...updated[lastIdx], content: assistantReply };
                      }
                      return updated;
                    });
                  } else if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                } catch {
                  // Ignore JSON parse errors on partial packet fragments
                }
              }
            }
          }
        }
      } else {
        const data = await res.json();
        // Append actual response
        const newAssistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          provider,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newAssistantMsg]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted client-side');
      } else {
        console.error('Chat error:', err);
        alert(err.message || 'An error occurred during generation.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      // Re-sync with backend to get persisted messages (ensuring correct IDs/timestamps)
      if (activeConversationId) {
        fetchMessages(activeConversationId);
        fetchConversations(); // Update timestamps on sidebar items
      }
    }
  };

  const handleCancelGeneration = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);

    if (activeConversationId) {
      try {
        await fetch(`${BACKEND_URL}/chat/cancel`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationId: activeConversationId }),
        });
      } catch (err) {
        console.error('Failed to notify backend of generation cancellation:', err);
      }
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        currentView={currentView}
        onChangeView={setCurrentView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className={styles.mainContent}>
        {currentView === 'chat' ? (
          <ChatWindow
            conversationId={activeConversationId}
            messages={messages}
            isGenerating={isGenerating}
            onSendMessage={handleSendMessage}
            onCancelGeneration={handleCancelGeneration}
          />
        ) : (
          <DashboardView />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
