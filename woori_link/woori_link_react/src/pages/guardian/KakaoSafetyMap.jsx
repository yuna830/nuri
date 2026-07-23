import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { deleteSafetyZone, saveSafetyZone } from '../../api/guardianApi.js';

const KAKAO_SDK_ID = 'kakao-map-sdk';

let kakaoSdkPromise = null;

/**
 * 카카오맵 JavaScript SDK 로드
 */
function loadKakaoMapSdk(appKey) {
  if (!appKey) {
    return Promise.reject(
      new Error('카카오맵 JavaScript 키가 설정되지 않았습니다.'),
    );
  }

  /**
   * SDK와 지도 객체가 이미 완전히 로드된 상태
   */
  if (
    window.kakao?.maps?.Map
    && window.kakao?.maps?.LatLng
  ) {
    return Promise.resolve(window.kakao.maps);
  }

  /**
   * 다른 컴포넌트나 Effect에서 이미 SDK를 로딩 중인 경우
   */
  if (kakaoSdkPromise) {
    return kakaoSdkPromise;
  }

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const finishLoading = () => {
      if (!window.kakao?.maps?.load) {
        reject(
          new Error('카카오맵 SDK 객체를 찾을 수 없습니다.'),
        );
        return;
      }

      window.kakao.maps.load(() => {
        if (!window.kakao?.maps?.Map) {
          reject(
            new Error('카카오맵 지도 모듈이 초기화되지 않았습니다.'),
          );
          return;
        }

        resolve(window.kakao.maps);
      });
    };

    const handleError = () => {
      reject(
        new Error('카카오맵 SDK 파일을 불러오지 못했습니다.'),
      );
    };

    const existingScript = document.getElementById(KAKAO_SDK_ID);

    if (existingScript) {
      if (window.kakao?.maps?.load) {
        finishLoading();
        return;
      }

      existingScript.addEventListener(
        'load',
        finishLoading,
        { once: true },
      );

      existingScript.addEventListener(
        'error',
        handleError,
        { once: true },
      );

      return;
    }

    const script = document.createElement('script');

    script.id = KAKAO_SDK_ID;
    script.async = true;
    script.src = [
      'https://dapi.kakao.com/v2/maps/sdk.js',
      `?appkey=${encodeURIComponent(appKey)}`,
      '&autoload=false',
      '&libraries=services',
    ].join('');

    script.addEventListener(
      'load',
      finishLoading,
      { once: true },
    );

    script.addEventListener(
      'error',
      handleError,
      { once: true },
    );

    document.head.appendChild(script);
  }).catch((error) => {
    /**
     * 실패한 Promise를 계속 재사용하지 않도록 초기화
     */
    kakaoSdkPromise = null;
    throw error;
  });

  return kakaoSdkPromise;
}

/**
 * API 응답에서 위도·경도 추출
 */
function readCoordinates(value) {
  const latitude = Number(
    value?.latitude
    ?? value?.lat,
  );

  const longitude = Number(
    value?.longitude
    ?? value?.lng
    ?? value?.lon,
  );

  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function arrangeZones(zones) {
  const arranged = [null, null, null];
  zones.slice(0, 3).forEach((item, index) => {
    const slotIndex = Number(item?.slotNumber) - 1;
    arranged[slotIndex >= 0 && slotIndex < 3 ? slotIndex : index] = item;
  });
  return arranged;
}

function distanceMeters(first, second) {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude)
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

/**
 * 위치 수신 시간 표시
 */
function formatReceivedAt(location) {
  const value = location?.recordedAt
    ?? location?.capturedAt
    ?? location?.locatedAt
    ?? location?.createdAt
    ?? location?.updatedAt;

  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return '수신 시각 미확인';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * 화면 표시용 전체 주소
 */
function getSeniorDisplayAddress(senior) {
  return [
    senior?.address,
    senior?.detailAddress,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * 카카오 주소 검색용 주소
 *
 * 상세 주소는 주소 검색에서 제외한다.
 */
function getSeniorSearchAddress(senior) {
  const address = String(
    senior?.address ?? '',
  ).trim();

  if (!address) {
    return '';
  }

  /**
   * DB의 address 자체에 쉼표 뒤로 상세주소가 들어간 경우 제거
   */
  return address
    .split(',')[0]
    .trim();
}

/**
 * 주소를 위도·경도로 변환
 */
function searchAddress(maps, address) {
  return new Promise((resolve, reject) => {
    if (!address) {
      reject(
        new Error('검색할 등록 주소가 없습니다.'),
      );
      return;
    }

    if (!maps.services?.Geocoder) {
      reject(
        new Error(
          '카카오맵 주소 검색 서비스를 불러오지 못했습니다.',
        ),
      );
      return;
    }

    const geocoder = new maps.services.Geocoder();

    geocoder.addressSearch(
      address,
      (result, status) => {
        if (
          status === maps.services.Status.OK
          && result?.[0]
        ) {
          const latitude = Number(result[0].y);
          const longitude = Number(result[0].x);

          if (
            Number.isFinite(latitude)
            && Number.isFinite(longitude)
          ) {
            resolve({
              latitude,
              longitude,
            });
            return;
          }

          reject(
            new Error(
              `주소 검색 결과의 좌표가 잘못되었습니다: ${address}`,
            ),
          );
          return;
        }

        if (
          status === maps.services.Status.ZERO_RESULT
        ) {
          reject(
            new Error(
              `등록 주소를 지도에서 찾지 못했습니다: ${address}`,
            ),
          );
          return;
        }

        reject(
          new Error(
            `카카오 주소 검색에 실패했습니다. 상태: ${status}`,
          ),
        );
      },
    );
  });
}

function searchPlace(maps, query) {
  return new Promise((resolve, reject) => {
    if (!query?.trim() || !maps.services?.Places) {
      reject(new Error('검색어를 입력해 주세요.'));
      return;
    }
    const places = new maps.services.Places();
    places.keywordSearch(query.trim(), (result, status) => {
      if (status === maps.services.Status.OK && result?.[0]) {
        resolve(result.slice(0, 5).map((item) => ({
          id: item.id,
          latitude: Number(item.y),
          longitude: Number(item.x),
          name: item.place_name || item.address_name || query.trim(),
          address: item.road_address_name || item.address_name || '',
        })));
        return;
      }
      reject(new Error('검색 결과를 찾지 못했습니다.'));
    });
  });
}

/**
 * 오류 메시지 정리
 */
function getMapErrorMessage(error) {
  const message = error instanceof Error
    ? error.message
    : String(error);

  if (
    message.includes('등록 주소를 지도에서 찾지 못했습니다')
    || message.includes('검색할 등록 주소가 없습니다')
  ) {
    return message;
  }

  if (
    message.includes('SDK')
    || message.includes('지도 모듈')
    || message.includes('주소 검색 서비스')
  ) {
    return message;
  }

  return '지도를 불러오지 못했습니다. 브라우저 콘솔을 확인해 주세요.';
}

export default function KakaoSafetyMap({
  senior,
  location,
  zones = [],
  hasLocationRisk = false,
  loading = false,
  onRefreshLocation,
}) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const addressMarkerRef = useRef(null);
  const circleRefs = useRef([]);
  const previewCircleRef = useRef(null);
  const lastCenterRef = useRef(null);

  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [displayZones, setDisplayZones] = useState(() => arrangeZones(zones));
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(0);
  const displayZone = displayZones[selectedZoneIndex] ?? null;
  const [resolvedCenter, setResolvedCenter] = useState(null);
  const [zoneRadius, setZoneRadius] = useState(Number(displayZone?.radiusMeters ?? displayZone?.radius ?? 500));
  const [zoneName, setZoneName] = useState(displayZone?.name ?? '');
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneDeleting, setZoneDeleting] = useState(false);
  const [zoneMessage, setZoneMessage] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeResults, setPlaceResults] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [locationRefreshing, setLocationRefreshing] = useState(false);

  useEffect(() => {
    setDisplayZones(arrangeZones(zones));
    setSelectedZoneIndex(0);
  }, [zones]);

  useEffect(() => {
    setZoneRadius(Number(displayZone?.radiusMeters ?? displayZone?.radius ?? 500));
    setZoneName(displayZone?.name ?? `안전구역 ${selectedZoneIndex + 1}`);
    setSelectedCenter(null);
    setPlaceResults([]);
    setZoneMessage('');
  }, [selectedZoneIndex, displayZone?.id]);

  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;

  const locationCoordinates = useMemo(
    () => readCoordinates(location),
    [location],
  );

  const hasReceivedLocation =
    locationCoordinates !== null;

  const zoneCoordinates = useMemo(
    () => readCoordinates(displayZone),
    [displayZone],
  );

  const locationLatitude =
    locationCoordinates?.latitude ?? null;

  const locationLongitude =
    locationCoordinates?.longitude ?? null;

  const zoneLatitude =
    zoneCoordinates?.latitude ?? null;

  const zoneLongitude =
    zoneCoordinates?.longitude ?? null;

  const centerLatitude =
    locationLatitude ?? zoneLatitude;

  const centerLongitude =
    locationLongitude ?? zoneLongitude;

  const hasCenterCoordinates =
    Number.isFinite(centerLatitude)
    && Number.isFinite(centerLongitude);

  const seniorDisplayAddress = useMemo(
    () => getSeniorDisplayAddress(senior),
    [senior],
  );

  const seniorSearchAddress = useMemo(
    () => getSeniorSearchAddress(senior),
    [senior],
  );

  const radius = Number(
    displayZone?.radiusMeters
    ?? displayZone?.radius
    ?? displayZone?.distance,
  );

  const hasZone =
    displayZone?.enabled !== false
    &&
    Number.isFinite(zoneLatitude)
    && Number.isFinite(zoneLongitude)
    && Number.isFinite(radius)
    && radius > 0;

  const validZones = displayZones
    .filter(Boolean)
    .filter((zone) => zone.enabled !== false)
    .map((zone) => ({
      coordinates: readCoordinates(zone),
      radius: Number(zone.radiusMeters ?? zone.radius ?? zone.distance),
    }))
    .filter((zone) => zone.coordinates && Number.isFinite(zone.radius) && zone.radius > 0);

  const isOutside = locationCoordinates && validZones.length > 0
    ? validZones.every((zone) => (
      distanceMeters(locationCoordinates, zone.coordinates) > zone.radius
    ))
    : location?.outsideSafetyZone === true;

  const seniorName =
    senior?.name || '님';

  /**
   * 지도 생성 및 마커·안전구역 업데이트
   */
  useEffect(() => {
    /**
     * loading이 끝난 뒤 다시 실행되도록
     * 반드시 의존성 배열에 loading을 포함한다.
     */
    if (loading) {
      setMapReady(false);
      return undefined;
    }

    if (!appKey) {
      setMapReady(false);
      setMapError('');
      return undefined;
    }

    if (
      !hasCenterCoordinates
      && !seniorSearchAddress
    ) {
      setMapReady(false);
      setMapError('');
      return undefined;
    }

    if (!mapElementRef.current) {
      return undefined;
    }

    let cancelled = false;

    async function initializeMap() {
      try {
        setMapError('');
        setMapReady(false);

        const maps = await loadKakaoMapSdk(appKey);

        let resolvedCenter;

        if (locationCoordinates) {
          resolvedCenter = {
            latitude: locationCoordinates.latitude,
            longitude: locationCoordinates.longitude,
          };
        } else if (seniorSearchAddress) {
          resolvedCenter = await searchAddress(
            maps,
            seniorSearchAddress,
          );
        } else {
          resolvedCenter = {
            latitude: zoneLatitude,
            longitude: zoneLongitude,
          };
        }

        setResolvedCenter(resolvedCenter);

        if (
          cancelled
          || !mapElementRef.current
        ) {
          return;
        }

        const center = new maps.LatLng(
          resolvedCenter.latitude,
          resolvedCenter.longitude,
        );

        lastCenterRef.current = center;

        let map = mapInstanceRef.current;

        /**
         * 지도가 처음 만들어지는 경우
         */
        if (!map) {
          map = new maps.Map(
            mapElementRef.current,
            {
              center,
              level: 4,
            },
          );

          mapInstanceRef.current = map;
        } else {
          /**
           * 기존 지도가 있으면 새로 만들지 않고
           * 크기와 중심만 갱신
           */
          map.relayout();
          map.setCenter(center);
        }

        if (locationMarkerRef.current) {
          locationMarkerRef.current.setMap(null);
          locationMarkerRef.current = null;
        }

        if (addressMarkerRef.current) {
          addressMarkerRef.current.setMap(null);
          addressMarkerRef.current = null;
        }

        /**
         * 이전 안전구역 원 제거
         */
        circleRefs.current.forEach((circle) => circle.setMap(null));
        circleRefs.current = [];

        if (locationCoordinates) {
          locationMarkerRef.current =
            new maps.CustomOverlay({
              map,
              position: center,
              yAnchor: 0.5,
              xAnchor: 0.5,
              content: `
        <div
          class="guardian-kakao-marker guardian-kakao-marker--location"
          aria-label="현재 위치"
        ></div>
      `,
            });
        } else {
          addressMarkerRef.current =
            new maps.CustomOverlay({
              map,
              position: center,
              yAnchor: 0.5,
              xAnchor: 0.5,
              content: `
        <div
          class="guardian-kakao-marker guardian-kakao-marker--address"
          aria-label="등록 주소"
        ></div>
      `,
            });
        }

        /**
         * 안전구역 표시
         */
        displayZones.filter((item) => item?.enabled !== false).forEach((item, index) => {
          const coordinates = readCoordinates(item);
          const itemRadius = Number(item?.radiusMeters ?? item?.radius);
          if (!coordinates || !Number.isFinite(itemRadius)) return;
          const circle = new maps.Circle({
            map,
            center: new maps.LatLng(coordinates.latitude, coordinates.longitude),
            radius: itemRadius,
            strokeWeight: 2,
            strokeColor: index === selectedZoneIndex ? '#557a52' : '#7d9b79',
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
            fillColor: '#a9bea6',
            fillOpacity: 0.18,
          });
          circleRefs.current.push(circle);
        });

        /**
         * 레이아웃 계산이 끝난 다음 다시 relayout
         */
        window.requestAnimationFrame(() => {
          if (
            cancelled
            || !mapInstanceRef.current
          ) {
            return;
          }

          mapInstanceRef.current.relayout();
          mapInstanceRef.current.setCenter(center);
        });

        /**
         * 폰트·레이아웃·사이드바 등이 모두 반영된 후 한 번 더 실행
         */
        window.setTimeout(() => {
          if (
            cancelled
            || !mapInstanceRef.current
          ) {
            return;
          }

          mapInstanceRef.current.relayout();
          mapInstanceRef.current.setCenter(center);
        }, 150);

        setMapReady(true);
        setMapError('');
      } catch (error) {
        console.error(
          '[KakaoSafetyMap] 지도 생성 실패:',
          error,
        );

        if (!cancelled) {
          setMapReady(false);
          setMapError(
            getMapErrorMessage(error),
          );
        }
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [
    appKey,
    loading,
    hasCenterCoordinates,
    centerLatitude,
    centerLongitude,
    seniorSearchAddress,
    hasZone,
    zoneLatitude,
    zoneLongitude,
    radius,
    displayZones,
    selectedZoneIndex,
  ]);

  /**
   * 검색한 위치의 안전 반경 미리보기
   * 저장 전에는 위치 마커 대신 반경만 표시한다.
   */
  useEffect(() => {
    if (previewCircleRef.current) {
      previewCircleRef.current.setMap(null);
      previewCircleRef.current = null;
    }

    if (
      !mapReady
      || !selectedCenter
      || !mapInstanceRef.current
      || !window.kakao?.maps
    ) {
      return undefined;
    }

    previewCircleRef.current = new window.kakao.maps.Circle({
      map: mapInstanceRef.current,
      center: new window.kakao.maps.LatLng(
        selectedCenter.latitude,
        selectedCenter.longitude,
      ),
      radius: zoneRadius,
      strokeWeight: 2,
      strokeColor: '#6f916c',
      strokeOpacity: 0.95,
      strokeStyle: 'dashed',
      fillColor: '#a9bea6',
      fillOpacity: 0.2,
    });

    return () => {
      if (previewCircleRef.current) {
        previewCircleRef.current.setMap(null);
        previewCircleRef.current = null;
      }
    };
  }, [mapReady, selectedCenter, zoneRadius]);

  /**
   * 지도 영역 크기가 바뀔 때 자동으로 relayout
   */
  useEffect(() => {
    const mapElement = mapElementRef.current;

    if (
      !mapElement
      || typeof ResizeObserver === 'undefined'
    ) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      const map = mapInstanceRef.current;
      const center = lastCenterRef.current;

      if (!map) {
        return;
      }

      map.relayout();

      if (center) {
        map.setCenter(center);
      }
    });

    resizeObserver.observe(mapElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * 컴포넌트가 완전히 사라질 때 오버레이 정리
   */
  useEffect(() => (
    () => {
      if (locationMarkerRef.current) {
        locationMarkerRef.current.setMap(null);
        locationMarkerRef.current = null;
      }

      if (addressMarkerRef.current) {
        addressMarkerRef.current.setMap(null);
        addressMarkerRef.current = null;
      }

      circleRefs.current.forEach((circle) => circle.setMap(null));
      circleRefs.current = [];

      if (previewCircleRef.current) {
        previewCircleRef.current.setMap(null);
        previewCircleRef.current = null;
      }

      mapInstanceRef.current = null;
      lastCenterRef.current = null;
    }
  ), []);

  let overlayContent = null;

  if (loading) {
    overlayContent = (
      <div className="guardian-safety-map__message">
        위치 정보를 불러오는 중입니다.
      </div>
    );
  } else if (!appKey) {
    overlayContent = (
      <div className="guardian-safety-map__message">
        <strong>
          카카오맵 JavaScript 키가 없습니다.
        </strong>
        <span>
          .env.local의 VITE_KAKAO_MAP_APP_KEY를 확인해 주세요.
        </span>
      </div>
    );
  } else if (
    !hasCenterCoordinates
    && !seniorSearchAddress
  ) {
    overlayContent = (
      <div className="guardian-safety-map__message">
        <strong>
          위치 정보와 등록 주소가 없습니다.
        </strong>
        <span>
          님 기기의 위치 권한과 등록 주소를 확인해 주세요.
        </span>
      </div>
    );
  } else if (mapError) {
    overlayContent = (
      <div className="guardian-safety-map__message">
        <strong>
          지도를 표시하지 못했습니다.
        </strong>
        <span>
          {mapError}
        </span>
      </div>
    );
  } else if (!mapReady) {
    overlayContent = (
      <div className="guardian-safety-map__message">
        지도를 준비하는 중입니다.
      </div>
    );
  }

  async function handleSafetyZoneSave(event) {
    event.preventDefault();
    const center = selectedCenter ?? locationCoordinates ?? resolvedCenter ?? zoneCoordinates;
    if (!senior?.id || !center) {
      setZoneMessage('안전구역 중심 위치를 확인할 수 없습니다.');
      return;
    }
    if (!Number.isFinite(zoneRadius) || zoneRadius < 50 || zoneRadius > 5000) {
      setZoneMessage('반경은 50m부터 5,000m까지 설정할 수 있습니다.');
      return;
    }
    if (!zoneName.trim() || zoneName.trim().length > 30) {
      setZoneMessage('안전구역 이름은 1자 이상 30자 이하로 입력해 주세요.');
      return;
    }
    setZoneSaving(true);
    setZoneMessage('');
    try {
      const response = await saveSafetyZone(senior.id, {
        id: displayZone?.id ?? null,
        slotNumber: selectedZoneIndex + 1,
        name: zoneName.trim(),
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMeters: zoneRadius,
      });
      setDisplayZones((current) => {
        const next = [...current];
        next[selectedZoneIndex] = {
          ...response.data,
          name: zoneName.trim(),
        };
        return next;
      });
      setSelectedCenter(null);
      setZoneMessage('안전구역을 저장했습니다.');
    } catch (error) {
      setZoneMessage(error.response?.data?.message || '안전구역을 저장하지 못했습니다.');
    } finally {
      setZoneSaving(false);
    }
  }

  async function handleSafetyZoneDelete() {
    if (!senior?.id || !displayZone?.id || zoneDeleting) return;
    setZoneDeleting(true);
    setZoneMessage('');
    try {
      await deleteSafetyZone(senior.id, displayZone.id);
      setDisplayZones((current) => {
        const next = [...current];
        next[selectedZoneIndex] = null;
        return next;
      });
      setZoneName(`안전구역 ${selectedZoneIndex + 1}`);
      setZoneRadius(500);
      setSelectedCenter(null);
      setPlaceQuery('');
      setPlaceResults([]);
      setZoneMessage('선택한 안전구역을 초기화했습니다.');
    } catch (error) {
      setZoneMessage(error.response?.data?.message || '안전구역을 초기화하지 못했습니다.');
    } finally {
      setZoneDeleting(false);
    }
  }

  async function handlePlaceSearch(event) {
    event.preventDefault();
    if (!window.kakao?.maps) return;
    setPlaceSearching(true);
    setPlaceResults([]);
    setZoneMessage('');
    try {
      const results = await searchPlace(window.kakao.maps, placeQuery);
      setPlaceResults(results);
      setZoneMessage('');
    } catch (error) {
      setZoneMessage(error.message || '장소를 검색하지 못했습니다.');
    } finally {
      setPlaceSearching(false);
    }
  }

  function handlePlaceSelect(result) {
    setSelectedCenter(result);
    setPlaceQuery(result.name);
    setPlaceResults([]);
    const position = new window.kakao.maps.LatLng(result.latitude, result.longitude);
    mapInstanceRef.current?.setCenter(position);
  }

  async function handleCurrentLocationMove() {
    if (
      locationRefreshing
      || !window.kakao?.maps
    ) {
      return;
    }

    setLocationRefreshing(true);
    setZoneMessage('');

    try {
      /*
       * 실제 위치가 있으면 서버에서 위치를
       * 다시 조회한 뒤 현재 위치로 이동합니다.
       */
      if (locationCoordinates) {
        await onRefreshLocation?.();

        const position =
          new window.kakao.maps.LatLng(
            locationCoordinates.latitude,
            locationCoordinates.longitude,
          );

        mapInstanceRef.current?.setCenter(
          position,
        );

        lastCenterRef.current =
          position;

        return;
      }

      /*
       * 위치를 수신하지 못한 경우에는
       * 등록 주소 좌표로 이동합니다.
       */
      if (resolvedCenter) {
        const position =
          new window.kakao.maps.LatLng(
            resolvedCenter.latitude,
            resolvedCenter.longitude,
          );

        mapInstanceRef.current?.setCenter(
          position,
        );

        lastCenterRef.current =
          position;

        return;
      }

      setZoneMessage(
        seniorSearchAddress
          ? '등록 주소 위치를 불러오는 중입니다.'
          : '최근 위치와 등록 주소가 없습니다.',
      );
    } finally {
      setLocationRefreshing(false);
    }
  }

  return (
    <div className="guardian-location-layout">
      <section className={`guardian-safety-map${hasLocationRisk ? ' guardian-safety-map--danger' : ''}`}>
        <div className="guardian-safety-map__heading">
          <div>
            <div className="guardian-safety-map__title-row">
              <h3>
                현재 위치 · 안전구역
              </h3>

              {hasLocationRisk && (
                <span>
                  확인 필요
                </span>
              )}
            </div>

            <p>
              {locationCoordinates
                ? (
                  `${seniorName} 님의 최근 위치와 `
                  + '설정된 안전구역입니다.'
                )
                : seniorSearchAddress
                  ? (
                    `${seniorName} 님의 위치 정보가 `
                    + '수신되지 않았습니다. '
                    + '등록 주소를 기준으로 '
                    + '지도를 표시합니다.'
                  )
                  : (
                    `${seniorName} 님의 위치 정보와 `
                    + '등록 주소가 없습니다.'
                  )}
            </p>
          </div>

          <div className="guardian-safety-map__heading-actions">
            <button
              type="button"
              className="guardian-safety-map__refresh"
              onClick={handleCurrentLocationMove}
              disabled={
                locationRefreshing
                || (
                  !locationCoordinates
                  && !resolvedCenter
                )
              }
            >
              {locationRefreshing
                ? '위치 확인 중'
                : locationCoordinates
                  ? '현재 위치로 이동'
                  : '등록 주소 보기'}
            </button>

            <div className="guardian-safety-map__legend">
              {locationCoordinates ? (
                <span>
                  <i className="guardian-safety-map__marker-dot" />
                  현재 위치
                </span>
              ) : seniorSearchAddress ? (
                <span>
                  <i className="guardian-safety-map__address-dot" />
                  등록 주소
                </span>
              ) : null}

              {validZones.length > 0 && (
                <span>
                  <i className="guardian-safety-map__zone-dot" />
                  안전구역
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="guardian-safety-map__canvas-wrap">
          {/*
          중요:
          로딩이나 오류가 발생해도 이 div는 절대 제거하지 않는다.
        */}
          <div
            ref={mapElementRef}
            className="guardian-safety-map__canvas"
          />

          {overlayContent && (
            <div className="guardian-safety-map__overlay">
              {overlayContent}
            </div>
          )}

          {!loading
            && !mapError
            && mapReady
            && (
              <div
                className={[
                  'guardian-safety-map__status',

                  locationCoordinates
                    ? 'guardian-safety-map__status--location'
                    : 'guardian-safety-map__status--address',

                  (
                    locationCoordinates
                    && isOutside
                  )
                    ? 'is-outside'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <strong>
                  {locationCoordinates
                    ? (
                      isOutside
                        ? '안전구역 이탈'
                        : '최근 위치 수신'
                    )
                    : '등록 주소 기준'}
                </strong>

                <span>
                  {locationCoordinates
                    ? formatReceivedAt(location)
                    : (
                      seniorDisplayAddress
                      || '등록 주소 정보 없음'
                    )}
                </span>

                {!locationCoordinates && (
                  <small>
                    현재 위치가 아닌 등록 주소입니다.
                  </small>
                )}
              </div>
            )}
        </div>
      </section>
      <aside className="guardian-safety-zone-editor">
        <div className="guardian-safety-zone-editor__heading">
          <div><span className="guardian-safety-zone-editor__eyebrow"></span><h3>안전구역 설정</h3></div>
          <button type="button" onClick={handleSafetyZoneDelete} disabled={!displayZone || zoneDeleting}>{zoneDeleting ? '초기화 중' : '초기화'}</button>
        </div>
        <div className="guardian-safety-zone-editor__tabs" role="tablist" aria-label="안전구역 선택">
          {[0, 1, 2].map((index) => (
            <button key={index} type="button" className={selectedZoneIndex === index ? 'active' : ''} onClick={() => setSelectedZoneIndex(index)}>
              <span>{displayZones[index]?.name || `안전구역 ${index + 1}`}</span>
              <small>{displayZones[index] ? `${displayZones[index].radiusMeters}m` : '미설정'}</small>
            </button>
          ))}
        </div>
        <form onSubmit={handleSafetyZoneSave}>
          <label>안전구역 이름<input className="guardian-safety-zone-editor__name" type="text" maxLength="30" value={zoneName} onChange={event => setZoneName(event.target.value)} placeholder={`안전구역 ${selectedZoneIndex + 1}`} /></label>
          <label>위치 검색
            <div className="guardian-safety-zone-editor__search-wrap">
              <div className="guardian-safety-zone-editor__search"><input type="search" value={placeQuery} onChange={event => { setPlaceQuery(event.target.value); setPlaceResults([]); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); handlePlaceSearch(event); } }} placeholder="주소 또는 장소명 입력" /><button type="button" onClick={handlePlaceSearch} disabled={placeSearching}>{placeSearching ? '검색 중' : '검색'}</button></div>
              {placeResults.length > 0 && (
                <div className="guardian-safety-zone-editor__results" role="listbox">
                  {placeResults.map((result, index) => (
                    <button key={result.id || `${result.latitude}-${result.longitude}-${index}`} type="button" onClick={() => handlePlaceSelect(result)}>
                      <strong>{result.name}</strong>
                      <span>{result.address || '주소 정보 없음'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label>안전 반경<div className="guardian-safety-zone-editor__radius"><input type="number" min="50" max="5000" step="50" value={zoneRadius} onChange={event => setZoneRadius(Number(event.target.value))} /><span>m</span></div></label>
          <div className="guardian-safety-zone-editor__presets">{[100, 300, 500].map(value => <button key={value} type="button" className={zoneRadius === value ? 'active' : ''} onClick={() => setZoneRadius(value)}>{value}m</button>)}</div>
          {zoneMessage && <p className="guardian-safety-zone-editor__message">{zoneMessage}</p>}
          <button type="submit" className="guardian-safety-zone-editor__save" disabled={zoneSaving || !selectedCenter && !resolvedCenter && !locationCoordinates && !zoneCoordinates}>{zoneSaving ? '저장 중...' : displayZone ? '안전구역 수정' : '안전구역 추가'}</button>
        </form>
      </aside>
    </div>
  );
}
