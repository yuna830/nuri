import { useEffect, useState } from 'react';
import { acknowledgeAlert, getCheckIns, getGuardianAlerts, getLatestLocation, getSafetyZone } from '../../api/guardianApi.js';

export default function CareStatusPanel({ seniorId }) {
  const [data, setData] = useState({ alerts: [], location: null, zone: null, checkIn: null });
  const load = async () => {
    const [alerts, location, zone, checkIns] = await Promise.all([
      getGuardianAlerts(), getLatestLocation(seniorId), getSafetyZone(seniorId), getCheckIns(seniorId),
    ]);
    setData({ alerts: alerts.data.filter((item) => item.seniorId === seniorId), location: location.data, zone: zone.data, checkIn: checkIns.data?.[0] });
  };
  useEffect(() => { load().catch(() => {}); }, [seniorId]);
  const handle = async (id, resolved) => { await acknowledgeAlert(id, resolved); await load(); };
  return <div className="card" style={{ marginTop: 20 }}>
    <div className="card-title">돌봄 현황</div>
    <p>현재 위치: {data.location ? `${data.location.latitude}, ${data.location.longitude}` : '수신 전'}</p>
    <p>안전반경: {data.zone?.enabled ? `${data.zone.radiusMeters}m` : '설정 안 됨'}</p>
    <p>최근 안부: {data.checkIn?.status || '기록 없음'}</p>
    {data.alerts.map((alert) => <div className="checklist-item" key={alert.id}>
      <span>{alert.title}</span><span>{alert.status}</span>
      {alert.status === 'UNREAD' && <><button className="btn-secondary" onClick={() => handle(alert.id, false)}>확인</button><button className="btn-primary" onClick={() => handle(alert.id, true)}>조치 완료</button></>}
    </div>)}
  </div>;
}
