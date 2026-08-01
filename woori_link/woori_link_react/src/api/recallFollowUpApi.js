import api from './index'
import { getToken } from '../utils/auth.js'

const authConfig = () => {
  const token = getToken('WELFARE_WORKER')

  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {}
}

const cleanParams = params =>
  Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== '',
    ),
  )

/*
 * 후속조치 생성 및 담당 복지사 배정
 *
 * POST /api/recall-follow-ups
 */
export const createRecallFollowUp = data =>
  api.post(
    '/recall-follow-ups',
    data,
    authConfig(),
  )

/*
 * 후속조치 목록 조회
 *
 * GET /api/recall-follow-ups
 *
 * 사용 가능한 조건:
 * welfareWorkerId
 * seniorId
 * status
 */
export const getRecallFollowUps = (
  params = {},
) =>
  api.get('/recall-follow-ups', {
    ...authConfig(),
    params: cleanParams(params),
  })

/*
 * 후속조치 상세 조회
 *
 * GET /api/recall-follow-ups/{productId}
 */
export const getRecallFollowUpDetail = productId =>
  api.get(
    `/recall-follow-ups/${productId}`,
    authConfig(),
  )

/*
 * 후속조치 상태 변경
 *
 * PATCH /api/recall-follow-ups/{productId}/status
 */
export const updateRecallFollowUpStatus = (
  productId,
  data,
) =>
  api.patch(
    `/recall-follow-ups/${productId}/status`,
    data,
    authConfig(),
  )

/*
 * 현재 상태를 유지한 채 상세 기록 수정
 *
 * PATCH /api/recall-follow-ups/{productId}
 */
export const updateRecallFollowUpRecord = (
  productId,
  data,
) =>
  api.patch(
    `/recall-follow-ups/${productId}`,
    data,
    authConfig(),
  )

/*
 * 후속조치 변경 이력 조회
 *
 * GET /api/recall-follow-ups/{productId}/histories
 */
export const getRecallFollowUpHistories =
  productId =>
    api.get(
      `/recall-follow-ups/${productId}/histories`,
      authConfig(),
    )