import { X } from "lucide-react";
import { useEffect, useId } from "react";

function FormDialog({ children, isOpen, kicker = "Form", onClose, title, width = "default" }) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-layer" onMouseDown={onClose} role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`form-dialog ${width === "wide" ? "is-wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close form dialog" className="icon-button dialog-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <div className="form-dialog-header">
          <div>
            <span className="section-kicker">{kicker}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
        </div>
        <div className="form-dialog-body">{children}</div>
      </section>
    </div>
  );
}

export default FormDialog;
