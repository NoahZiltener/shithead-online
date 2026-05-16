import { test, devices } from '@playwright/test';

test('Check button positions on iPhone 16', async () => {
  const context = await test.browser().newContext({
    ...devices['iPhone 16 Pro'],
    viewport: { width: 390, height: 844 },
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:5173');
  
  // Get the chat FAB
  const chatFab = await page.locator('.chat-fab');
  const chatBox = await chatFab.boundingBox();
  
  // Get the feedback FAB
  const feedbackFab = await page.locator('.fab');
  const feedbackBox = await feedbackFab.boundingBox();
  
  console.log('Chat FAB position:', chatBox);
  console.log('Feedback FAB position:', feedbackBox);
  
  if (chatBox && feedbackBox) {
    const chatRight = chatBox.x + chatBox.width;
    const feedbackLeft = feedbackBox.x;
    console.log(`Chat right edge: ${chatRight}, Feedback left edge: ${feedbackLeft}`);
    console.log(`Gap between buttons: ${feedbackLeft - chatRight}px`);
  }
});
