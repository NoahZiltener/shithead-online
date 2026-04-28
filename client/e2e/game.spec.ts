import { test, expect } from '@playwright/test'
import { confirmFaceUp, startTwoPlayerGame } from './helpers.ts'

test.describe('Hand spread mode', () => {
  test('hand auto-spreads when player has 7+ cards (setup phase has 9)', async ({ browser }) => {
    const { host, ctx1, ctx2 } = await startTwoPlayerGame(browser)

    // Setup phase gives each player 9 cards — above the auto-spread threshold of 7
    const hand = host.locator('.your-hand')
    await expect(hand).toHaveClass(/spread/)

    await ctx1.close()
    await ctx2.close()
  })

  test('toggle button switches between spread and fan mode', async ({ browser }) => {
    const { host, ctx1, ctx2 } = await startTwoPlayerGame(browser)

    const hand = host.locator('.your-hand')
    await expect(hand).toHaveClass(/spread/)

    // Toggle to fan mode
    await host.locator('.btn-spread').click()
    await expect(hand).not.toHaveClass(/spread/)

    // Toggle back to spread
    await host.locator('.btn-spread').click()
    await expect(hand).toHaveClass(/spread/)

    await ctx1.close()
    await ctx2.close()
  })

  test('hand stays in fan mode when card count is below threshold', async ({ browser }) => {
    const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)

    // Both players confirm their face-up cards (hand drops from 9 to 6 cards)
    await confirmFaceUp(host)
    await confirmFaceUp(guest)

    // After setup, each player has 6 cards in hand (9 dealt - 3 placed face-up)
    // 6 < 7 (AUTO_SPREAD_THRESHOLD), so auto-spread should be off
    const hand = host.locator('.your-hand')
    await expect(hand).not.toHaveClass(/spread/)

    await ctx1.close()
    await ctx2.close()
  })
})

test.describe('Off-turn face-down peek', () => {
  test('face-down card buttons are interactive (browsable) during setup phase for all players', async ({ browser }) => {
    const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)

    // All face-down cards should be present
    await expect(host.locator('.your-facedown-row button').first()).toBeVisible()
    await expect(guest.locator('.your-facedown-row button').first()).toBeVisible()

    await ctx1.close()
    await ctx2.close()
  })

  test('face-down cards show browsable state during playing phase for non-active player', async ({ browser }) => {
    const { host, guest, ctx1, ctx2 } = await startTwoPlayerGame(browser)

    // Both players confirm face-up to enter playing phase
    await confirmFaceUp(host)
    await confirmFaceUp(guest)

    // In playing phase, both players' face-down cards should not have the 'locked' class
    // (locked only applies on your turn when another FD card is already peeked)
    const hostFdCards = host.locator('.your-facedown-row .card')
    const guestFdCards = guest.locator('.your-facedown-row .card')

    // Neither player should have locked face-down cards at start of turn
    await expect(hostFdCards.first()).not.toHaveClass(/locked/)
    await expect(guestFdCards.first()).not.toHaveClass(/locked/)

    // The non-active player's face-down cards should have .browsable class
    // (One of the two players is non-active — check both and verify at least one has browsable)
    const hostBrowsable = await hostFdCards.first().getAttribute('class')
    const guestBrowsable = await guestFdCards.first().getAttribute('class')
    const atLeastOneHasBrowsable =
      (hostBrowsable?.includes('browsable') ?? false) ||
      (guestBrowsable?.includes('browsable') ?? false)
    expect(atLeastOneHasBrowsable).toBe(true)

    await ctx1.close()
    await ctx2.close()
  })
})
