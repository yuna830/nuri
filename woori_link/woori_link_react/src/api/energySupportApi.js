import api from './index';


export const getEnergySupportCandidates = (
  welfareWorkerId,
  type,
  scope = 'ACTIVE',
) => {
  return api.get(
    '/energy-support/candidates',
    {
      params: {
        welfareWorkerId,
        type,
        scope,
      },
    },
  );
};


export const updateEnergySupportCase = (
  seniorId,
  type,
  data,
) => {
  return api.put(
    `/energy-support/${seniorId}/${type}`,
    data,
  );
};


export const getGasDiscountDetail = (
  seniorId,
) => {
  if (!seniorId) {
    return Promise.reject(
      new Error(
        '도시가스 정보를 조회할 대상자 ID가 없습니다.',
      ),
    );
  }

  return api.get(
    `/energy-support/gas/${seniorId}`,
  );
};

export const getEnergySupportProfile = async (
  seniorId,
) => {
  if (!seniorId) {
    return Promise.reject(
      new Error('공통 에너지복지 정보를 조회할 대상자 ID가 없습니다.'),
    );
  }
  const response = await api.get(
    `/energy-support/profile/${seniorId}`,
  );
  return response.data;
};


export const getElectricityDiscountDetail = async (
  seniorId,
) => {
  if (!seniorId) {
    return Promise.reject(
      new Error(
        '전기요금 정보를 조회할 대상자 ID가 없습니다.',
      ),
    );
  }

  const response = await api.get(
    `/energy-support/electricity/${seniorId}`,
  );

  return response.data;
};


export const getEnergyVoucherDetail = async (
  seniorId,
) => {
  if (!seniorId) {
    return Promise.reject(
      new Error(
        '에너지바우처 정보를 조회할 대상자 ID가 없습니다.',
      ),
    );
  }

  const response = await api.get(
    `/energy-support/voucher/${seniorId}`,
  );

  return response.data;
};
