import {
  getToken,
} from '../utils/auth.js';
import {
  RAG_API_BASE_URL,
  SPRING_API_BASE_URL,
} from '../config/api.js';


/*
 * 등록 제품과 리콜 관련 API는 Spring Boot 서버를 사용한다.
 *
 * 우선순위:
 * 1. VITE_PRODUCT_API_BASE_URL
 * 2. VITE_SPRING_API_BASE_URL
 * 3. VITE_SPRING_API_BASE_URL
 */
const PRODUCT_API_BASE_URL = (
  import.meta.env.VITE_PRODUCT_API_BASE_URL
  || import.meta.env.VITE_SPRING_API_BASE_URL
  || SPRING_API_BASE_URL
).replace(/\/$/, '');


/*
 * RAG 질문 API는 FastAPI 서버를 사용한다.
 *
 * 우선순위:
 * 1. VITE_RAG_API_BASE_URL
 * 2. VITE_RAG_API_BASE_URL
 */
const REGISTERED_PRODUCT_PATH = (
  import.meta.env.VITE_REGISTERED_PRODUCT_PATH
  || '/products/senior'
);


const RAG_QUERY_PATH = (
  import.meta.env.VITE_RAG_QUERY_PATH
  || '/chat'
);


/**
 * 로그인 과정에서 저장된 토큰을 가져온다.
 */
function getAccessToken() {
  return (
    getToken()
    || sessionStorage.getItem('accessToken')
    || sessionStorage.getItem('token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('token')
    || ''
  );
}


/**
 * 배열·페이지 응답 등 여러 응답 형태를 배열로 통일한다.
 */
function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.content)) {
    return value.content;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.result)) {
    return value.result;
  }

  if (Array.isArray(value?.data?.content)) {
    return value.data.content;
  }

  if (Array.isArray(value?.data?.items)) {
    return value.data.items;
  }

  if (Array.isArray(value?.result?.content)) {
    return value.result.content;
  }

  if (Array.isArray(value?.result?.items)) {
    return value.result.items;
  }

  return [];
}


/**
 * 응답 본문을 안전하게 읽는다.
 */
async function readResponseBody(response) {
  const contentType = response.headers.get(
    'content-type',
  );

  if (
    contentType
    && contentType.includes('application/json')
  ) {
    return response.json();
  }

  const text = await response.text();

  return text || null;
}


/**
 * 서버 응답에서 오류 메시지를 추출한다.
 */
function getErrorMessage(
  responseBody,
  status,
  requestName = '요청',
) {
  if (typeof responseBody === 'string') {
    return (
      responseBody
      || `${requestName}에 실패했습니다. (${status})`
    );
  }

  return (
    responseBody?.message
    || responseBody?.detail
    || responseBody?.error
    || `${requestName}에 실패했습니다. (${status})`
  );
}


/**
 * 공통 JSON 요청 함수
 */
async function requestJson(
  url,
  {
    method = 'GET',
    body,
    timeout = 30000,
    requestName = '요청',
  } = {},
) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeout,
  );

  const token = getAccessToken();

  try {
    const response = await fetch(url, {
      method,

      headers: {
        Accept: 'application/json',

        ...(body
          ? {
            'Content-Type': 'application/json',
          }
          : {}),

        ...(token
          ? {
            Authorization: `Bearer ${token}`,
          }
          : {}),
      },

      body,

      /*
       * Spring의 세션 쿠키 인증을 사용할 수 있도록 포함한다.
       * FastAPI에서 쿠키를 사용하지 않더라도 요청 자체에는 문제없다.
       */
      credentials: 'include',

      signal: controller.signal,
    });

    const responseBody = await readResponseBody(
      response,
    );

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          responseBody,
          response.status,
          requestName,
        ),
      );
    }

    return responseBody;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `${requestName} 중 서버 응답 시간이 초과되었습니다.`,
      );
    }

    /*
     * fetch의 Failed to fetch를 사용자에게 이해할 수 있는
     * 메시지로 변경한다.
     */
    if (
      error instanceof TypeError
      && error.message === 'Failed to fetch'
    ) {
      throw new Error(
        `${requestName} 서버에 연결하지 못했습니다. `
        + `요청 주소와 서버 실행 상태를 확인해 주세요. (${url})`,
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}


export async function getGuardianRecallProducts(
  seniorIds = [],
) {
  const validSeniorIds = seniorIds.filter(
    (seniorId) => (
      seniorId != null
      && String(seniorId).trim() !== ''
    ),
  );

  if (validSeniorIds.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    validSeniorIds.map(async (seniorId) => {
      const encodedSeniorId = encodeURIComponent(
        String(seniorId),
      );

      const requestUrl = (
        `${PRODUCT_API_BASE_URL}`
        + `${REGISTERED_PRODUCT_PATH}`
        + `/${encodedSeniorId}`
      );

      const response = await requestJson(
        requestUrl,
        {
          method: 'GET',
          requestName: '등록 제품 조회',
        },
      );

      return normalizeArray(response).map((product) => ({
        ...product,

        seniorId: (
          product?.seniorId
          ?? product?.senior?.id
          ?? seniorId
        ),
      }));
    }),
  );

  const products = results
    .filter((result) => (
      result.status === 'fulfilled'
    ))
    .flatMap((result) => result.value);

  const failedResults = results.filter(
    (result) => result.status === 'rejected',
  );

  const allRequestsFailed = (
    failedResults.length === results.length
  );

  if (allRequestsFailed) {
    const firstError = failedResults[0];

    throw (
      firstError?.reason
      || new Error(
        '등록 제품을 불러오지 못했습니다.',
      )
    );
  }

  /*
   * 일부 님의 제품 조회만 실패한 경우에는
   * 성공한 결과를 그대로 반환한다.
   */
  if (failedResults.length > 0) {
    console.warn(
      '일부 님의 등록 제품 조회 실패:',
      failedResults.map((result) => (
        result.reason?.message
        || result.reason
      )),
    );
  }

  return products;
}


/**
 * 보호자용 RAG 질문을 전송한다.
 *
 * FastAPI 요청 예시:
 * POST /chat
 *
 * 요청 본문:
 * {
 *   question: "...",
 *   role: "GUARDIAN",
 *   topK: 5
 * }
 */
export async function askGuardianRag(
  question,
  history = [],
  profile = null,
  mode = 'qa',
) {
  const trimmedQuestion = String(
    question ?? '',
  ).trim();

  if (!trimmedQuestion) {
    throw new Error(
      '질문을 입력해 주세요.',
    );
  }

  const requestUrl = (
    `${RAG_API_BASE_URL}${RAG_QUERY_PATH}`
  );

  const response = await requestJson(
    requestUrl,
    {
      method: 'POST',

      body: JSON.stringify({
        question: trimmedQuestion,
        mode,
        audience: 'guardian',
        profile,

        history: history.map((message) => ({
          role: message.role,
          text: message.text,
        })),

        limit: 5,

        // 이전 RAG 서버와의 하위 호환 필드
        role: 'GUARDIAN',
        topK: 5,
      }),

      timeout: 90000,
      requestName: '복지·안전 도우미 질문',
    },
  );

  const data = (
    response?.data
    ?? response?.result
    ?? response
  );

  const answer = (
    data?.answer
    ?? data?.response
    ?? data?.message
    ?? data?.result?.answer
    ?? (
      typeof data === 'string'
        ? data
        : ''
    )
  );

  const rawSources = (
    data?.sources
    ?? data?.references
    ?? data?.documents
    ?? data?.contexts
    ?? data?.result?.sources
    ?? []
  );

  const sources = normalizeArray(
    rawSources,
  ).map((source, index) => {
    if (typeof source === 'string') {
      return {
        id: `source-${index}`,
        title: source,
        description: '',
        url: '',
      };
    }

    return {
      id: (
        source?.id
        ?? source?.documentId
        ?? source?.document_id
        ?? `source-${index}`
      ),

      title: (
        source?.title
        ?? source?.service_name
        ?? source?.filename
        ?? source?.documentTitle
        ?? source?.document_title
        ?? source?.name
        ?? `근거 문서 ${index + 1}`
      ),

      description: (
        source?.description
        ?? source?.snippet
        ?? source?.content
        ?? source?.text
        ?? ''
      ),

      url: (
        source?.source_url
        ?? source?.url
        ?? source?.link
        ?? ''
      ),
      authority: source?.authority ?? source?.department ?? '',
      effectiveYear: source?.effective_year ?? source?.effectiveYear ?? null,
    };
  }).filter((source) => {
    const internalTitle = String(source.title || '').trim().toLowerCase().replaceAll(' ', '_');
    return !['current_upload', 'woori-vault', 'obsidian'].includes(internalTitle);
  }).filter((source, index, items) => (
    items.findIndex((item) => item.title === source.title) === index
  ));

  if (!answer) {
    throw new Error(
      '서버에서 답변 내용을 받지 못했습니다.',
    );
  }

  return {
    answer,
    sources,
    assessment: data?.assessment ?? data?.result?.assessment ?? null,
  };
}
