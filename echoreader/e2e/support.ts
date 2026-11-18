import type { Page } from '@playwright/test';

/** Test speech voices through a configured authenticated browser session. */
export async function useTestDeviceVoices(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const voices = [
      { voiceURI: 'test-natural-en-US', name: 'Test Natural Female', lang: 'en-US', default: true, localService: true },
    ];
    class TestUtterance {
      text = '';
      rate = 1;
      pitch = 1;
      voice: typeof voices[number] | null = null;
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: TestUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => voices,
        speak: () => undefined,
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        speaking: false,
        paused: false,
        onvoiceschanged: null,
      },
    });
  });
}
