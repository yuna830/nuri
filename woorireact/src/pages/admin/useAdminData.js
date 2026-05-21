import { useCallback, useEffect, useMemo, useState } from "react";

import { buildAdminLookups, fetchAdminData } from "../../api/adminApi";

export function useAdminData() {
  const [data, setData] = useState({
    seniors: [],
    welfareWorkers: [],
    guardians: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const nextData = await fetchAdminData();
      setData(nextData);
    } catch (error) {
      setLoadError(error.message || "Failed to load admin data.");
      setData({
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

  return { ...data, ...lookups, isLoading, loadError, reload: load };
}
