import { TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";

function ErrorDialog({ message, onClose, title = "Action failed" }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className="dialog-layer" onMouseDown={onClose} role="presentation">
      <section
        aria-labelledby="error-dialog-title"
        aria-modal="true"
        className="error-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <button aria-label="Close error dialog" className="icon-button dialog-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <span className="dialog-icon">
          <TriangleAlert size={22} />
        </span>
        <div>
          <span className="section-kicker">Error</span>
          <h2 id="error-dialog-title">{title}</h2>
          <p>{message}</p>
        </div>
        <button className="primary-button full-width" onClick={onClose} type="button">
          Close
        </button>
      </section>
    </div>
  );
}

export default ErrorDialog;
