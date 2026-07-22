import axios from 'axios';

import {
  getToken,
  getUserId,
} from '../utils/auth.js';


const SPRING_API_BASE_URL = (
  import.meta.env.VITE_SPRING_API_BASE_URL
  || 'http://localhost:8090/api'
).replace(/\/$/, '');


const guardianRelationshipApi = axios.create({
  baseURL: SPRING_API_BASE_URL,
  withCredentials: true,
  timeout: 10000,

  headers: {
    Accept: 'application/json',
  },
});


/**
 * 로그인할 때 저장된 토큰을 모든 요청에 자동으로 추가한다.
 */
guardianRelationshipApi.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => Promise.reject(error),
);


/**
 * Spring 서버가 반환한 오류 메시지를 꺼낸다.
 */
function getServerMessage(error) {
  const responseData = error.response?.data;

  if (typeof responseData === 'string') {
    return responseData.trim();
  }

  return (
    responseData?.message
    || responseData?.detail
    || responseData?.error
    || responseData?.reason
    || ''
  );
}


/**
 * 연결 해제 실패 사유를 화면에 표시할 문구로 변환한다.
 */
function getDisconnectErrorMessage(error) {
  if (error.code === 'ECONNABORTED') {
    return '서버 응답 시간이 초과되었습니다.';
  }

  if (!error.response) {
    return (
      'Spring 서버에 연결하지 못했습니다. '
      + 'localhost:8090 서버 실행 상태를 확인해 주세요.'
    );
  }

  const status = error.response.status;
  const serverMessage = getServerMessage(error);

  /*
   * 백엔드가 구체적인 메시지를 보냈다면
   * 프론트에서 임의로 바꾸지 않고 그대로 표시한다.
   */
  if (serverMessage) {
    return serverMessage;
  }

  if (status === 400) {
    return '연결 해제 요청 정보가 올바르지 않습니다.';
  }

  if (status === 401) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (status === 403) {
    return (
      '서버가 연결 해제 요청을 거부했습니다. '
      + '로그인 토큰 또는 Spring Security 설정을 확인해 주세요.'
    );
  }

  if (status === 404) {
    return (
      '보호자와 어르신의 연결 정보 또는 '
      + '연결 해제 API를 찾지 못했습니다.'
    );
  }

  if (status === 405) {
    return (
      '현재 API 주소에서 DELETE 요청을 지원하지 않습니다.'
    );
  }

  if (status === 409) {
    return (
      '이미 연결이 해제되었거나 현재 해제할 수 없는 상태입니다.'
    );
  }

  return `연결 해제 요청에 실패했습니다. (${status})`;
}


/**
 * 로그인한 보호자와 선택한 어르신의 연결만 해제한다.
 *
 * 로그인 정보에 저장된 userId를 보호자 식별값으로 사용한다.
 *
 * 요청 예시:
 * DELETE http://localhost:8090/api/seniors/guardian/3/8
 */
export async function disconnectGuardianSenior(
  seniorId,
) {
  const guardianUserId = getUserId();

  if (
    guardianUserId == null
    || String(guardianUserId).trim() === ''
  ) {
    throw new Error(
      '로그인한 보호자 정보를 찾지 못했습니다. 다시 로그인해 주세요.',
    );
  }

  if (
    seniorId == null
    || String(seniorId).trim() === ''
  ) {
    throw new Error(
      '연결을 해제할 어르신 정보를 찾지 못했습니다.',
    );
  }

  const encodedGuardianUserId = encodeURIComponent(
    String(guardianUserId),
  );

  const encodedSeniorId = encodeURIComponent(
    String(seniorId),
  );

  const requestPath = (
    `/seniors/guardian/${encodedGuardianUserId}`
    + `/${encodedSeniorId}`
  );

  const requestUrl = (
    `${SPRING_API_BASE_URL}${requestPath}`
  );

  console.log(
    '[보호자-어르신 연결 해제 요청]',
    {
      guardianUserId,
      seniorId,
      requestUrl,
      hasToken: Boolean(getToken()),
    },
  );

  try {
    const response = await guardianRelationshipApi.delete(
      requestPath,
    );

    return response.data;
  } catch (error) {
    console.error(
      '[보호자-어르신 연결 해제 실패]',
      {
        guardianUserId,
        seniorId,
        requestUrl,
        status: error.response?.status,
        responseData: error.response?.data,
        message: error.message,
      },
    );

    throw new Error(
      getDisconnectErrorMessage(error),
    );
  }
}

export async function connectGuardianSenior(name, phone) {
  try {
    const response = await guardianRelationshipApi.post(
      '/seniors/guardian/connect',
      { name: name.trim(), phone: phone.trim() },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message
      || error.response?.data?.error
      || error.response?.data
      || '어르신을 연결하지 못했습니다.',
    );
  }
}
