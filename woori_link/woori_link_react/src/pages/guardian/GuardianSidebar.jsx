function getAlertAction(alert) {
  const type = getAlertType(alert);
  const seniorId = getAlertSeniorId(alert);

  /*
   * 단순 복지 공지 알림은 별도의 화면 이동 버튼을
   * 표시하지 않고 알림 내용만 확인하도록 한다.
   */
  if (type === 'WELFARE_NOTICE') {
    return null;
  }

  /*
   * SAFETY_ZONE_EXIT에는 SAFETY라는 문자열도 포함된다.
   *
   * 따라서 위치·안전구역 알림을 제품·생활안전 알림보다
   * 먼저 판별해야 안전구역 이탈 알림이 제품 화면으로
   * 잘못 이동하지 않는다.
   */
  if (
    type.includes('LOCATION')
    || type.includes('GEOFENCE')
    || type.includes('SAFETY_ZONE')
  ) {
    return {
      label: '위치 확인',

      path: seniorId
        ? `/guardian/seniors?seniorId=${seniorId}#location-map`
        : '/guardian/seniors#location-map',
    };
  }

  /*
   * 제품 리콜과 전기·가스 등 생활안전 알림.
   */
  if (
    type.includes('RECALL')
    || type.includes('PRODUCT')
    || type.includes('ELECTRIC')
    || type.includes('GAS')
    || type.includes('SAFETY')
  ) {
    return {
      label: '제품 확인',

      path: seniorId
        ? `/guardian/safety?seniorId=${seniorId}`
        : '/guardian/safety',
    };
  }

  /*
   * 복지 및 바우처 관련 알림.
   */
  if (
    type.includes('WELFARE')
    || type.includes('VOUCHER')
  ) {
    return {
      label: '지원 내용 보기',

      path: seniorId
        ? `/guardian/welfare?seniorId=${seniorId}`
        : '/guardian/welfare',
    };
  }

  /*
   * 낙상, 안부 확인 등 별도 분류가 없는 알림은
   * 해당 어르신의 현황 화면으로 이동한다.
   */
  return {
    label: '현황 확인',

    path: seniorId
      ? `/guardian/seniors?seniorId=${seniorId}`
      : '/guardian/seniors',
  };
}