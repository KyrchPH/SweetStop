import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function FormSelect({
  disabled = false,
  label,
  name,
  onChange,
  options = [],
  placeholder = "Select option",
  required = false,
  value
}) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const viewportPadding = 16;
      const menuWidth = Math.min(Math.max(rect.width, 260), window.innerWidth - viewportPadding * 2);
      const left = Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding);

      setMenuStyle({
        left: `${Math.max(viewportPadding, left)}px`,
        top: `${rect.bottom + 8}px`,
        width: `${menuWidth}px`
      });
    }

    function closeOnOutsideClick(event) {
      const target = event.target;

      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    updateMenuPosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  function selectOption(option) {
    if (option.disabled) {
      return;
    }

    onChange?.({
      target: {
        name,
        value: option.value
      }
    });
    setIsOpen(false);
  }

  return (
    <label className="form-select-field">
      {label ? <span>{label}</span> : null}
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-required={required}
        className={`form-select-button ${isOpen ? "is-open" : ""} ${!selectedOption ? "is-placeholder" : ""}`}
        disabled={disabled || options.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className="form-select-chevron" size={18} />
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="form-select-menu"
              id={listboxId}
              ref={menuRef}
              role="listbox"
              style={menuStyle}
            >
              {options.length === 0 ? (
                <div className="form-select-empty">No options available</div>
              ) : (
                options.map((option) => {
                  const isActive = String(option.value) === String(value);

                  return (
                    <button
                      aria-selected={isActive}
                      className={`form-select-option ${isActive ? "is-active" : ""}`}
                      disabled={option.disabled}
                      key={option.value}
                      onClick={() => selectOption(option)}
                      role="option"
                      type="button"
                    >
                      <span>
                        <strong>{option.label}</strong>
                        {option.description ? <small>{option.description}</small> : null}
                      </span>
                      {isActive ? <Check size={18} /> : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body
          )
        : null}
    </label>
  );
}

export default FormSelect;
