import { useCallback, useEffect, useState } from "react";

const DEFAULT_STALE_MS = 5 * 60 * 1000;
const resourceCache = new Map();

function getCachedResource(cacheKey) {
  return cacheKey ? resourceCache.get(cacheKey) ?? null : null;
}

function isCacheFresh(cached, staleMs) {
  return Boolean(cached) && Date.now() - cached.updatedAt < staleMs;
}

export function invalidateApiResource(cacheKey) {
  if (cacheKey) {
    resourceCache.delete(cacheKey);
  }
}

export function invalidateApiResourcePrefix(prefix) {
  if (!prefix) {
    return;
  }

  for (const cacheKey of resourceCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      resourceCache.delete(cacheKey);
    }
  }
}

export function useApiResource(loader, dependencies = [], options = {}) {
  const { cacheKey, staleMs = DEFAULT_STALE_MS } = options;
  const cached = getCachedResource(cacheKey);
  const [data, setStateData] = useState(cached?.data ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState("");

  const setData = useCallback(
    (nextData) => {
      const resolvedData =
        typeof nextData === "function" ? nextData(getCachedResource(cacheKey)?.data ?? data) : nextData;

      if (cacheKey) {
        resourceCache.set(cacheKey, {
          data: resolvedData,
          updatedAt: Date.now()
        });
      }

      setStateData(resolvedData);
    },
    [cacheKey, data]
  );

  const reload = useCallback(async (reloadOptions = {}) => {
    const force = reloadOptions?.force === true;
    const currentCache = getCachedResource(cacheKey);

    if (!force && isCacheFresh(currentCache, staleMs)) {
      setStateData(currentCache.data);
      setIsLoading(false);
      setError("");
      return currentCache.data;
    }

    setIsLoading(!currentCache);
    setError("");

    try {
      const nextData = await loader();
      if (cacheKey) {
        resourceCache.set(cacheKey, {
          data: nextData,
          updatedAt: Date.now()
        });
      }

      setStateData(nextData);
      return nextData;
    } catch (incomingError) {
      setError(incomingError?.message || "Unable to load data.");

      if (!currentCache) {
        setStateData(null);
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [...dependencies, cacheKey, staleMs]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, isLoading, error, setError, reload };
}
