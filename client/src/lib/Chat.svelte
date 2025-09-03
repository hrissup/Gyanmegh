<script>
  import { createEventDispatcher, afterUpdate } from 'svelte';
  export let messages = [];
  let newMessage = '';
  let chatBox;
  const dispatch = createEventDispatcher();

  function handleSubmit() {
    if (newMessage.trim() === '') return;
    dispatch('send', { text: newMessage });
    newMessage = '';
  }

  afterUpdate(() => {
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  });
</script>

<div class="chat-container">
  <div class="chat-messages" bind:this={chatBox}>
    {#if messages.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>No messages yet</p>
        <span>Start the conversation!</span>
      </div>
    {:else}
      {#each messages as message}
        <div class="message {message.isMine ? 'message-mine' : 'message-other'}">
          <div class="message-content">
            <div class="message-sender">{message.sender}</div>
            <div class="message-text">{message.text}</div>
            <div class="message-time">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  
  <form class="chat-input-form" on:submit|preventDefault={handleSubmit}>
    <div class="input-wrapper">
      <input 
        type="text" 
        placeholder="Type a message..." 
        class="chat-input" 
        bind:value={newMessage}
        maxlength="500"
      />
      <button type="submit" class="send-btn" disabled={!newMessage.trim()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </form>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 400px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chat-messages::-webkit-scrollbar {
    width: 6px;
  }

  .chat-messages::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  .chat-messages::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  .chat-messages::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
    text-align: center;
  }

  .empty-state svg {
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
  }

  .empty-state span {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .message {
    display: flex;
    margin-bottom: 0.5rem;
  }

  .message-mine {
    justify-content: flex-end;
  }

  .message-other {
    justify-content: flex-start;
  }

  .message-content {
    max-width: 80%;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    position: relative;
  }

  .message-mine .message-content {
    background: #667eea;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .message-other .message-content {
    background: #f1f5f9;
    color: #374151;
    border-bottom-left-radius: 4px;
  }

  .message-sender {
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    opacity: 0.8;
  }

  .message-text {
    font-size: 0.875rem;
    line-height: 1.4;
    word-wrap: break-word;
  }

  .message-time {
    font-size: 0.625rem;
    opacity: 0.6;
    margin-top: 0.25rem;
    text-align: right;
  }

  .chat-input-form {
    border-top: 1px solid #e2e8f0;
    padding: 1rem;
    background: white;
  }

  .input-wrapper {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .chat-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    background: white;
    color: #000000;
  }

  .chat-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .chat-input::placeholder {
    color: #94a3b8;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #667eea;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: #5a67d8;
    transform: scale(1.05);
  }

  .send-btn:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
    transform: none;
  }

  .send-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  @media (max-width: 768px) {
    .chat-container {
      height: 300px;
    }
    
    .message-content {
      max-width: 90%;
    }
  }
</style>