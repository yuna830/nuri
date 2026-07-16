const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api';

const PRODUCT_API_BASE_URL = (
  import.meta.env.VITE_PRODUCT_API_BASE_URL
  || import.meta.env.VITE_API_BASE_URL
  || DEFAULT_API_BASE_URL
).replace(/\/$/, '');

const RAG_API_BASE_URL = (
  import.meta.env.VITE_RAG_API_BASE_URL
  || import.meta.env.VITE_API_BASE_URL
  || DEFAULT_API_BASE_URL
).replace(/\/$/, '');

const REGISTERED_PRODUCT_PATH = (
  import.meta.env.VITE_REGISTERED_PRODUCT_PATH
  || '/registered-products/senior'
);

const RAG_QUERY_PATH = (
  import.meta.env.VITE_RAG_QUERY_PATH
  || '/rag/query'
);


/**
 * 로그인 과정에서 저장된 토큰을 가져온다.
 */
function getAccessToken() {
  return (
    sessionStorage.getItem('accessToken')
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

  return [];
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
      credentials: 'include',
      signal: controller.signal,
    });

    const contentType = response.headers.get(
      'content-type',
    );

    const responseBody = contentType?.includes(
      'application/json',
    )
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = (
        responseBody?.message
        || responseBody?.detail
        || responseBody?.error
        || (
          typeof responseBody === 'string'
            ? responseBody
            : ''
        )
        || `요청에 실패했습니다. (${response.status})`
      );

      throw new Error(message);
    }

    return responseBody;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        '서버 응답 시간이 초과되었습니다.',
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}


/**
 * 보호자에게 연결된 모든 어르신의 등록 제품을 조회한다.
 *
 * 기본 요청 주소:
 * GET /api/registered-products/senior/{seniorId}
 */
export async function getGuardianRecallProducts(
  seniorIds = [],
) {
  const validSeniorIds = seniorIds.filter(
    (seniorId) => seniorId != null,
  );

  if (validSeniorIds.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    validSeniorIds.map(async (seniorId) => {
      const encodedSeniorId = encodeURIComponent(
        seniorId,
      );

      const response = await requestJson(
        `${PRODUCT_API_BASE_URL}`
        + `${REGISTERED_PRODUCT_PATH}`
        + `/${encodedSeniorId}`,
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

  const allRequestsFailed = results.every(
    (result) => result.status === 'rejected',
  );

  if (allRequestsFailed) {
    const firstError = results.find(
      (result) => result.status === 'rejected',
    );

    throw (
      firstError?.reason
      || new Error('등록 제품을 불러오지 못했습니다.')
    );
  }

  return products;
}


/**
 * 보호자용 RAG 질문을 전송한다.
 *
 * 기본 요청 주소:
 * POST /api/rag/query
 *
 * 기본 요청:
 * {
 *   question: "...",
 *   role: "GUARDIAN",
 *   topK: 5
 * }
 */
export async function askGuardianRag(question) {
  const trimmedQuestion = String(
    question ?? '',
  ).trim();

  if (!trimmedQuestion) {
    throw new Error('질문을 입력해 주세요.');
  }

  const response = await requestJson(
    `${RAG_API_BASE_URL}${RAG_QUERY_PATH}`,
    {
      method: 'POST',

      body: JSON.stringify({
        question: trimmedQuestion,
        role: 'GUARDIAN',
        topK: 5,
      }),

      timeout: 45000,
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

  const sources = normalizeArray(rawSources).map(
    (source, index) => {
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
          ?? `source-${index}`
        ),

        title: (
          source?.title
          ?? source?.documentTitle
          ?? source?.source
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
          source?.url
          ?? source?.link
          ?? ''
        ),
      };
    },
  );

  if (!answer) {
    throw new Error(
      '서버에서 답변 내용을 받지 못했습니다.',
    );
  }

  return {
    answer,
    sources,
  };
}