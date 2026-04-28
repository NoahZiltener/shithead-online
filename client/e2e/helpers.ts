import { expect, type Browser, type Page } from '@playwright/test'

/** Navigates to home, creates a room, waits for the waiting room, and returns the room code. */
export async function createRoom(page: Page, name = 'Alice'): Promise<string> {
  await page.goto('/')
  await page.getByPlaceholder('Enter your name...').fill(name)
  await page.getByRole('button', { name: 'Create New Room' }).click()
  await expect(page.getByRole('heading', { name: 'Waiting Room' })).toBeVisible()
  return (await page.locator('.room-code-val').textContent())!.trim()
}

/** Navigates to home, joins a room by code, waits for the waiting room. */
export async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto('/')
  await page.getByPlaceholder('Enter your name...').fill(name)
  await page.getByPlaceholder('e.g. K47X').fill(code)
  await page.getByRole('button', { name: 'Join Room' }).click()
  await expect(page.getByRole('heading', { name: 'Waiting Room' })).toBeVisible()
}

/**
 * Creates a 2-player room, starts the game, and returns both pages in the setup phase.
 * Both players will have 9 cards in hand.
 */
export async function startTwoPlayerGame(browser: Browser): Promise<{ host: Page; guest: Page; ctx1: import('@playwright/test').BrowserContext; ctx2: import('@playwright/test').BrowserContext }> {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const host = await ctx1.newPage()
  const guest = await ctx2.newPage()

  const code = await createRoom(host, 'Alice')
  await joinRoom(guest, code, 'Bob')
  await host.getByRole('button', { name: 'Start Game' }).click()

  // Both should be in the game (setup phase)
  await expect(host.locator('.your-hand')).toBeVisible()
  await expect(guest.locator('.your-hand')).toBeVisible()

  return { host, guest, ctx1, ctx2 }
}

/**
 * Confirms face-up card selection for a player in the setup phase.
 * Selects the first 3 available hand cards.
 */
export async function confirmFaceUp(page: Page): Promise<void> {
  // Click the first 3 hand cards to select them for face-up
  const handCards = page.locator('.your-hand .hand-card')
  await handCards.nth(0).click()
  await handCards.nth(1).click()
  await handCards.nth(2).click()
  await page.getByRole('button', { name: /Confirm face-up/ }).click()
}
