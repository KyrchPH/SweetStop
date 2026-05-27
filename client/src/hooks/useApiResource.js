import { useCallback, useEffect, useState } from "react";

export function useApiResource(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextData = await loader();
      setData(nextData);
      return nextData;
    } catch (incomingError) {
      setError(incomingError?.message || "Unable to load data.");
      setData(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, isLoading, error, setError, reload };
}
