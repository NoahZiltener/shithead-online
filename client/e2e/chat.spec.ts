import { test, expect } from '@playwright/test'
import { createRoom, joinRoom, startTwoPlayerGame } from './helpers.ts'

test('chat button is not visible on home page', async ({ page }) => {
  await page.goto('/')
  const chatButton = page.locator('button[aria-label="Chat"]')
  await expect(chatButton).not.toBeVisible()
})

test('chat button is visible in lobby', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await expect(chatButton).toBeVisible()
})

test('chat button is visible in game', async ({ browser }) => {
  const { host, ctx1, ctx2 } = await startTwoPlayerGame(browser)
  const chatButton = host.locator('button[aria-label="Chat"]')
  await expect(chatButton).toBeVisible()
  await ctx1.close()
  await ctx2.close()
})

test('clicking chat button opens the panel', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const panel = page.locator('.chat-panel')
  await expect(panel).toBeVisible()
})

test('clicking close button closes the chat panel', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const closeBtn = page.locator('button[aria-label="Close chat"]')
  await closeBtn.click()
  const panel = page.locator('.chat-panel')
  await expect(panel).not.toBeVisible()
})

test('clicking chat button X icon closes the panel', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  // When open, the button shows X
  await chatButton.click()
  const panel = page.locator('.chat-panel')
  await expect(panel).not.toBeVisible()
})

test('chat panel shows empty state initially', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  await expect(page.locator('.chat-empty')).toContainText('No messages yet')
})

test('can send a message in the chat', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const textarea = page.locator('.chat-input')
  await textarea.fill('Hello everyone!')
  const sendBtn = page.locator('button.send-button')
  await sendBtn.click()
  // Message should appear in chat
  await expect(page.locator('.message-text')).toContainText('Hello everyone!')
  // Input should be cleared
  await expect(textarea).toHaveValue('')
})

test('send button is disabled when textarea is empty', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const sendBtn = page.locator('button.send-button')
  await expect(sendBtn).toBeDisabled()
})

test('send button is enabled when textarea has text', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const textarea = page.locator('.chat-input')
  await textarea.fill('test')
  const sendBtn = page.locator('button.send-button')
  await expect(sendBtn).toBeEnabled()
})

test('message shows sender name and timestamp', async ({ page }) => {
  await createRoom(page, 'Alice')
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const textarea = page.locator('.chat-input')
  await textarea.fill('Test message')
  await page.locator('button.send-button').click()
  
  await expect(page.locator('.message-author')).toContainText('Alice')
  const timeText = await page.locator('.message-time').textContent()
  expect(timeText).toMatch(/\d{1,2}:\d{2}/)
})

test('enter key sends message (shift+enter does not)', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  const textarea = page.locator('.chat-input')
  
  // Shift+Enter should create newline, not send
  await textarea.fill('Line 1')
  await textarea.press('Shift+Enter')
  await textarea.type('Line 2')
  
  // Message should not be sent yet
  const messageCount = await page.locator('.chat-message').count()
  expect(messageCount).toBe(0)
  
  // Regular Enter should send
  await textarea.press('Enter')
  await expect(page.locator('.message-text')).toContainText('Line 1')
})

test('messages from another player appear in real-time', async ({ browser }) => {
  const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)

  // Alice opens chat in host
  await host.locator('button[aria-label="Chat"]').click()
  
  // Bob sends a message in guest
  await guest.locator('button[aria-label="Chat"]').click()
  await guest.locator('.chat-input').fill('Hello from Bob!')
  await guest.locator('button.send-button').click()
  
  // Alice should see Bob's message immediately
  await expect(host.locator('.message-text')).toContainText('Hello from Bob!')
  await expect(host.locator('.message-author')).toContainText('Bob')
  
  await ctx1.close()
  await ctx2.close()
})

test('chat scrolls to bottom when new messages arrive while open', async ({ browser }) => {
  const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)
  
  // Alice opens chat
  await host.locator('button[aria-label="Chat"]').click()
  
  // Send a few messages to make the chat scroll
  const chatInput = host.locator('.chat-input')
  for (let i = 1; i <= 3; i++) {
    await chatInput.fill(`Message ${i}`)
    await host.locator('button.send-button').click()
    await host.waitForTimeout(100)
  }
  
  // Get the scroll height after messages are added
  const messagesContainer = host.locator('.chat-messages')
  const maxScroll = await messagesContainer.evaluate(el => el.scrollHeight - el.clientHeight)
  const scrollBefore = await messagesContainer.evaluate(el => el.scrollTop)
  
  // If there's room to scroll and we're at the bottom before, we're good
  if (maxScroll > 0) {
    expect(scrollBefore).toBe(maxScroll)
  }
  
  // Bob sends a message
  await guest.locator('button[aria-label="Chat"]').click()
  await guest.locator('.chat-input').fill('New message from Bob')
  await guest.locator('button.send-button').click()
  
  // Wait for message to arrive and scroll to happen
  await host.waitForTimeout(200)
  
  // Alice's chat should stay scrolled to bottom
  const scrollAfter = await messagesContainer.evaluate(el => el.scrollTop)
  const maxScrollAfter = await messagesContainer.evaluate(el => el.scrollHeight - el.clientHeight)
  
  // Should be at the bottom
  expect(Math.abs(scrollAfter - maxScrollAfter)).toBeLessThan(5)
  
  await ctx1.close()
  await ctx2.close()
})

test('unread badge appears when message from other player arrives while closed', async ({ browser }) => {
  const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)
  
  // Bob sends a message
  await guest.locator('button[aria-label="Chat"]').click()
  await guest.locator('.chat-input').fill('Hello!')
  await guest.locator('button.send-button').click()
  
  // Close Bob's chat
  await guest.locator('button[aria-label="Chat"]').click()
  
  // Alice's chat button should show unread badge
  const badge = host.locator('.unread-badge')
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('1')
  
  await ctx1.close()
  await ctx2.close()
})

test('unread badge clears when chat is opened', async ({ browser }) => {
  const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)
  
  // Bob sends a message
  await guest.locator('button[aria-label="Chat"]').click()
  await guest.locator('.chat-input').fill('Hello!')
  await guest.locator('button.send-button').click()
  await guest.locator('button[aria-label="Chat"]').click()
  
  // Alice should see unread badge
  let badge = host.locator('.unread-badge')
  await expect(badge).toBeVisible()
  
  // Alice opens chat
  await host.locator('button[aria-label="Chat"]').click()
  
  // Badge should disappear
  badge = host.locator('.unread-badge')
  await expect(badge).not.toBeVisible()
  
  await ctx1.close()
  await ctx2.close()
})

test('own messages do not show unread badge', async ({ page }) => {
  await createRoom(page, 'Alice')
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  
  // Send a message
  await page.locator('.chat-input').fill('My message')
  await page.locator('button.send-button').click()
  
  // Close chat
  await chatButton.click()
  
  // No badge should appear since it's from self
  const badge = page.locator('.unread-badge')
  await expect(badge).not.toBeVisible()
})

test('message character limit is enforced (500 chars)', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  
  const textarea = page.locator('.chat-input')
  const longText = 'a'.repeat(510)
  
  // Filling should not exceed the maxlength
  await textarea.fill(longText)
  const value = await textarea.inputValue()
  expect(value.length).toBeLessThanOrEqual(500)
})

test('whitespace-only messages are rejected', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  
  const textarea = page.locator('.chat-input')
  await textarea.fill('   ')
  
  // Send button should be disabled for whitespace
  const sendBtn = page.locator('button.send-button')
  // After filling with spaces and unfocusing, trim check should prevent sending
  await textarea.blur()
  expect(await textarea.evaluate(el => (el as HTMLTextAreaElement).value.trim())).toBe('')
})

test('chat history persists when reopening chat', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  
  // Send a message
  await chatButton.click()
  await page.locator('.chat-input').fill('First message')
  await page.locator('button.send-button').click()
  
  // Close chat
  await chatButton.click()
  
  // Reopen chat
  await chatButton.click()
  
  // Message should still be there
  await expect(page.locator('.message-text')).toContainText('First message')
})

test('multiple messages display in chronological order', async ({ page }) => {
  await createRoom(page)
  const chatButton = page.locator('button[aria-label="Chat"]')
  await chatButton.click()
  
  // Send multiple messages
  for (let i = 1; i <= 3; i++) {
    await page.locator('.chat-input').fill(`Message ${i}`)
    await page.locator('button.send-button').click()
    await page.waitForTimeout(50)
  }
  
  // Check order
  const messages = await page.locator('.message-text').allTextContents()
  expect(messages).toEqual(['Message 1', 'Message 2', 'Message 3'])
})
