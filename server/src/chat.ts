import type { ChatMessage } from '../../shared/src/types.ts'
import type { Room } from './rooms.ts'
import { MAX_CHAT_MESSAGES } from './rooms.ts'

const MAX_MESSAGE_LENGTH = 500

export interface AddChatMessageResult {
  success: boolean
  error?: string
  message?: ChatMessage
}

export function validateMessage(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim()

  if (!trimmed) {
    return { valid: false, error: 'Message cannot be empty' }
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds ${MAX_MESSAGE_LENGTH} character limit` }
  }

  return { valid: true }
}

export function addChatMessage(
  room: Room,
  senderId: string,
  senderName: string,
  text: string,
): AddChatMessageResult {
  const validation = validateMessage(text)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const message: ChatMessage = {
    senderId,
    senderName,
    text: text.trim(),
    timestamp: Date.now(),
  }

  room.chatHistory.push(message)

  // Keep only last MAX_CHAT_MESSAGES
  if (room.chatHistory.length > MAX_CHAT_MESSAGES) {
    room.chatHistory = room.chatHistory.slice(-MAX_CHAT_MESSAGES)
  }

  return { success: true, message }
}

export function getChatHistory(room: Room): ChatMessage[] {
  return room.chatHistory.map((msg) => ({ ...msg }))
}
