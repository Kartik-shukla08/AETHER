import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Play, Sparkles, AlertCircle, Copy, Check } from 'lucide-react';
import styles from './ChatWindow.module.css';

export interface Message {
  id: string;
  role: string;
  content: string;
  provider?: string | null;
  createdAt: string;
}

interface ChatWindowProps {
  conversationId: string | null;
  messages: Message[];
  isGenerating: boolean;
  onSendMessage: (content: string, provider: string, model: string, stream: boolean) => void;
  onCancelGeneration: () => void;
}

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'groq', label: 'Groq' },
  { id: 'grok', label: 'x.AI Grok' },
  { id: 'openrouter', label: 'OpenRouter' },
];

interface ModelOption {
  id: string;
  name: string;
}

const DEFAULT_MODELS: Record<string, ModelOption[]> = {
  openai: [
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 (Sol)' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 (Terra)' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 (Luna)' },
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o3', name: 'o3' },
    { id: 'o3-mini', name: 'o3 Mini' },
    { id: 'o4-mini', name: 'o4 Mini' }
  ],
  gemini: [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
  ],
  grok: [
    { id: 'grok-4.20', name: 'Grok 4.20' },
    { id: 'grok-4', name: 'Grok 4' },
    { id: 'grok-4-fast', name: 'Grok 4 Fast' },
    { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast' },
    { id: 'grok-code-fast', name: 'Grok Code Fast' },
    { id: 'grok-3', name: 'Grok 3' },
    { id: 'grok-3-mini', name: 'Grok 3 Mini' },
    { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast' },
    { id: 'grok-2', name: 'Grok 2' },
    { id: 'grok-2-vision', name: 'Grok 2 Vision' }
  ],
  groq: [
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B' },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill' },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B' }
  ],
  openrouter: [
    { id: 'openai/gpt-5', name: 'GPT-5' },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
    { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4' },
    { id: 'x-ai/grok-4', name: 'Grok 4' },
    { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
    { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek V3' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' },
    { id: 'mistralai/mistral-large', name: 'Mistral Large' },
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B' }
  ]
};

// A lightweight, robust regex-based Markdown renderer for React 19
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!content) return null;

  // Split by code blocks: ```lang\ncode\n```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={styles.mdContainer}>
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : '';
          const code = match ? match[2].trim() : part.slice(3, -3).trim();

          return (
            <div key={index} className={styles.codeBlockContainer}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLanguage}>{lang || 'code'}</span>
                <button
                  onClick={() => copyToClipboard(code, index)}
                  className={styles.copyBtn}
                  title="Copy code"
                >
                  {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className={styles.pre}>
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Handle inline formatting (bold, inline code, newlines)
        const lines = part.split('\n');
        return (
          <div key={index} className={styles.textBlock}>
            {lines.map((line, lineIdx) => {
              // Check if line is an unordered list item
              if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                const listText = line.replace(/^[\s]*[-*]\s/, '');
                return (
                  <ul key={lineIdx} className={styles.list}>
                    <li>{parseInlineMarkdown(listText)}</li>
                  </ul>
                );
              }

              // Normal text line
              return (
                <p key={lineIdx} className={styles.paragraph}>
                  {parseInlineMarkdown(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// Parse bold (**text**) and inline code (`code`)
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split by bold patterns: **bold** or inline code `code`
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={i} className={styles.inlineCode}>{token.slice(1, -1)}</code>;
    }
    return token;
  });
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  messages,
  isGenerating,
  onSendMessage,
  onCancelGeneration,
}) => {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('');
  
  // Custom models dictionary loaded per provider
  const [customModels, setCustomModels] = useState<Record<string, string>>({
    openai: '',
    gemini: '',
    groq: '',
    grok: '',
    openrouter: '',
  });

  // Toggle state per provider for using custom model name
  const [useCustomModel, setUseCustomModel] = useState<Record<string, boolean>>({
    openai: false,
    gemini: false,
    groq: false,
    grok: false,
    openrouter: false,
  });

  const [stream, setStream] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load custom models and toggle state from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCustom = localStorage.getItem('llm_logging_custom_models');
        if (storedCustom) {
          setCustomModels(JSON.parse(storedCustom));
        }
        const storedUseCustom = localStorage.getItem('llm_logging_use_custom_model');
        if (storedUseCustom) {
          setUseCustomModel(JSON.parse(storedUseCustom));
        }
      } catch (err) {
        console.error('Failed to load local storage configurations:', err);
      }
    }
  }, []);

  const updateCustomModel = (prov: string, val: string) => {
    setCustomModels((prev) => {
      const updated = { ...prev, [prov]: val };
      if (typeof window !== 'undefined') {
        localStorage.setItem('llm_logging_custom_models', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const updateUseCustomModel = (prov: string, val: boolean) => {
    setUseCustomModel((prev) => {
      const updated = { ...prev, [prov]: val };
      if (typeof window !== 'undefined') {
        localStorage.setItem('llm_logging_use_custom_model', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Set default model on provider change
  useEffect(() => {
    if (!useCustomModel[provider]) {
      const models = DEFAULT_MODELS[provider] || [];
      if (models.length > 0) {
        setModel(models[0].id);
      }
    }
  }, [provider, useCustomModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || !conversationId) return;

    const selectedModel = useCustomModel[provider]
      ? (customModels[provider] || '').trim()
      : model;
    if (!selectedModel) return;

    onSendMessage(input.trim(), provider, selectedModel, stream);
    setInput('');
  };

  if (!conversationId) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyCard}>
          <Sparkles className={styles.emptyIcon} size={48} />
          <h2>Welcome to Aether Chat</h2>
          <p>
            Create or select a conversation in the sidebar to get started. Make sure to configure your API keys in the bottom settings panel.
          </p>
        </div>
      </div>
    );
  }

  const activeModels = DEFAULT_MODELS[provider] || [];

  return (
    <div className={styles.chatWindow}>
      {/* Messages Scroll Area */}
      <div className={styles.messagesArea}>
        {messages.length === 0 && !isGenerating ? (
          <div className={styles.welcomeText}>
            <p>This is the start of a new conversation. Ask anything!</p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.messageRow} ${
                  msg.role === 'user' ? styles.userRow : styles.assistantRow
                }`}
              >
                <div className={styles.messageBubble}>
                  <div className={styles.bubbleHeader}>
                    <span className={styles.senderName}>
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    {msg.provider && (
                      <span className={styles.providerTag}>{msg.provider}</span>
                    )}
                  </div>
                  <div className={styles.bubbleContent}>
                    <MarkdownContent content={msg.content} />
                  </div>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className={`${styles.messageRow} ${styles.assistantRow} ${styles.pulse}`}>
                <div className={styles.messageBubble}>
                  <div className={styles.bubbleHeader}>
                    <span className={styles.senderName}>Assistant</span>
                    <span className={styles.streamingTag}>Streaming...</span>
                  </div>
                  <div className={styles.bubbleContent}>
                    <div className={styles.cursor}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Control Panel / Form Area */}
      <div className={styles.inputArea}>
        <form onSubmit={handleSend} className={styles.inputForm}>
          {/* Top Bar inside input form for Provider & Model configuration */}
          <div className={styles.configBar}>
            <div className={styles.selectGroup}>
              <label>Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                }}
                disabled={isGenerating}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.selectGroup}>
              <label>Model</label>
              {useCustomModel[provider] ? (
                <input
                  type="text"
                  placeholder="e.g. gpt-4-turbo"
                  value={customModels[provider] || ''}
                  onChange={(e) => updateCustomModel(provider, e.target.value)}
                  className={styles.customModelInput}
                  disabled={isGenerating}
                />
              ) : (
                <select
                  value={model}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      updateUseCustomModel(provider, true);
                    } else {
                      setModel(e.target.value);
                    }
                  }}
                  disabled={isGenerating}
                >
                  {activeModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  <option value="custom">Custom Model Name...</option>
                </select>
              )}
            </div>

            {useCustomModel[provider] && (
              <button
                type="button"
                className={styles.resetModelBtn}
                onClick={() => updateUseCustomModel(provider, false)}
                disabled={isGenerating}
              >
                Use Preset
              </button>
            )}

            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="stream"
                checked={stream}
                onChange={(e) => setStream(e.target.checked)}
                disabled={isGenerating}
              />
              <label htmlFor="stream">Stream tokens</label>
            </div>
          </div>

          {/* Actual text input field & actions */}
          <div className={styles.textAreaRow}>
            <input
              type="text"
              placeholder={isGenerating ? "Streaming in progress..." : "Type your message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isGenerating}
              className={styles.textInput}
            />

            {isGenerating ? (
              <button
                type="button"
                onClick={onCancelGeneration}
                className={styles.cancelBtn}
                title="Cancel generation"
              >
                <Square size={16} fill="white" />
                <span>Cancel</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className={styles.sendBtn}
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
