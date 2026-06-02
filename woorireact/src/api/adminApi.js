const readArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
};

const CACHE_TTL_MS = 60 * 1000;
let adminDataCache = null;
let adminDataFetchedAt = 0;
let adminDataRequest = null;

async function fetchJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`${path} request failed: ${response.status}${message ? ` ${message}` : ""}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const setAdminDataCache = (updater) => {
  if (!adminDataCache) return null;

  adminDataCache = typeof updater === "function" ? updater(adminDataCache) : updater;
  adminDataFetchedAt = Date.now();
  return adminDataCache;
};

export const getCachedAdminData = () => adminDataCache;

const normalizeActive = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return !["inactive", "disabled", "false"].includes(value.toLowerCase());
  return true;
};

const normalizeGuardianSummary = (guardian) => ({
  id: guardian.id,
  name: guardian.name || guardian.guardianName || "No name",
  phone: guardian.phone || "",
  email: guardian.email || "",
  relation: guardian.relation || guardian.guardianRelation || "",
  active: normalizeActive(guardian.active ?? guardian.enabled ?? guardian.status),
  seniorIds: guardian.seniorIds || guardian.seniors?.map((senior) => senior.id) || [],
});

const normalizeWelfareWorker = (worker) => ({
  id: worker.id,
  workerId: worker.workerId || "",
  name: worker.name || worker.workerName || worker.socialWorkerName || "No name",
  phone: worker.phone || "",
  email: worker.email || "",
  center: worker.center || worker.organization || worker.office || "No center",
  region: worker.region || "",
  active: normalizeActive(worker.active ?? worker.enabled ?? worker.status),
});

const normalizeSenior = (profile) => {
  const senior = profile?.senior || profile || {};
  const linkedGuardians = readArray(profile, "guardians");
  const legacyGuardian =
    profile?.guardianId || profile?.guardianName || profile?.guardianPhone
      ? [
          {
            id: profile.guardianId,
            name: profile.guardianName,
            phone: profile.guardianPhone,
            relation: profile.relation,
          },
        ]
      : [];
  const guardians = [...linkedGuardians, ...legacyGuardian]
    .filter((guardian) => guardian.id || guardian.name || guardian.phone)
    .map(normalizeGuardianSummary);
  const welfareWorker = profile?.welfareWorker || profile?.socialWorker || null;
  const guardianIds = [
    ...(senior.guardianIds || []),
    ...(senior.guardians?.map((guardian) => guardian.id) || []),
    ...(profile?.guardianId ? [profile.guardianId] : []),
    ...guardians.map((guardian) => guardian.id),
  ].filter(Boolean);

  return {
    id: senior.id,
    name: senior.name || senior.seniorName || "No name",
    age: senior.age || senior.seniorAge || "",
    gender: senior.gender || "",
    phone: senior.phone || "",
    address: senior.address || senior.region || "",
    active: normalizeActive(senior.active ?? senior.enabled ?? senior.status),
    welfareId: senior.welfareWorkerId ?? senior.welfareId ?? senior.socialWorkerId ?? senior.workerId ?? null,
    guardianIds: [...new Set(guardianIds.map(String))],
    guardians,
    welfareWorker: welfareWorker ? normalizeWelfareWorker(welfareWorker) : null,
    fallApiUrl: senior.fallApiUrl || null,
  };
};

const normalizeGuardian = (guardian) => {
  const seniors = readArray(guardian, "seniors");

  return {
    ...normalizeGuardianSummary(guardian),
    seniorIds: guardian.seniorIds || seniors.map((senior) => senior.id) || [],
    seniors,
  };
};

export async function fetchAdminData({ force = false } = {}) {
  const now = Date.now();

  if (!force && adminDataCache && now - adminDataFetchedAt < CACHE_TTL_MS) {
    return adminDataCache;
  }

  if (!force && adminDataRequest) {
    return adminDataRequest;
  }

  adminDataRequest = Promise.all([
    fetchJson("/api/seniors"),
    fetchJson("/api/welfare-workers"),
    fetchJson("/api/guardians"),
  ])
    .then(([seniorData, welfareData, guardianData]) => ({
      seniors: readArray(seniorData, "seniors").map(normalizeSenior),
      welfareWorkers: readArray(welfareData, "welfareWorkers").map(normalizeWelfareWorker),
      guardians: readArray(guardianData, "guardians").map(normalizeGuardian),
    }))
    .then((nextData) => {
      adminDataCache = nextData;
      adminDataFetchedAt = Date.now();
      return nextData;
    })
    .finally(() => {
      adminDataRequest = null;
    });

  return adminDataRequest;
}

export async function refreshAdminData() {
  const [seniorData, welfareData, guardianData] = await Promise.all([
    fetchJson("/api/seniors"),
    fetchJson("/api/welfare-workers"),
    fetchJson("/api/guardians"),
  ]);

  const nextData = {
    seniors: readArray(seniorData, "seniors").map(normalizeSenior),
    welfareWorkers: readArray(welfareData, "welfareWorkers").map(normalizeWelfareWorker),
    guardians: readArray(guardianData, "guardians").map(normalizeGuardian),
  };

  adminDataCache = nextData;
  adminDataFetchedAt = Date.now();

  return nextData;
}

export async function updateSeniorWelfareWorker(seniorId, welfareWorkerId) {
  const response = await fetchJson(`/api/seniors/${seniorId}/welfare-worker`, {
    method: "PATCH",
    body: JSON.stringify({
      welfareWorkerId: welfareWorkerId ? Number(welfareWorkerId) : null,
    }),
  });

  const updatedSenior = normalizeSenior(response);
  setAdminDataCache((current) => ({
    ...current,
    seniors: current.seniors.map((senior) => (String(senior.id) === String(seniorId) ? updatedSenior : senior)),
  }));

  return updatedSenior;
}

export async function updateWelfareWorkerActive(workerId, active) {
  const response = await fetchJson(`/api/welfare-workers/${workerId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });

  const updatedWorker = normalizeWelfareWorker(response);
  setAdminDataCache((current) => ({
    ...current,
    welfareWorkers: current.welfareWorkers.map((worker) =>
      String(worker.id) === String(workerId) ? updatedWorker : worker
    ),
    seniors: current.seniors.map((senior) =>
      String(senior.welfareId) === String(workerId)
        ? {
            ...senior,
            welfareWorker: updatedWorker,
          }
        : senior
    ),
  }));

  return updatedWorker;
}

export async function updateGuardianActive(guardianId, active) {
  const response = await fetchJson(`/api/guardians/${guardianId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });

  const updatedGuardian = normalizeGuardian(response);
  setAdminDataCache((current) => ({
    ...current,
    guardians: current.guardians.map((guardian) =>
      String(guardian.id) === String(guardianId) ? { ...guardian, active: updatedGuardian.active } : guardian
    ),
    seniors: current.seniors.map((senior) => ({
      ...senior,
      guardians: (senior.guardians || []).map((guardian) =>
        String(guardian.id) === String(guardianId) ? { ...guardian, active: updatedGuardian.active } : guardian
      ),
    })),
  }));

  return updatedGuardian;
}

export const buildAdminLookups = ({ welfareWorkers, guardians }) => {
  const welfareById = new Map(welfareWorkers.map((worker) => [String(worker.id), worker]));
  const guardianById = new Map(guardians.map((guardian) => [String(guardian.id), guardian]));

  return { welfareById, guardianById };
};

export const getSeniorWelfareWorker = (senior, welfareById) =>
  senior?.welfareWorker || (senior?.welfareId ? welfareById.get(String(senior.welfareId)) : null);

export const getSeniorGuardians = (senior, guardianById) => {
  const linkedGuardians = (senior?.guardianIds || []).map((id) => guardianById.get(String(id))).filter(Boolean);
  const inlineGuardians = senior?.guardians || [];
  const guardianMap = new Map();

  linkedGuardians.forEach((guardian) => {
    guardianMap.set(String(guardian.id), guardian);
  });

  inlineGuardians.forEach((guardian) => {
    if (!guardian.id) return;

    guardianMap.set(String(guardian.id), {
      ...(guardianMap.get(String(guardian.id)) || {}),
      ...guardian,
    });
  });

  return [...guardianMap.values()];
};

export const getWorkerSeniorCount = (workerId, seniors) =>
  seniors.filter((senior) => String(senior.welfareId) === String(workerId)).length;

export const getGuardianSeniorNames = (guardian, seniors) => {
  if (guardian.seniors?.length) {
    return guardian.seniors.map((senior) => senior.name).filter(Boolean);
  }

  return seniors
    .filter((senior) => (guardian.seniorIds || []).map(String).includes(String(senior.id)))
    .map((senior) => senior.name);
};

export const getGuardianSeniorRelations = (guardian, seniors) => {
  if (guardian.seniors?.length) {
    return [
      ...new Set(
        guardian.seniors
          .map((senior) => senior.relation)
          .filter(Boolean)
      ),
    ];
  }

  return [
    ...new Set(
      seniors
        .filter((senior) => (guardian.seniorIds || []).map(String).includes(String(senior.id)))
        .flatMap((senior) => senior.guardians || [])
        .filter((linkedGuardian) => String(linkedGuardian.id) === String(guardian.id))
        .map((linkedGuardian) => linkedGuardian.relation)
        .filter(Boolean)
    ),
  ];
};
