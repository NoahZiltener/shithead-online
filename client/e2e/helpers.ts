import { expect, type Page } from '@playwright/test'

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
