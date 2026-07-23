import React, {useEffect, useRef, useState} from 'react';

import styles from './AiAssistant.module.css';

interface Message {
  role: 'assistant' | 'user';
  text: string;
}

const WELCOME: Message = {
  role: 'assistant',
  text:
    "Hi! I'm your AI Assistant. Ask me about your code and I'll help you " +
    'think it through.',
};

/**
 * AI Assistant panel — visual/UX preview only.
 *
 * This is intentionally NOT wired to a model yet: sending a message echoes it
 * into the thread and returns a fixed placeholder reply so the interaction
 * feels real while the backend is still to come.
 */
export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({top: threadRef.current.scrollHeight});
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages(prev => [
      ...prev,
      {role: 'user', text},
      {
        role: 'assistant',
        text: '🤖 The AI Assistant is a preview and isn’t connected yet.',
      },
    ]);
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.avatar}>🤖</span>
        <span className={styles.headerTitle}>AI Assistant</span>
      </div>

      <div className={styles.messages} ref={threadRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.bubble} ${
              m.role === 'user' ? styles.user : styles.assistant
            }`}
          >
            {m.text}
          </div>
        ))}
        <div className={styles.hint}>Preview — responses are not live yet.</div>
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          placeholder="Add a chat message…"
          value={draft}
          rows={1}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.send}
          onClick={send}
          disabled={!draft.trim()}
          title="Send message"
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </aside>
  );
}
