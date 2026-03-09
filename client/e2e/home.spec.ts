import { test, expect } from '@playwright/test'

test('shows create and join buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Create room' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join room' })).toBeVisible()
})

test('create room button navigates to create form', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create room' }).click()
  await expect(page.getByRole('heading', { name: 'Create room' })).toBeVisible()
  await expect(page.getByPlaceholder('Alice')).toBeVisible()
})

test('join room button navigates to join form', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Join room' }).click()
  await expect(page.getByRole('heading', { name: 'Join room' })).toBeVisible()
  await expect(page.getByPlaceholder('Alice')).toBeVisible()
  await expect(page.getByPlaceholder('ABC123')).toBeVisible()
})

test('back button returns to home from create form', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create room' }).click()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.getByRole('button', { name: 'Create room' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join room' })).toBeVisible()
})

test('back button returns to home from join form', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Join room' }).click()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.getByRole('button', { name: 'Create room' })).toBeVisible()
})

test('joining unknown room shows error on home screen', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Join room' }).click()
  await page.getByPlaceholder('Alice').fill('Alice')
  await page.getByPlaceholder('ABC123').fill('XXXXXX')
  await page.getByRole('button', { name: 'Join room' }).click()
  await expect(page.getByText(/not found/i)).toBeVisible()
})
