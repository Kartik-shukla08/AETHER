import React, { useState, useEffect } from 'react';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ApiKeys {
  openai: string;
  gemini: string;
  groq: string;
  grok: string;
  openrouter: string;
}

export const getStoredKeys = (): ApiKeys => {
  if (typeof window === 'undefined') {
    return { openai: '', gemini: '', groq: '', grok: '', openrouter: '' };
  }
  try {
    const keys = localStorage.getItem('llm_logging_keys');
    return keys ? JSON.parse(keys) : { openai: '', gemini: '', groq: '', grok: '', openrouter: '' };
  } catch {
    return { openai: '', gemini: '', groq: '', grok: '', openrouter: '' };
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<ApiKeys>({
    openai: '',
    gemini: '',
    groq: '',
    grok: '',
    openrouter: '',
  });
  const [copiedEnv, setCopiedEnv] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys(getStoredKeys());
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('llm_logging_keys', JSON.stringify(keys));
    onClose();
  };

  const handleKeyChange = (provider: keyof ApiKeys, val: string) => {
    setKeys((prev) => ({
      ...prev,
      [provider]: val,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Provider Credentials</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.body}>
          <p className={styles.infoText}>
            API keys are saved locally in your browser storage and are sent as authorization headers directly to your local backend API. They never leave your system.
          </p>

          <div className={styles.formGroup}>
            <label>OpenAI API Key</label>
            <input
              type="password"
              placeholder="sk-proj-..."
              value={keys.openai}
              onChange={(e) => handleKeyChange('openai', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Google Gemini API Key</label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={keys.gemini}
              onChange={(e) => handleKeyChange('gemini', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Groq API Key</label>
            <input
              type="password"
              placeholder="gsk_..."
              value={keys.groq}
              onChange={(e) => handleKeyChange('groq', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>x.AI Grok API Key</label>
            <input
              type="password"
              placeholder="xai-..."
              value={keys.grok}
              onChange={(e) => handleKeyChange('grok', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>OpenRouter API Key</label>
            <input
              type="password"
              placeholder="sk-or-..."
              value={keys.openrouter}
              onChange={(e) => handleKeyChange('openrouter', e.target.value)}
            />
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save Keys</button>
        </div>
      </div>
    </div>
  );
};
