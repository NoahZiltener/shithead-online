import { test, expect } from '@playwright/test'
import { createRoom } from './helpers.ts'

test('lobby shows room code after creating room', async ({ page }) => {
  await createRoom(page)
  const code = await page.locator('.room-code-val').textContent()
  expect(code?.trim()).toMatch(/^[A-Z0-9]{6}$/)
})

test('lobby shows host and you badges on creator', async ({ page }) => {
  await createRoom(page, 'Alice')
  await expect(page.locator('.badge-host')).toBeVisible()
  await expect(page.locator('.badge-you')).toBeVisible()
})

test('host sees game mode toggle with both options', async ({ page }) => {
  await createRoom(page)
  await expect(page.getByRole('button', { name: /Normal/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Double Deck/ })).toBeVisible()
})

test('normal mode shows 1 / 5 in player count badge', async ({ page }) => {
  await createRoom(page)
  await expect(page.locator('.player-count-badge')).toContainText('1 / 5')
})

test('switching to double deck updates count to 1 / 10', async ({ page }) => {
  await createRoom(page)
  await page.getByRole('button', { name: /Double Deck/ }).click()
  await expect(page.locator('.player-count-badge')).toContainText('1 / 10')
})

test('switching back to normal updates count to 1 / 5', async ({ page }) => {
  await createRoom(page)
  await page.getByRole('button', { name: /Double Deck/ }).click()
  await page.getByRole('button', { name: /Normal/ }).click()
  await expect(page.locator('.player-count-badge')).toContainText('1 / 5')
})

test('start game button is disabled with only one player', async ({ page }) => {
  await createRoom(page)
  await expect(page.getByRole('button', { name: /Need 2\+/ })).toBeDisabled()
})

test('leave button returns to home screen', async ({ page }) => {
  await createRoom(page)
  await page.getByRole('button', { name: 'Leave Room' }).click()
  await expect(page.getByRole('button', { name: 'Create New Room' })).toBeVisible()
})

test('copy button copies room code to clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const code = await createRoom(page)
  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByRole('button', { name: /Copied/ })).toBeVisible()
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toBe(code)
})
