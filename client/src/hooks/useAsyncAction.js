import { useCallback, useState } from "react";

export function useAsyncAction(action) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (...args) => {
      setIsRunning(true);
      setError("");

      try {
        return await action(...args);
      } catch (incomingError) {
        const message = incomingError?.message || "Action failed.";
        setError(message);
        throw incomingError;
      } finally {
        setIsRunning(false);
      }
    },
    [action]
  );

  return { run, isRunning, error, setError };
}
