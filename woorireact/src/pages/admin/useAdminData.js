import { useCallback, useEffect, useMemo, useState } from "react";

import { buildAdminLookups, fetchAdminData, getCachedAdminData } from "../../api/adminApi";

export function useAdminData() {
  const cachedData = getCachedAdminData();
  const [data, setData] = useState(cachedData || {
    seniors: [],
    welfareWorkers: [],
    guardians: [],
  });
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async ({ force = false } = {}) => {
    setIsLoading((current) => force || !getCachedAdminData() || current);
    setLoadError("");

    try {
      const nextData = await fetchAdminData({ force });
      setData(nextData);
    } catch (error) {
      setLoadError(error.message || "Failed to load admin data.");
      setData(getCachedAdminData() || {
        seniors: [],
        welfareWorkers: [],
        guardians: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
     
    load();
  }, [load]);

  const lookups = useMemo(() => buildAdminLookups(data), [data]);

  const reload = useCallback(() => load({ force: true }), [load]);

  return { ...data, ...lookups, isLoading, loadError, reload };
}
