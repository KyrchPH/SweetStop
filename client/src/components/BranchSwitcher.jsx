import { Check, ChevronDown, Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function BranchSwitcher({ activeBranchId, branches, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef(null);
  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? branches[0] ?? null;

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!switcherRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function selectBranch(branchId) {
    onChange(branchId);
    setIsOpen(false);
  }

  return (
    <div className="branch-switcher" ref={switcherRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`branch-switcher-button ${isOpen ? "is-open" : ""}`}
        disabled={branches.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Store size={18} />
        <span>{activeBranch?.name ?? "No branch"}</span>
        <ChevronDown className="branch-switcher-chevron" size={18} />
      </button>

      {isOpen ? (
        <div className="branch-switcher-menu" role="listbox" aria-label="Active branch">
          {branches.map((branch) => {
            const isActive = branch.id === activeBranchId;

            return (
              <button
                aria-selected={isActive}
                className={`branch-switcher-option ${isActive ? "is-active" : ""}`}
                key={branch.id}
                onClick={() => selectBranch(branch.id)}
                role="option"
                type="button"
              >
                <span>
                  <strong>{branch.name}</strong>
                  <small>{branch.address || branch.timezone || "SweetStop branch"}</small>
                </span>
                {isActive ? <Check size={18} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default BranchSwitcher;
