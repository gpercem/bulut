// Widget dimensions
export const BUTTON_SIZE = 60;
export const WINDOW_WIDTH = 350;
export const WINDOW_HEIGHT = 500;

// Positioning
export const POSITION_BOTTOM = 20;
export const POSITION_RIGHT = 20;

// Colors
export const COLORS = {
  primary: "#6C03C1",
  primaryHover: "#6C03C1",
  background: "#ffffff",
  text: "#1F1F1F",
  textSecondary: "#1F1F1F",
  border: "#e5e7eb",
  shadow: "rgba(0, 0, 0, 0.15)",
  messageBot: "",
  messageUser: "#6C03C1",
  messageUserText: "#ffffff",
};

const normalizeHexColor = (hex: string): string => {
  const trimmed = hex.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return "#000000";
  }
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
};

export const getContrastIconFilter = (backgroundHex: string): string => {
  const hex = normalizeHexColor(backgroundHex).slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Relative luminance approximation for quick contrast choice.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "brightness(0) invert(0)" : "brightness(0) invert(1)";
};

// Border radius
export const BORDER_RADIUS = {
  button: '50%',
  window: '17px',
  message: '17px'
};

// Shadows
export const SHADOWS = {
  button: '0 4px 12px rgba(0, 0, 0, 0.15)',
  window: '0 8px 32px rgba(0, 0, 0, 0.12)'
};

// Transitions
export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  medium: '250ms ease-in-out'
};
