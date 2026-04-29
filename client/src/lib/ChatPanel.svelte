<script lang="ts">
  import { connection } from './ws.svelte'
  import type { ChatMessage } from '$shared/types.ts'

  let open = $state(false)
  let messageText = $state('')
  let messageContainer = $state<HTMLDivElement | undefined>()
  let unreadCount = $state(0)
  let lastSeenMessageCount = $state(0)
  let initialized = $state(false)

  function toggle() {
    open = !open
    if (open) {
      unreadCount = 0
      lastSeenMessageCount = connection.chatMessages.length
      // Scroll to bottom when opening
      setTimeout(() => {
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight
        }
      }, 0)
    }
  }

  // Initialize lastSeenMessageCount on first load
  $effect(() => {
    if (!initialized) {
      lastSeenMessageCount = connection.chatMessages.length
      initialized = true
    }
  })

  // Auto-scroll to bottom when chat is open and new messages arrive
  $effect(() => {
    // Watch for changes in messages
    const _msgs = connection.chatMessages
    if (open && messageContainer && _msgs.length > 0) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight
        }
      }, 0)
    }
  })

  // Track unread messages when chat is closed
  $effect(() => {
    if (!initialized || open) return
    
    const messageCount = connection.chatMessages.length
    if (messageCount > lastSeenMessageCount) {
      // Only count messages from OTHER players as unread
      const newMessages = connection.chatMessages.slice(lastSeenMessageCount)
      const unreadFromOthers = newMessages.filter(msg => msg.senderId !== connection.playerId).length
      unreadCount = unreadFromOthers
    }
  })

  function sendMessage() {
    const text = messageText.trim()
    if (text) {
      connection.sendMessage(text)
      messageText = ''
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function getPlayerName(senderId: string): string {
    const player = connection.players.find((p) => p.id === senderId)
    return player?.name || 'Unknown'
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
</script>

<button class="chat-fab" onclick={toggle} aria-label="Chat" title="Chat">
  {#if open}
    ✕
  {:else}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  {/if}
  {#if unreadCount > 0}
    <span class="unread-badge">{unreadCount}</span>
  {/if}
</button>

{#if open}
  <div class="chat-panel">
    <div class="chat-header">
      <h3>Chat</h3>
      <button class="close-btn" onclick={toggle} aria-label="Close chat">✕</button>
    </div>

    <div class="chat-messages" bind:this={messageContainer}>
      {#if connection.chatMessages.length === 0}
        <div class="chat-empty">No messages yet</div>
      {/if}

      {#each connection.chatMessages as msg (msg.timestamp + msg.senderId)}
        <div class="chat-message">
          <div class="message-header">
            <span class="message-author">{msg.senderName}</span>
            <span class="message-time">{formatTime(msg.timestamp)}</span>
          </div>
          <div class="message-text">{msg.text}</div>
        </div>
      {/each}
    </div>

    <div class="chat-input-area">
      <textarea
        class="chat-input"
        placeholder="Type a message..."
        bind:value={messageText}
        onkeydown={handleKeydown}
        maxlength="500"
        rows="2"
      ></textarea>
      <button class="send-button" onclick={sendMessage} disabled={!messageText.trim()}>
        Send
      </button>
    </div>
  </div>
{/if}

<style>
  .chat-fab {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    z-index: 200;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.45);
    transition: transform 0.15s, box-shadow 0.2s;
  }

  .chat-fab:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(59, 130, 246, 0.6);
  }

  .unread-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--neon);
    color: white;
    border: 2px solid rgba(14, 14, 24, 0.96);
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(247, 37, 133, 0.4);
  }

  .chat-panel {
    position: fixed;
    bottom: 5.5rem;
    left: 1.5rem;
    z-index: 200;
    width: 350px;
    height: 500px;
    background: rgba(14, 14, 24, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.2s ease both;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .chat-header h3 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.3rem;
    letter-spacing: 0.1em;
    color: var(--cream);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--cream);
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: var(--neon);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chat-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
  }

  .chat-message {
    padding: 0.5rem 1rem;
    border-left: 3px solid transparent;
    transition: border-color 0.2s, background-color 0.2s;
  }

  .chat-message:hover {
    background-color: rgba(255, 255, 255, 0.05);
    border-left-color: var(--neon);
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }

  .message-author {
    font-weight: 600;
    color: var(--cream);
    font-size: 12px;
  }

  .message-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
  }

  .message-text {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .chat-input-area {
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    gap: 0.75rem;
  }

  .chat-input {
    flex: 1;
    padding: 0.6rem 0.8rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--cream);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    resize: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  .chat-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .chat-input:focus {
    outline: none;
    border-color: var(--neon);
    box-shadow: 0 0 0 3px rgba(247, 37, 133, 0.15);
  }

  .send-button {
    padding: 0.6rem 1.2rem;
    background: var(--neon);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    font-size: 12px;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.2s;
    white-space: nowrap;
    box-shadow: 0 3px 14px rgba(247, 37, 133, 0.35);
  }

  .send-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(247, 37, 133, 0.5);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .chat-panel {
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 60vh;
      border-radius: 14px 14px 0 0;
    }

    .chat-fab {
      left: auto;
      right: 1.5rem;
    }
  }
</style>
