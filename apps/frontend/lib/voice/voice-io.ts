export interface VoiceRecognitionCallbacks {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  onStateChange?: (isListening: boolean) => void;
}

export interface VoiceIOAdapter {
  isRecognitionSupported: () => boolean;
  isSpeechSynthesisSupported: () => boolean;
  startListening: (callbacks: VoiceRecognitionCallbacks) => () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

type RecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEventLike = {
  results: RecognitionResultLike[];
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const getRecognitionCtor = (): (new () => SpeechRecognitionLike) | undefined => {
  if (typeof window === 'undefined') return undefined;
  const browserWindow = window as BrowserWindow;
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
};

export const createBrowserVoiceIO = (): VoiceIOAdapter => {
  return {
    isRecognitionSupported: () => Boolean(getRecognitionCtor()),
    isSpeechSynthesisSupported: () =>
      typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined',
    startListening: (callbacks: VoiceRecognitionCallbacks) => {
      const RecognitionCtor = getRecognitionCtor();
      if (!RecognitionCtor) {
        callbacks.onError('Voice recognition is not supported in this browser.');
        return () => undefined;
      }

      const recognition = new RecognitionCtor();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;
      callbacks.onStateChange?.(true);

      recognition.onresult = (event) => {
        const finalChunk = event.results[event.results.length - 1];
        const transcript = finalChunk?.[0]?.transcript?.trim();
        if (transcript) callbacks.onTranscript(transcript);
      };
      recognition.onerror = (event) => {
        callbacks.onError(
          event.error
            ? `Voice recognition failed (${event.error}).`
            : 'Voice recognition failed.',
        );
      };
      recognition.onend = () => {
        callbacks.onStateChange?.(false);
      };
      recognition.start();

      return () => {
        try {
          recognition.stop();
        } finally {
          callbacks.onStateChange?.(false);
        }
      };
    },
    speak: (text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    },
    stopSpeaking: () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
    },
  };
};
