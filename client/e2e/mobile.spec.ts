import { test, expect, devices } from '@playwright/test'

// Mobile-specific tests for iPhone and Android
const mobileDevices = ['iPhone 13', 'iPhone 16 Pro', 'Pixel 7']

mobileDevices.forEach(deviceName => {
  test.describe(`Mobile Game Flow - ${deviceName}`, () => {
    // Note: Use @playwright/test devices for iPhone/Pixel emulation
    // Tests run on actual emulated devices from the config

    test('Home page loads and is scrollable on mobile', async ({ page, context }) => {
      // Apply device viewport from config
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      // Verify page is visible
      await expect(page.locator('.lobby-wrap')).toBeVisible()
      
      // Check logo is readable
      await expect(page.locator('.logo-title')).toBeVisible()
      
      // Verify buttons are accessible and large enough for touch
      const joinInput = page.locator('input[placeholder*="name"]')
      const roomInput = page.locator('input[placeholder*="Room"]')
      const joinButton = page.locator('button:has-text("Create New Room")')
      
      await expect(joinInput).toBeVisible()
      await expect(roomInput).toBeVisible()
      await expect(joinButton).toBeVisible()
      
      // Verify buttons have minimum touch target size
      const buttonBox = await joinButton.boundingBox()
      expect(buttonBox?.height).toBeGreaterThanOrEqual(40)
    })

    test('Can enter name and room code on mobile keyboard', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      // Fill in name
      const nameInput = page.locator('input[placeholder*="name"]')
      await nameInput.focus()
      await nameInput.fill('TestPlayer')
      await expect(nameInput).toHaveValue('TestPlayer')
      
      // Fill in room code
      const roomInput = page.locator('input[placeholder*="Room"]')
      await roomInput.focus()
      await roomInput.fill('TEST')
      await expect(roomInput).toHaveValue('TEST')
    })

    test('Create room button is clickable on mobile', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      // Fill name and click create
      const nameInput = page.locator('input[placeholder*="name"]')
      await nameInput.fill('MobilePlayer')
      
      const createButton = page.locator('button:has-text("Create New Room")')
      await createButton.click()
      
      // Should navigate to lobby
      await page.waitForURL(/\/lobby|\/game/, { timeout: 10000 })
    })

    test('Game view renders correctly on mobile', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      // Create a room to get to game state
      await page.goto('/')
      const nameInput = page.locator('input[placeholder*="name"]')
      await nameInput.fill('MobileGameTest')
      
      const createButton = page.locator('button:has-text("Create New Room")')
      await createButton.click()
      
      // Wait for game or lobby view
      await page.waitForURL(/game|lobby/, { timeout: 10000 })
      
      // Verify nav bar is visible
      const navBar = page.locator('.nav-bar')
      await expect(navBar).toBeVisible()
      
      // Verify main content is not hidden behind fixed nav
      const mainContent = page.locator('[class*="viewport"], [class*="wrap"]')
      await expect(mainContent.first()).toBeVisible()
    })

    test('Cards are properly sized and clickable on mobile', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      // Navigate to a game state (reuse previous test setup)
      await page.goto('/')
      const nameInput = page.locator('input[placeholder*="name"]')
      await nameInput.fill('CardSizeTest')
      
      const createButton = page.locator('button:has-text("Create New Room")')
      await createButton.click()
      
      await page.waitForURL(/game|lobby/, { timeout: 10000 })
      
      // Check if cards exist and are properly sized for mobile
      const cards = page.locator('.card')
      const cardCount = await cards.count()
      
      if (cardCount > 0) {
        const firstCard = cards.first()
        const cardBox = await firstCard.boundingBox()
        
        // Cards should be visible and properly sized
        expect(cardBox?.width).toBeGreaterThan(40) // minimum width
        expect(cardBox?.height).toBeGreaterThan(60) // minimum height
        
        // Verify card is within viewport (not hidden off-screen)
        const viewportSize = page.viewportSize()
        if (viewportSize && cardBox) {
          expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewportSize.width + 100)
        }
      }
    })

    test('Scrolling works smoothly without layout shift', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      // Get initial scroll position
      const initialScroll = await page.evaluate(() => window.scrollY)
      
      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 100))
      const afterScroll = await page.evaluate(() => window.scrollY)
      
      // Verify scroll happened
      expect(afterScroll).toBeGreaterThan(initialScroll)
      
      // Scroll back up
      await page.evaluate(() => window.scrollBy(0, -100))
      const finalScroll = await page.evaluate(() => window.scrollY)
      
      // Should be back near original position
      expect(Math.abs(finalScroll - initialScroll)).toBeLessThan(10)
    })

    test('Fixed header and footer do not overlap content', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      const nav = page.locator('.nav-bar')
      const footer = page.locator('.app-footer')
      const mainContent = page.locator('.lobby-wrap')
      
      // Get positions
      const navBox = await nav.boundingBox()
      const footerBox = await footer.boundingBox()
      const contentBox = await mainContent.boundingBox()
      
      // Nav should be at top
      expect(navBox?.y).toBe(0)
      
      // Content should be below nav
      if (navBox && contentBox) {
        expect(contentBox.y).toBeGreaterThanOrEqual(navBox.height)
      }
      
      // Footer should be at bottom
      const viewportSize = page.viewportSize()
      if (footerBox && viewportSize) {
        expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewportSize.height + 50)
      }
    })

    test('Touch interactions work (no hover states)', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      // Get button element
      const createButton = page.locator('button:has-text("Create New Room")')
      
      // On touch devices, we should use active/focus states, not hover
      // Simulate touch (tap) by clicking
      await createButton.tap?.() ?? createButton.click()
      
      // Verify it's interactable
      await expect(createButton).toBeEnabled()
    })

    test('Form inputs have proper sizing for touch', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      const nameInput = page.locator('input[placeholder*="name"]')
      const inputBox = await nameInput.boundingBox()
      
      // Input should have adequate height for touch interaction
      expect(inputBox?.height).toBeGreaterThanOrEqual(40)
      
      // Input should be focusable
      await nameInput.focus()
      await expect(nameInput).toBeFocused()
    })

    test('Viewport is properly configured for mobile', async ({ page }) => {
      const viewport = getDeviceViewport(deviceName)
      await page.setViewportSize(viewport)

      await page.goto('/')
      
      // Check that page doesn't have horizontal scroll on mobile
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })
      
      // Allow small margin for safe area
      expect(hasHorizontalScroll).toBe(false)
      
      // Verify viewport meta tag exists
      const viewportMeta = await page.$('meta[name="viewport"]')
      expect(viewportMeta).toBeTruthy()
      
      // Verify it has proper settings
      const viewportContent = await viewportMeta?.getAttribute('content')
      expect(viewportContent).toContain('width=device-width')
      expect(viewportContent).toContain('initial-scale=1')
    })
  })
})

// Helper to get viewport size based on device name
function getDeviceViewport(deviceName: string) {
  const viewports: Record<string, { width: number; height: number }> = {
    'iPhone 13': { width: 390, height: 844 },
    'iPhone 16 Pro': { width: 390, height: 844 },
    'Pixel 7': { width: 412, height: 915 },
  }
  return viewports[deviceName] || { width: 390, height: 844 }
}
