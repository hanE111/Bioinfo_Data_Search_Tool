import { useState } from 'react';
import './ChatInput.css';

function ChatInput({ onSend, disabled }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="input-wrapper">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the dataset you're looking for..."
          disabled={disabled}
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="send-button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M2.5 10L17.5 2.5L10 17.5L8.75 11.25L2.5 10Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}

export default ChatInput;
