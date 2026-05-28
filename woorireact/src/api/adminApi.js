const readArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
};

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
  const guardians = readArray(profile, "guardians").map(normalizeGuardianSummary);
  const welfareWorker = profile?.welfareWorker || profile?.socialWorker || null;

  return {
    id: senior.id,
    name: senior.name || senior.seniorName || "No name",
    age: senior.age || senior.seniorAge || "",
    gender: senior.gender || "",
    phone: senior.phone || "",
    address: senior.address || senior.region || "",
    active: normalizeActive(senior.active ?? senior.enabled ?? senior.status),
    welfareId: senior.welfareWorkerId ?? senior.welfareId ?? senior.socialWorkerId ?? senior.workerId ?? null,
    guardianIds:
      senior.guardianIds ||
      guardians.map((guardian) => guardian.id) ||
      senior.guardians?.map((guardian) => guardian.id) ||
      [],
    guardians,
    welfareWorker: welfareWorker ? normalizeWelfareWorker(welfareWorker) : null,
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

export async function fetchAdminData() {
  const [seniorData, welfareData, guardianData] = await Promise.all([
    fetchJson("/api/seniors"),
    fetchJson("/api/welfare-workers"),
    fetchJson("/api/guardians"),
  ]);

  return {
    seniors: readArray(seniorData, "seniors").map(normalizeSenior),
    welfareWorkers: readArray(welfareData, "welfareWorkers").map(normalizeWelfareWorker),
    guardians: readArray(guardianData, "guardians").map(normalizeGuardian),
  };
}

export async function updateSeniorWelfareWorker(seniorId, welfareWorkerId) {
  return fetchJson(`/api/seniors/${seniorId}/welfare-worker`, {
    method: "PATCH",
    body: JSON.stringify({
      welfareWorkerId: welfareWorkerId ? Number(welfareWorkerId) : null,
    }),
  });
}

export async function updateWelfareWorkerActive(workerId, active) {
  return fetchJson(`/api/welfare-workers/${workerId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function updateGuardianActive(guardianId, active) {
  return fetchJson(`/api/guardians/${guardianId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export const buildAdminLookups = ({ welfareWorkers, guardians }) => {
  const welfareById = new Map(welfareWorkers.map((worker) => [String(worker.id), worker]));
  const guardianById = new Map(guardians.map((guardian) => [String(guardian.id), guardian]));

  return { welfareById, guardianById };
};

export const getSeniorWelfareWorker = (senior, welfareById) =>
  senior?.welfareWorker || (senior?.welfareId ? welfareById.get(String(senior.welfareId)) : null);

export const getSeniorGuardians = (senior, guardianById) =>
  senior?.guardians?.length
    ? senior.guardians
    : (senior?.guardianIds || []).map((id) => guardianById.get(String(id))).filter(Boolean);

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
