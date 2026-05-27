import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

function PasswordField({
  autoComplete,
  label = "Password",
  name = "password",
  onChange,
  required = false,
  value
}) {
  const [isVisible, setIsVisible] = useState(false);
  const inputId = `${name}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <label>
      <span>{label}</span>
      <div className="password-input-wrap">
        <input
          autoComplete={autoComplete}
          id={inputId}
          name={name}
          onChange={onChange}
          required={required}
          type={isVisible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={isVisible ? "Hide password" : "Show password"}
          className="password-toggle"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          <Icon size={18} />
        </button>
      </div>
    </label>
  );
}

export default PasswordField;
