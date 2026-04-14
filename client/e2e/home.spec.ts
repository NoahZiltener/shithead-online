import { test, expect } from '@playwright/test'

test('shows join and create buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create New Room' })).toBeVisible()
})

test('join button is disabled without name and room code', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeDisabled()
})

test('create button is disabled without name', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Create New Room' })).toBeDisabled()
})

test('join button enables when name and code are filled', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Enter your name...').fill('Alice')
  await page.getByPlaceholder('e.g. K47X').fill('ABCD12')
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeEnabled()
})

test('create button enables when name is filled', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Enter your name...').fill('Alice')
  await expect(page.getByRole('button', { name: 'Create New Room' })).toBeEnabled()
})

test('joining unknown room shows error on home screen', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Enter your name...').fill('Alice')
  await page.getByPlaceholder('e.g. K47X').fill('XXXXXX')
  await page.getByRole('button', { name: 'Join Room' }).click()
  await expect(page.getByText(/not found/i)).toBeVisible()
})
