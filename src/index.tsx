import { useState, useEffect, useRef } from "preact/hooks";
import "./globals.css";
import { render } from "preact";
import { ChatButton } from "./components/ChatButton";
import {
  ChatWindow,
  resolveAssistantPayload,
  createInitialMessages,
  INITIAL_BOT_MESSAGE_TEXT,
} from "./components/ChatWindow";
import { COLORS } from "./styles/constants";
import { voiceChatStream, type StreamController } from "./api/client";
import { getPageContext } from "./agent/context";
import { executeToolCalls } from "./agent/tools";
import { StreamingJsonParser, extractReplyText } from "./utils/streamingJson";

export type BulutVoice = "zeynep" | "ali";

export interface BulutOptions {
  containerId?: string;
  backendBaseUrl?: string;
  projectId?: string;
  model?: string;
  voice?: BulutVoice;
  baseColor?: string;
  agentName?: string;
}

export interface BulutRuntimeConfig {
  backendBaseUrl: string;
  projectId: string;
  model: string;
  voice: BulutVoice;
  baseColor: string;
  agentName: string;
}

/** Default LLM model — keep in sync with backend config.DEFAULT_LLM_MODEL */
const DEFAULT_LLM_MODEL = "google/gemini-3-flash-preview:nitro";

const DEFAULT_AGENT_NAME = "Bulut";

const DEFAULT_CONFIG: BulutRuntimeConfig = {
  backendBaseUrl: "https://api.bulut.lu",
  projectId: "", // Must be provided
  model: DEFAULT_LLM_MODEL,
  voice: "zeynep",
  baseColor: COLORS.primary,
  agentName: DEFAULT_AGENT_NAME,
};

const isValidHexColor = (value: string): boolean =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const normalizeHexColor = (value: string): string => {
  const trimmed = value.trim();
  if (!isValidHexColor(trimmed)) {
    return DEFAULT_CONFIG.baseColor;
  }
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const shadeHexColor = (hexColor: string, amount: number): string => {
  const normalized = normalizeHexColor(hexColor);
  const raw = normalized.slice(1);
  const toChannel = (start: number): number => parseInt(raw.slice(start, start + 2), 16);
  const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
  const adjust = (channel: number): number =>
    amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount;
  const toHex = (channel: number): string => clamp(channel).toString(16).padStart(2, "0");

  const r = adjust(toChannel(0));
  const g = adjust(toChannel(2));
  const b = adjust(toChannel(4));

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const applyTheme = (baseColor: string): void => {
  const normalized = normalizeHexColor(baseColor);
  COLORS.primary = normalized;
  COLORS.primaryHover = shadeHexColor(normalized, -0.15);
  COLORS.messageUser = normalized;
};

interface RemoteProjectConfig {
  base_color: string;
  model: string;
  agent_name: string;
}

const fetchRemoteConfig = async (
  baseUrl: string,
  projectId: string,
): Promise<RemoteProjectConfig | null> => {
  try {
    const url = baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${url}/projects/${projectId}/config`);
    if (!res.ok) return null;
    return (await res.json()) as RemoteProjectConfig;
  } catch {
    return null;
  }
};

const resolveRuntimeConfig = (
  options: BulutOptions,
): BulutRuntimeConfig => {
  const voice = options.voice === "zeynep" ? "zeynep" : "ali";
  return {
    backendBaseUrl: options.backendBaseUrl || DEFAULT_CONFIG.backendBaseUrl,
    projectId: options.projectId || DEFAULT_CONFIG.projectId,
    model: options.model || DEFAULT_CONFIG.model,
    voice,
    baseColor: normalizeHexColor(options.baseColor || DEFAULT_CONFIG.baseColor),
    agentName: options.agentName || DEFAULT_CONFIG.agentName,
  };
};

interface BulutWidgetProps {
  config: BulutRuntimeConfig;
}

const CHAT_STORAGE_KEY = "bulut_chat_history";
const CHAT_TIMESTAMP_KEY = "bulut_chat_timestamp";
const SESSION_ID_KEY = "bulut_session_id";
const ACCESSIBILITY_MODE_KEY = "bulut_accessibility_mode_enabled";
const VAD_THRESHOLD = 0.06;
const SILENCE_DURATION_MS = 1000;
const GEIST_FONT_FAMILY = "Geist";
const GEIST_STYLESHEET_ID = "bulut-geist-font-stylesheet";
const GEIST_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap";

const ensureGeistStylesheet = (): void => {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(GEIST_STYLESHEET_ID)) {
    return;
  }
  const link = document.createElement("link");
  link.id = GEIST_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = GEIST_STYLESHEET_URL;
  document.head.appendChild(link);
};

interface StoredMessage {
  id: number;
  text: string;
  isUser: boolean;
}

const appendToStoredMessages = (text: string, isUser: boolean): number => {
  let messages: StoredMessage[] = [];
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      try { messages = JSON.parse(saved); } catch { /* ignore */ }
    }
  }
  if (messages.length === 0) {
    messages = createInitialMessages();
  }
  const id = messages.reduce((a, m) => Math.max(a, m.id), 0) + 1;
  messages.push({ id, text, isUser });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
  }
  return id;
};

const updateStoredMessage = (id: number, text: string) => {
  if (typeof localStorage === "undefined") return;
  const saved = localStorage.getItem(CHAT_STORAGE_KEY);
  if (!saved) return;
  try {
    const messages = JSON.parse(saved) as StoredMessage[];
    const updated = messages.map((m: StoredMessage) => (m.id === id ? { ...m, text } : m));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
  } catch { /* ignore */ }
};

const BulutWidget = ({ config }: BulutWidgetProps) => {
  // Live config that merges remote settings over initial config
  const [liveConfig, setLiveConfig] = useState<BulutRuntimeConfig>(config);

  // Fetch remote project config on mount
  useEffect(() => {
    if (!config.projectId) return;
    let cancelled = false;

    fetchRemoteConfig(config.backendBaseUrl, config.projectId).then((remote) => {
      if (cancelled || !remote) return;
      const merged: BulutRuntimeConfig = {
        ...config,
        baseColor: normalizeHexColor(remote.base_color || config.baseColor),
        model: remote.model || config.model,
        agentName: remote.agent_name || config.agentName,
      };
      applyTheme(merged.baseColor);
      setLiveConfig(merged);
    });

    return () => { cancelled = true; };
  }, [config]);

  // Check localStorage for persisted state
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("bulut_panel_open") === "true";
    }
    return false;
  });

  const [showBubble, setShowBubble] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAccessibilityEnabled, setIsAccessibilityEnabled] = useState(() => {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem(ACCESSIBILITY_MODE_KEY) === "true";
  });
  const [previewMessage, setPreviewMessage] = useState<string | null>(
    INITIAL_BOT_MESSAGE_TEXT,
  );
  const accessibilityMode = isAccessibilityEnabled && !isOpen;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const activeControllerRef = useRef<StreamController | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const autoListenSuppressedRef = useRef(false);
  const assistantMsgIdRef = useRef<number | null>(null);

  // Show welcome bubble once for 5 seconds
  useEffect(() => {
    if (accessibilityMode) {
      setShowBubble(false);
      return;
    }
    if (isOpen) return;
    if (typeof localStorage !== "undefined") {
      if (localStorage.getItem("bulut_bubble_shown") === "true") return;
    }

    setShowBubble(true);
    const timer = setTimeout(() => {
      setShowBubble(false);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("bulut_bubble_shown", "true");
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen, accessibilityMode]);

  const clearPreviewTimer = () => {
    if (previewTimerRef.current !== null) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };

  const cleanupRecording = () => {
    if (vadIntervalRef.current !== null) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    silenceStartRef.current = null;
  };

  const sendAudioAndPreview = async (blob: Blob, mode: boolean) => {
    if (!liveConfig.projectId) return;
    const fileType = blob.type || "audio/webm";
    const ext = fileType.includes("ogg") ? "ogg" : fileType.includes("wav") ? "wav" : "webm";
    const file = new File([blob], `voice.${ext}`, { type: fileType });

    const sessionId =
      typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) : null;
    const pageContext = getPageContext().summary;
    const parser = new StreamingJsonParser();
    assistantMsgIdRef.current = null;
    setIsProcessing(true);
    setPreviewMessage("Düşünüyor...");
    isProcessingRef.current = true;
    console.info(`[Bulut] voice request started accessibility_mode=${mode}`);

    try {
      const controller = voiceChatStream(
        liveConfig.backendBaseUrl,
        file,
        liveConfig.projectId,
        sessionId,
        {
          model: liveConfig.model,
          voice: "zeynep",
          pageContext,
          accessibilityMode: mode,
        },
        {
          onTranscription: (data) => {
            if (data.session_id && typeof localStorage !== "undefined") {
              localStorage.setItem(SESSION_ID_KEY, data.session_id);
            }
            if (data.user_text?.trim()) {
              appendToStoredMessages(data.user_text, true);
            }
          },
          onAssistantDelta: (delta) => {
            parser.appendChunk(delta);
            const text = extractReplyText(parser);
            if (text) {
              clearPreviewTimer();
              setPreviewMessage(text);
              if (assistantMsgIdRef.current === null) {
                assistantMsgIdRef.current = appendToStoredMessages(text, false);
              } else {
                updateStoredMessage(assistantMsgIdRef.current, text);
              }
            }
          },
          onAssistantDone: (assistantText) => {
            const resolved = resolveAssistantPayload(assistantText);
            const finalText = resolved.displayText || assistantText;
            if (assistantMsgIdRef.current !== null) {
              updateStoredMessage(assistantMsgIdRef.current, finalText);
            } else {
              appendToStoredMessages(finalText, false);
            }
            setPreviewMessage(finalText);

            // Execute tool calls after the message is fully received
            if (resolved.toolCalls.length > 0) {
              void executeToolCalls(resolved.toolCalls).catch((err) => {
                console.error("Tool execution failed", err);
              });
            }
          },
          onAudioStateChange: (state) => {
            console.info(`[Bulut] audio state ${state} accessibility_mode=${mode}`);
          },
          onError: (error) => {
            console.error(`[Bulut] voice pipeline error ${error}`);
            setPreviewMessage(null);
          },
        },
      );
      activeControllerRef.current = controller;
      await controller.done;
    } catch (error) {
      console.error("[Bulut] voice request failed", error);
      setPreviewMessage(null);
    } finally {
      activeControllerRef.current = null;
      setIsProcessing(false);
      isProcessingRef.current = false;
      console.info(`[Bulut] voice request completed accessibility_mode=${mode}`);
    }
  };

  const startButtonRecording = async () => {
    if (isRecordingRef.current || isProcessingRef.current) return;
    autoListenSuppressedRef.current = false;
    setPreviewMessage("Dinliyor...");
    console.info(`[Bulut] start recording accessibility_mode=${accessibilityMode}`);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const opts: MediaRecorderOptions = { audioBitsPerSecond: 16_000 };
      for (const mime of ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"]) {
        if (MediaRecorder.isTypeSupported(mime)) { opts.mimeType = mime; break; }
      }

      const recorder = new MediaRecorder(stream, opts);
      recorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        isRecordingRef.current = false;
        cleanupRecording();

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          setPreviewMessage(null);
          return;
        }

        await sendAudioAndPreview(blob, accessibilityMode);
      };

      // Setup VAD
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let speechDetected = false;

        vadIntervalRef.current = window.setInterval(() => {
          if (!isRecordingRef.current || recorder.state === "inactive") {
            cleanupRecording();
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (const v of dataArray) sum += v;
          const volume = sum / dataArray.length / 255;

          if (volume < VAD_THRESHOLD) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
              return;
            }
            if (speechDetected && Date.now() - silenceStartRef.current > SILENCE_DURATION_MS) {
              recorder.stop();
            }
            return;
          }
          speechDetected = true;
          silenceStartRef.current = null;
        }, 50);
      }

      recorder.start(200);
      setIsRecording(true);
      isRecordingRef.current = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Bulut] microphone start failed ${message}`);
      if (message.toLowerCase().includes("permission")) {
        autoListenSuppressedRef.current = true;
      }
      setPreviewMessage(null);
      cleanupRecording();
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const cancelRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Override onstop so it doesn't send the audio
      recorder.onstop = () => {
        setIsRecording(false);
        isRecordingRef.current = false;
        cleanupRecording();
        setPreviewMessage(null);
      };
      recorder.stop();
    } else {
      setIsRecording(false);
      isRecordingRef.current = false;
      cleanupRecording();
      setPreviewMessage(null);
    }
  };

  const toggleWidget = () => {
    const newState = !isOpen;
    if (newState) {
      // Opening chat history disables accessibility mode and auto-listening.
      if (activeControllerRef.current) {
        activeControllerRef.current.stop();
      }
      cancelRecording();
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
    setIsOpen(newState);
    setShowBubble(false);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bulut_panel_open", String(newState));
    }
  };

  const toggleAccessibilityMode = () => {
    const next = !isAccessibilityEnabled;
    setIsAccessibilityEnabled(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ACCESSIBILITY_MODE_KEY, String(next));
    }
    console.info(`[Bulut] accessibility mode toggled enabled=${next}`);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (!previewMessage) {
      setPreviewMessage(INITIAL_BOT_MESSAGE_TEXT);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bulut_panel_open", "false");
    }
    console.info("Bulut chat window closed.");
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("bulut_panel_open", "false");
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearPreviewTimer();
      if (activeControllerRef.current) {
        activeControllerRef.current.stop();
        activeControllerRef.current = null;
      }
      cancelRecording();
    },
    [],
  );

  // Voice-only accessibility loop: auto-start listening whenever idle.
  useEffect(() => {
    if (!accessibilityMode) {
      return;
    }
    if (isRecording || isProcessing || autoListenSuppressedRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (
        accessibilityMode &&
        !isRecordingRef.current &&
        !isProcessingRef.current &&
        !autoListenSuppressedRef.current
      ) {
        console.info("[Bulut] accessibility auto-listen trigger");
        void startButtonRecording();
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [accessibilityMode, isRecording, isProcessing]);

  return (
    <>
      {!isOpen && (
        <ChatButton
          onMicClick={startButtonRecording}
          onCancelRecording={cancelRecording}
          onAccessibilityToggle={toggleAccessibilityMode}
          isRecording={isRecording}
          showBubble={showBubble}
          onBubbleClick={() => {
            setShowBubble(false);
            toggleWidget();
          }}
          accessibilityEnabled={isAccessibilityEnabled}
          previewMessage={previewMessage}
          onPreviewClick={() => {
            clearPreviewTimer();
            toggleWidget();
          }}
          onPreviewClose={() => {
            setPreviewMessage(null);
            clearPreviewTimer();
          }}
        />
      )}
      {isOpen && (
        <ChatWindow
          onClose={handleClose}
          config={liveConfig}
          accessibilityMode={accessibilityMode}
        />
      )}
    </>
  );
};

const SHADOW_STYLE = `
  :host {
    all: initial;
    contain: layout style paint;
    font-family: "${GEIST_FONT_FAMILY}", sans-serif;
    color: hsla(215, 100%, 5%, 1);
    font-size: 16px;
    line-height: 1.4;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  #bulut-shadow-mount {
    all: initial;
    color: inherit;
    font-family: "${GEIST_FONT_FAMILY}", sans-serif;
    font-size: inherit;
    line-height: inherit;
  }

  #bulut-shadow-mount * {
    font-family: "${GEIST_FONT_FAMILY}", sans-serif !important;
    color: inherit;
  }

  #bulut-shadow-mount *, #bulut-shadow-mount *::before, #bulut-shadow-mount *::after {
    box-sizing: border-box;
  }
`;

// Container host for the widget
let widgetContainer: HTMLElement | null = null;
let widgetMountNode: HTMLElement | null = null;
let createdContainer = false;
let isInitialized = false;

/**
 * Initialize the Bulut chat widget
 * @param options - Optional configuration options
 */
export const init = (options: BulutOptions = {}) => {
  if (isInitialized) {
    console.warn("Bulut is already initialized");
    return;
  }

  ensureGeistStylesheet();

  const runtimeConfig = resolveRuntimeConfig(options);
  applyTheme(runtimeConfig.baseColor);

  // Create or find container
  if (options.containerId) {
    widgetContainer = document.getElementById(options.containerId);
    createdContainer = false;
  } else {
    widgetContainer = document.createElement("div");
    widgetContainer.id = "bulut-container";
    document.body.appendChild(widgetContainer);
    createdContainer = true;
  }

  if (!widgetContainer) {
    console.error("Bulut: Container not found");
    return;
  }

  const shadowRoot = widgetContainer.shadowRoot || widgetContainer.attachShadow({ mode: "open" });
  shadowRoot.replaceChildren();

  const style = document.createElement("style");
  style.textContent = SHADOW_STYLE;

  const mountNode = document.createElement("div");
  mountNode.id = "bulut-shadow-mount";

  shadowRoot.append(style, mountNode);
  widgetMountNode = mountNode;

  // Render the widget
  render(<BulutWidget config={runtimeConfig} />, mountNode);
  isInitialized = true;

  console.log("Bulut initialized successfully");
};

/**
 * Destroy the Bulut widget
 */
export const destroy = () => {
  if (!isInitialized) {
    return;
  }

  if (widgetMountNode) {
    render(null, widgetMountNode);
    widgetMountNode = null;
  }

  if (widgetContainer && createdContainer) {
    document.body.removeChild(widgetContainer);
  }

  widgetContainer = null;
  createdContainer = false;
  isInitialized = false;
  console.log("Bulut destroyed");
};

/**
 * Check if the widget is initialized
 */
export const isReady = () => isInitialized;

const Bulut = {
  init,
  destroy,
  isReady,
};

if (typeof window !== "undefined") {
  (window as Window & { Bulut?: typeof Bulut }).Bulut = Bulut;
}

// Export the main widget component for advanced usage
export { BulutWidget };

// Export components for custom implementations
export { ChatButton, ChatWindow };

export default Bulut;
