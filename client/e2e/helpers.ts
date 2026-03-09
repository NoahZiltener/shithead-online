import { expect, type Page } from '@playwright/test'

/** Navigates to home, creates a room, waits for the lobby, and returns the room code. */
export async function createRoom(page: Page, name = 'Alice'): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create room' }).click()
  await expect(page.getByRole('heading', { name: 'Create room' })).toBeVisible()
  await page.getByPlaceholder('Alice').fill(name)
  await page.getByRole('button', { name: 'Create room' }).click()
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible()
  return (await page.locator('.code').textContent())!.trim()
}

/** Navigates to home, joins a room by code, waits for the lobby. */
export async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Join room' }).click()
  await expect(page.getByRole('heading', { name: 'Join room' })).toBeVisible()
  await page.getByPlaceholder('Alice').fill(name)
  await page.getByPlaceholder('ABC123').fill(code)
  await page.getByRole('button', { name: 'Join room' }).click()
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible()
}
