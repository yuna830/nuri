import api from './index';


function validateSeniorId(
  seniorId,
  message,
) {
  if (
    seniorId === null
    || seniorId === undefined
    || seniorId === ''
  ) {
    throw new Error(message);
  }
}


function validateRequestId(
  requestId,
  message,
) {
  if (
    requestId === null
    || requestId === undefined
    || requestId === ''
  ) {
    throw new Error(message);
  }
}


/* =========================================================
 * 에너지복지 완료 상태
 * ========================================================= */

/**
 * 에너지복지 필수 정보 완료 상태 조회
 *
 * GET /api/energy-support/completion/{seniorId}
 */
export async function getEnergySupportCompletion(
  seniorId,
) {
  validateSeniorId(
    seniorId,
    '완료 상태를 조회할 대상자 ID가 없습니다.',
  );

  const response = await api.get(
    `/energy-support/completion/${seniorId}`,
  );

  return response.data;
}


/* =========================================================
 * 복지사 에너지복지 대상자 관리
 * ========================================================= */

/**
 * 복지사 에너지복지 대상자 목록 조회
 *
 * GET /api/energy-support/candidates
 */
export async function getEnergySupportCandidates(
  welfareWorkerId,
  type,
  scope = 'ACTIVE',
) {
  const response = await api.get(
    '/energy-support/candidates',
    {
      params: {
        welfareWorkerId,
        type,
        scope,
      },
    },
  );

  return response.data;
}


/**
 * 복지사 에너지복지 처리 상태 수정
 *
 * PUT /api/energy-support/{seniorId}/{type}
 */
export async function updateEnergySupportCase(
  seniorId,
  type,
  data,
) {
  validateSeniorId(
    seniorId,
    '에너지복지 정보를 수정할 대상자 ID가 없습니다.',
  );

  if (!type) {
    throw new Error(
      '수정할 에너지복지 유형이 없습니다.',
    );
  }

  const response = await api.put(
    `/energy-support/${seniorId}/${type}`,
    data,
  );

  return response.data;
}


/* =========================================================
 * 공통 에너지복지 정보
 * ========================================================= */

/**
 * 공통 에너지복지 정보 조회
 *
 * GET /api/energy-support/profile/{seniorId}
 */
export async function getEnergySupportProfile(
  seniorId,
) {
  validateSeniorId(
    seniorId,
    '공통 에너지복지 정보를 조회할 대상자 ID가 없습니다.',
  );

  const response = await api.get(
    `/energy-support/profile/${seniorId}`,
  );

  return response.data;
}


/**
 * 공통 에너지복지 정보 저장
 *
 * PUT /api/energy-support/profile/{seniorId}
 */
export async function saveEnergySupportProfile(
  seniorId,
  data,
) {
  validateSeniorId(
    seniorId,
    '공통 에너지복지 정보를 저장할 대상자 ID가 없습니다.',
  );

  const response = await api.put(
    `/energy-support/profile/${seniorId}`,
    data,
  );

  return response.data;
}


/* =========================================================
 * 에너지바우처 상세 정보
 * ========================================================= */

/**
 * 에너지바우처 상세 정보 조회
 *
 * GET /api/energy-support/voucher/{seniorId}
 */
export async function getEnergyVoucherDetail(
  seniorId,
) {
  validateSeniorId(
    seniorId,
    '에너지바우처 정보를 조회할 대상자 ID가 없습니다.',
  );

  const response = await api.get(
    `/energy-support/voucher/${seniorId}`,
  );

  return response.data;
}


/**
 * 에너지바우처 상세 정보 저장
 *
 * PUT /api/energy-support/voucher/{seniorId}
 */
export async function saveEnergyVoucherDetail(
  seniorId,
  data,
) {
  validateSeniorId(
    seniorId,
    '에너지바우처 정보를 저장할 대상자 ID가 없습니다.',
  );

  const response = await api.put(
    `/energy-support/voucher/${seniorId}`,
    data,
  );

  return response.data;
}


/* =========================================================
 * 전기요금 할인 상세 정보
 * ========================================================= */

/**
 * 전기요금 할인 상세 정보 조회
 *
 * GET /api/energy-support/electricity/{seniorId}
 */
export async function getElectricityDiscountDetail(
  seniorId,
) {
  validateSeniorId(
    seniorId,
    '전기요금 정보를 조회할 대상자 ID가 없습니다.',
  );

  const response = await api.get(
    `/energy-support/electricity/${seniorId}`,
  );

  return response.data;
}


/**
 * 전기요금 할인 상세 정보 저장
 *
 * PUT /api/energy-support/electricity/{seniorId}
 */
export async function saveElectricityDiscountDetail(
  seniorId,
  data,
) {
  validateSeniorId(
    seniorId,
    '전기요금 정보를 저장할 대상자 ID가 없습니다.',
  );

  const response = await api.put(
    `/energy-support/electricity/${seniorId}`,
    data,
  );

  return response.data;
}


/* =========================================================
 * 도시가스요금 경감 상세 정보
 * ========================================================= */

/**
 * 도시가스요금 경감 상세 정보 조회
 *
 * GET /api/energy-support/gas/{seniorId}
 */
export async function getGasDiscountDetail(
  seniorId,
) {
  validateSeniorId(
    seniorId,
    '도시가스 정보를 조회할 대상자 ID가 없습니다.',
  );

  const response = await api.get(
    `/energy-support/gas/${seniorId}`,
  );

  return response.data;
}


/**
 * 도시가스요금 경감 상세 정보 저장
 *
 * PUT /api/energy-support/gas/{seniorId}
 */
export async function saveGasDiscountDetail(
  seniorId,
  data,
) {
  validateSeniorId(
    seniorId,
    '도시가스 정보를 저장할 대상자 ID가 없습니다.',
  );

  const response = await api.put(
    `/energy-support/gas/${seniorId}`,
    data,
  );

  return response.data;
}


/* =========================================================
 * 에너지복지 상담·확인 요청
 * ========================================================= */

/**
 * 보호자가 담당 복지사에게 정보 확인 요청
 *
 * POST /api/energy-support/consultations/seniors/{seniorId}
 */
export async function requestEnergySupportConsultation(
  seniorId,
  message = '',
) {
  validateSeniorId(
    seniorId,
    '상담을 요청할 대상자 ID가 없습니다.',
  );

  const response = await api.post(
    `/energy-support/consultations/seniors/${seniorId}`,
    {
      message:
        String(
          message ?? '',
        ).trim()
        || null,
    },
  );

  return response.data;
}


/**
 * 해당 어르신의 진행 중인 확인 요청 조회
 *
 * GET /api/energy-support/consultations/seniors/{seniorId}/active
 *
 * 진행 중인 요청이 없으면 백엔드가 204를 반환한다.
 */
export async function getActiveEnergySupportConsultation(
  seniorId,
) {
  validateSeniorId(
    seniorId,
    '상담 요청 상태를 조회할 대상자 ID가 없습니다.',
  );

  const response = await api.get(
    `/energy-support/consultations/seniors/${seniorId}/active`,
  );

  if (
    response.status === 204
    || !response.data
  ) {
    return null;
  }

  return response.data;
}


/**
 * 복지사에게 배정된 에너지복지 확인 요청 목록 조회
 *
 * GET /api/energy-support/consultations/worker
 */
export async function getEnergySupportConsultationRequests() {
  const response = await api.get(
    '/energy-support/consultations/worker',
  );

  return Array.isArray(response.data)
    ? response.data
    : [];
}


/**
 * 복지사가 확인 요청 처리 시작
 *
 * PATCH /api/energy-support/consultations/{requestId}/start
 */
export async function startEnergySupportConsultation(
  requestId,
) {
  validateRequestId(
    requestId,
    '처리할 상담 요청 ID가 없습니다.',
  );

  const response = await api.patch(
    `/energy-support/consultations/${requestId}/start`,
  );

  return response.data;
}


/**
 * 복지사가 확인 요청 처리 완료
 *
 * PATCH /api/energy-support/consultations/{requestId}/resolve
 */
export async function resolveEnergySupportConsultation(
  requestId,
  resolutionNote = '',
) {
  validateRequestId(
    requestId,
    '완료할 상담 요청 ID가 없습니다.',
  );

  const response = await api.patch(
    `/energy-support/consultations/${requestId}/resolve`,
    {
      resolutionNote:
        String(
          resolutionNote ?? '',
        ).trim()
        || null,
    },
  );

  return response.data;
}