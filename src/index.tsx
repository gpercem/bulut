import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import "./globals.css";
import { render } from "preact";
import { ChatButton } from "./components/ChatButton";
import {
  ChatWindow,
  type ChatWindowHandle,
} from "./components/ChatWindow";
import { COLORS } from "./styles/constants";

export type BulutVoice = "alloy" | "zeynep" | "ali";

export interface BulutOptions {
  containerId?: string;
  backendBaseUrl?: string;
  projectId?: string;
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
const DEFAULT_LLM_MODEL = "x-ai/grok-4.1-fast";

const DEFAULT_AGENT_NAME = "Bulut";

const DEFAULT_CONFIG: BulutRuntimeConfig = {
  backendBaseUrl: "https://api.bulut.lu",
  projectId: "", // Must be provided
  model: DEFAULT_LLM_MODEL,
  voice: "alloy",
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
  voice: string;
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
): BulutRuntimeConfig => ({
  backendBaseUrl: options.backendBaseUrl || DEFAULT_CONFIG.backendBaseUrl,
  projectId: options.projectId || DEFAULT_CONFIG.projectId,
  model: DEFAULT_CONFIG.model,
  voice: DEFAULT_CONFIG.voice,
  baseColor: DEFAULT_CONFIG.baseColor,
  agentName: DEFAULT_CONFIG.agentName,
});

interface BulutWidgetProps {
  config: BulutRuntimeConfig;
}

const ACCESSIBILITY_MODE_KEY = "bulut_accessibility_mode_enabled";
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

const BulutWidget = ({ config }: BulutWidgetProps) => {
  // Live config that merges remote settings over initial config
  const [liveConfig, setLiveConfig] = useState<BulutRuntimeConfig>(config);
  const [configReady, setConfigReady] = useState(false);

  // Fetch remote project config on mount — widget stays hidden until done
  useEffect(() => {
    if (!config.projectId) {
      setConfigReady(true);
      return;
    }
    let cancelled = false;

    fetchRemoteConfig(config.backendBaseUrl, config.projectId).then((remote) => {
      if (cancelled) return;
      if (remote) {
        const merged: BulutRuntimeConfig = {
          ...config,
          baseColor: normalizeHexColor(remote.base_color || config.baseColor),
          model: remote.model || config.model,
          agentName: remote.agent_name || config.agentName,
          voice: (
            remote.voice === "alloy" || remote.voice === "zeynep" || remote.voice === "ali"
              ? remote.voice
              : config.voice
          ) as BulutVoice,
        };
        applyTheme(merged.baseColor);
        setLiveConfig(merged);
      }
      setConfigReady(true);
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
  const [isAccessibilityEnabled, setIsAccessibilityEnabled] = useState(() => {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem(ACCESSIBILITY_MODE_KEY) === "true";
  });

  // State reported by ChatWindow
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);

  // Ref for delegating recording to ChatWindow
  const chatActionsRef = useRef<ChatWindowHandle | null>(null);

  const handlePreviewChange = useCallback((text: string | null) => {
    setPreviewMessage(text);
    if (text !== null) setPreviewDismissed(false);
  }, []);

  // Show welcome bubble once for 5 seconds
  useEffect(() => {
    if (isAccessibilityEnabled) {
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
  }, [isOpen, isAccessibilityEnabled]);

  const toggleWidget = () => {
    const newState = !isOpen;
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

  if (!configReady) return null;

  return (
    <>
      {!isOpen && (
        <ChatButton
          onMicClick={() => chatActionsRef.current?.startRecording()}
          onCancelRecording={() => chatActionsRef.current?.cancelRecording()}
          onStopTask={() => chatActionsRef.current?.stopTask()}
          isRecording={isRecording}
          isBusy={isBusy}
          accessibilityMode={isAccessibilityEnabled}
          showBubble={showBubble}
          onBubbleClick={() => {
            setShowBubble(false);
            toggleWidget();
          }}
          previewMessage={previewDismissed ? null : previewMessage}
          onPreviewClick={() => toggleWidget()}
          onPreviewClose={() => setPreviewDismissed(true)}
        />
      )}
      <ChatWindow
        onClose={handleClose}
        config={liveConfig}
        accessibilityMode={isAccessibilityEnabled}
        onAccessibilityToggle={toggleAccessibilityMode}
        hidden={!isOpen}
        actionsRef={chatActionsRef}
        onRecordingChange={setIsRecording}
        onBusyChange={setIsBusy}
        onPreviewChange={handlePreviewChange}
      />
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
