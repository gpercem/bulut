import {
  BUTTON_SIZE,
  POSITION_BOTTOM,
  POSITION_RIGHT,
  COLORS,
  SHADOW,
  TRANSITIONS,
  BORDER_RADIUS,
  getContrastIconFilter,
} from "../styles/constants";
import { closeIconContent, microphoneIconContent } from "../assets";
import { SvgIcon } from "./SvgIcon";

interface ChatButtonProps {
  onMicClick: () => void;
  onCancelRecording: () => void;
  isRecording: boolean;
  showBubble: boolean;
  onBubbleClick: () => void;
  previewMessage: string | null;
  onPreviewClick: () => void;
  onPreviewClose: () => void;
}

export const ChatButton = ({
  onMicClick,
  onCancelRecording,
  isRecording,
  showBubble,
  onBubbleClick,
  previewMessage,
  onPreviewClick,
  onPreviewClose,
}: ChatButtonProps) => {
  const bgColor = COLORS.primary;

  const containerStyle: { [key: string]: string } = {
    position: "fixed",
    right: `${POSITION_RIGHT}px`,
    bottom: `${POSITION_BOTTOM}px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
    zIndex: "9999",
    fontFamily: "\"Geist\", sans-serif",
  };

  const controlsRowStyle: { [key: string]: string } = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  const buttonStyle: { [key: string]: string } = {
    width: `${BUTTON_SIZE}px`,
    height: `${BUTTON_SIZE}px`,
    borderRadius: BORDER_RADIUS.button,
    backgroundColor: bgColor,
    color: "#ffffff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: `background-color ${TRANSITIONS.fast}, transform ${TRANSITIONS.fast}`,
    position: "relative",
  };

  const iconStyle: { [key: string]: string } = {
    width: "24px",
    height: "24px",
    display: "block",
    filter: getContrastIconFilter(bgColor),
  };

  const handleClick = () => {
    if (isRecording) {
      onCancelRecording();
    } else {
      onMicClick();
    }
  };

  // Shared close button style
  const closeBtnStyle: { [key: string]: string } = {
    position: "absolute",
    top: "6px",
    right: "6px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    lineHeight: "1",
    color: COLORS.text,
    padding: "0",
  };

  const renderPopup = (
    content: preact.ComponentChildren,
    onClick: () => void,
    onClose: (() => void) | null,
    extraClass: string,
    scrollable: boolean,
  ) => (
    <div
      className={`bulut-popup ${extraClass}`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {/* Close button */}
      {onClose && (
        <button
          type="button"
          style={closeBtnStyle}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Kapat"
        >
          <SvgIcon
            strokeWidth={3}
            src={closeIconContent}
            stroke={"currentColor"}
            height={14}
          />
        </button>
      )}

      {/* Text content */}
      <div
        style={{
          paddingRight: onClose ? "22px" : "0",
          wordBreak: "break-word",
          ...(scrollable ? { maxHeight: "96px", overflowY: "auto" } : {}),
        }}
      >
        {content}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap');

        .bulut-popup {
          background: #ffffff;
          color: ${COLORS.text};
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.4;
          position: relative;
          overflow: visible;
          box-shadow: ${SHADOW};
        }
        .bulut-popup-bubble {
          animation: bulut-bubbleIn 400ms ease-out;
        }
        .bulut-popup-preview {
          animation: bulut-popIn ${TRANSITIONS.medium};
        }

        /* Desktop: limit width, lean to right */
        .bulut-popup {
          max-width: 320px;
        }

        /* Mobile: fill available width */
        @media (max-width: 600px) {
          .bulut-popup {
            max-width: none;
            left: 16px;
          }
        }

        @keyframes bulut-popIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes bulut-bubbleIn {
          0% { opacity: 0; transform: translateX(10px) scale(0.95); }
          60% { opacity: 1; transform: translateX(-4px) scale(1.02); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes bulut-badgeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={containerStyle}>
        <div style={controlsRowStyle}>
          {/* Welcome bubble */}
          {showBubble &&
            !isRecording &&
            !previewMessage &&
            renderPopup(
              "Destek lazımsa hemen konuşmaya başlayabiliriz!",
              onBubbleClick,
              null,
              "bulut-popup-bubble",
              false,
            )}

          {/* New-message preview */}
          {previewMessage &&
            renderPopup(
              previewMessage,
              onPreviewClick,
              onPreviewClose,
              "bulut-popup-preview",
              true,
            )}

          {/* Main mic / cancel button */}
          <button
            style={buttonStyle}
            onClick={handleClick}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                backgroundColor: COLORS.primaryHover,
                transform: "scale(1.05)",
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                transform: "scale(1)",
              });
            }}
            aria-label={isRecording ? "Kaydı iptal et" : "Konuşmaya başla"}
          >
            <SvgIcon
              src={isRecording ? closeIconContent : microphoneIconContent}
              aria-hidden="true"
              fill-opacity={0}
              stroke={"currentColor"}
              style={iconStyle}
            />
          </button>
        </div>
      </div>
    </>
  );
};
