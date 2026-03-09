import { test, expect } from '@playwright/test'
import { createRoom, joinRoom } from './helpers.ts'

test('second player can join and both see each other', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  await expect(host.getByText('Bob')).toBeVisible()
  await expect(guest.getByText('Alice')).toBeVisible()

  await ctx1.close()
  await ctx2.close()
})

test('player count updates when someone joins', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await expect(host.locator('.player-count-badge')).toContainText('1 /')

  await joinRoom(guest, code, 'Bob')
  await expect(host.locator('.player-count-badge')).toContainText('2 /')
  await expect(guest.locator('.player-count-badge')).toContainText('2 /')

  await ctx1.close()
  await ctx2.close()
})

test('host sees start game button, guest sees waiting message', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  await expect(host.getByRole('button', { name: 'Start Game' })).toBeVisible()
  await expect(guest.getByText(/Waiting for host/)).toBeVisible()

  await ctx1.close()
  await ctx2.close()
})

test('host can start game and both players see game screen', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  await host.getByRole('button', { name: 'Start Game' }).click()
  // Both should leave the waiting room (game view renders)
  await expect(host.getByRole('heading', { name: 'Waiting Room' })).not.toBeVisible()
  await expect(guest.getByRole('heading', { name: 'Waiting Room' })).not.toBeVisible()

  await ctx1.close()
  await ctx2.close()
})

test('game mode change syncs to all players', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  await host.getByRole('button', { name: /Double Deck/ }).click()

  // Guest sees updated max players and mode label
  await expect(guest.locator('.player-count-badge')).toContainText('2 / 10')
  await expect(guest.locator('.mode-display')).toContainText('Double Deck')

  await ctx1.close()
  await ctx2.close()
})

test('guest does not see game mode toggle (read-only)', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  // Guest should NOT see the toggle buttons
  await expect(guest.getByRole('button', { name: /Normal/ })).not.toBeVisible()
  await expect(guest.getByRole('button', { name: /Double Deck/ })).not.toBeVisible()

  await ctx1.close()
  await ctx2.close()
})

test('player count decreases when someone leaves', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')
  await expect(host.locator('.player-count-badge')).toContainText('2 /')

  await guest.getByRole('button', { name: 'Leave Room' }).click()
  await expect(host.locator('.player-count-badge')).toContainText('1 /')
  await expect(host.getByText('Bob')).not.toBeVisible()

  await ctx1.close()
  await ctx2.close()
})

test('host can kick a player', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  await host.getByTitle('Kick Bob').click()

  // Guest lands on home screen with kicked message
  await expect(guest.getByRole('button', { name: 'Create New Room' })).toBeVisible()
  await expect(guest.getByText(/kicked/i)).toBeVisible()

  // Host sees Bob removed from player list
  await expect(host.getByText('Bob')).not.toBeVisible()

  await ctx1.close()
  await ctx2.close()
})

test('host does not see kick button for themselves', async ({ page }) => {
  await createRoom(page, 'Alice')
  await expect(page.locator('.kick')).not.toBeVisible()
})

test('admin transfers to next player when host leaves', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  // Alice leaves
  await host.getByRole('button', { name: 'Leave Room' }).click()

  // Bob becomes host
  await expect(guest.locator('.badge-host')).toBeVisible()
  await expect(guest.getByRole('button', { name: /Normal/ })).toBeVisible() // toggle visible for new host

  await ctx1.close()
  await ctx2.close()
})

test('player stays in lobby after page refresh when room has other players', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')

  // Host refreshes
  await host.reload()
  await expect(host.getByRole('heading', { name: 'Waiting Room' })).toBeVisible()
  await expect(host.locator('.room-code-val')).toHaveText(code)

  await ctx1.close()
  await ctx2.close()
})
