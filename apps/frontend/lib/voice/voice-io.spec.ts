import { createBrowserVoiceIO } from './voice-io';

describe('createBrowserVoiceIO', () => {
  it('reports recognition support as false when API is unavailable', () => {
    const adapter = createBrowserVoiceIO();
    expect(adapter.isRecognitionSupported()).toBe(false);
  });

  it('startListening returns cleanup callback even without support', () => {
    const adapter = createBrowserVoiceIO();
    const cleanup = adapter.startListening({
      onTranscript: () => undefined,
      onError: () => undefined,
    });
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
