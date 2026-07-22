import api from './index.js';
import { getUserId } from '../utils/auth.js';

export const getGuardians = () =>
  api.get('/guardians');

export const getSeniorsByGuardian = () =>
  api.get(`/seniors/by-guardian/${getUserId()}`);

export const getSenior = (id) =>
  api.get(`/seniors/${id}`);

export const getLatestRisk = (seniorId) =>
  api.get(`/risk/senior/${seniorId}/latest`);

export const assessRisk = (seniorId) =>
  api.post(`/risk/assess/${seniorId}`);

export const getProductsBySenior = (seniorId) =>
  api.get(`/products/senior/${seniorId}`);

export const getActionsBySenior = (seniorId) =>
  api.get(`/actions/senior/${seniorId}`);

export const getGuardianAlerts = () =>
  api.get(`/care/guardians/${getUserId()}/alerts`);

export const acknowledgeAlert = (
  alertId,
  resolved = false,
) =>
  api.patch(
    `/care/alerts/${alertId}`,
    { resolved },
  );

export const getLatestLocation = (seniorId) =>
  api.get(
    `/care/seniors/${seniorId}/locations/latest`,
  );

export const getSafetyZone = (seniorId) =>
  api.get(
    `/care/seniors/${seniorId}/safety-zone`,
  );

export const saveSafetyZone = (
  seniorId,
  data,
) =>
  api.put(
    `/care/seniors/${seniorId}/safety-zone`,
    data,
  );

export const deleteSafetyZone = (
  seniorId,
  zoneId,
) =>
  api.delete(
    `/care/seniors/${seniorId}/safety-zone/${zoneId}`,
  );

/**
 * 님의 안부 확인 기록을 조회한다.
 */
export const getCheckIns = (seniorId) =>
  api.get(
    `/care/seniors/${seniorId}/check-ins`,
  );

/**
 * 최근 7일 안부 응답 통계와
 * 규칙 기반 상태 판정 결과를 조회한다.
 */
export const getCheckInAnalysis = (seniorId) =>
  api.get(
    `/care/seniors/${seniorId}/check-in-analysis`,
  );

/**
 * 보호자가 수동으로 즉시 안부 확인을 요청한다.
 */
export const requestCheckIn = (seniorId) =>
  api.post(
    `/care/seniors/${seniorId}/check-ins`,
  );

/**
 * 님의 자동 안부 확인 설정을 조회한다.
 *
 * 아직 설정을 저장하지 않은 경우에도
 * 서버에서 기본값을 반환한다.
 */
export const getCheckInSchedule = (seniorId) =>
  api.get(
    `/care/seniors/${seniorId}/check-in-schedule`,
  );

/**
 * 님의 자동 안부 확인 설정을
 * 새로 저장하거나 기존 설정을 수정한다.
 *
 * data 예시:
 * {
 *   enabled: true,
 *   requestTime: '09:00',
 *   timeoutMinutes: 30,
 *   timezone: 'Asia/Seoul',
 * }
 */
export const saveCheckInSchedule = (
  seniorId,
  data,
) =>
  api.put(
    `/care/seniors/${seniorId}/check-in-schedule`,
    data,
  );

export const getCareEvents = (seniorId) =>
  api.get(
    `/care/seniors/${seniorId}/events`,
  );
