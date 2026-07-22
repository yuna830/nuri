import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getCheckInSchedule,
  saveCheckInSchedule,
} from '../../api/guardianApi.js';


const DEFAULT_FORM = {
  enabled: true,
  scheduleMode: 'DIRECT',
  requestTimes: [
    '09:00',
  ],
  intervalHours: '6',
  timeoutMinutes: '30',
  timezone: 'Asia/Seoul',
};


const MAX_REQUEST_TIME_COUNT = 8;


function getErrorMessage(
  error,
  fallbackMessage,
) {
  return (
    error
      ?.response
      ?.data
      ?.message
    || error?.message
    || fallbackMessage
  );
}


function normalizeRequestTime(
  value,
) {
  const normalizedValue = String(
    value ?? '',
  ).trim();

  if (!normalizedValue) {
    return '';
  }

  const slicedValue =
    normalizedValue.slice(
      0,
      5,
    );

  if (
    /^\d{2}:\d{2}$/.test(
      slicedValue,
    )
  ) {
    return slicedValue;
  }

  return '';
}


function normalizeRequestTimes(
  requestTimes,
  legacyRequestTime,
) {
  const sourceTimes = Array.isArray(
    requestTimes,
  )
    ? requestTimes
    : [];

  const normalizedTimes = sourceTimes
    .map(
      normalizeRequestTime,
    )
    .filter(Boolean);

  if (
    normalizedTimes.length === 0
    && legacyRequestTime
  ) {
    const normalizedLegacyTime =
      normalizeRequestTime(
        legacyRequestTime,
      );

    if (normalizedLegacyTime) {
      normalizedTimes.push(
        normalizedLegacyTime,
      );
    }
  }

  if (normalizedTimes.length === 0) {
    normalizedTimes.push(
      '09:00',
    );
  }

  return [
    ...new Set(
      normalizedTimes,
    ),
  ].sort();
}


function buildIntervalTimes(
  intervalHours,
) {
  const interval =
    Number(
      intervalHours,
    );

  if (
    !Number.isInteger(
      interval,
    )
    || interval <= 0
    || interval > 24
  ) {
    return [];
  }

  const times = [];

  for (
    let hour = 0;
    hour < 24;
    hour += interval
  ) {
    times.push(
      `${String(hour).padStart(
        2,
        '0',
      )}:00`,
    );
  }

  return times;
}


export default function CheckInScheduleModal({
  open,
  seniorId,
  seniorName,
  onClose,
}) {
  const [
    form,
    setForm,
  ] = useState({
    ...DEFAULT_FORM,
  });

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');


  const intervalPreviewTimes =
    useMemo(
      () => buildIntervalTimes(
        form.intervalHours,
      ),
      [
        form.intervalHours,
      ],
    );


  useEffect(() => {
    if (
      !open
      || !seniorId
    ) {
      return undefined;
    }

    let cancelled = false;

    async function loadSchedule() {
      setLoading(true);
      setError('');

      try {
        const response =
          await getCheckInSchedule(
            seniorId,
          );

        if (cancelled) {
          return;
        }

        const schedule =
          response?.data ?? {};

        const scheduleMode =
          String(
            schedule.scheduleMode
            ?? 'DIRECT',
          ).toUpperCase();

        setForm({
          enabled:
            schedule.enabled !== false,

          scheduleMode:
            scheduleMode === 'INTERVAL'
              ? 'INTERVAL'
              : 'DIRECT',

          requestTimes:
            normalizeRequestTimes(
              schedule.requestTimes,
              schedule.requestTime,
            ),

          intervalHours:
            String(
              schedule.intervalHours
              ?? 6,
            ),

          timeoutMinutes:
            String(
              schedule.timeoutMinutes
              ?? 30,
            ),

          timezone:
            schedule.timezone
            ?? 'Asia/Seoul',
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          getErrorMessage(
            loadError,
            '자동 안부 설정을 불러오지 못했습니다.',
          ),
        );

        setForm({
          ...DEFAULT_FORM,
          requestTimes: [
            ...DEFAULT_FORM
              .requestTimes,
          ],
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    seniorId,
  ]);


  const handleClose = () => {
    if (saving) {
      return;
    }

    setError('');

    onClose();
  };


  const handleScheduleModeChange = (
    scheduleMode,
  ) => {
    setError('');

    setForm(
      (current) => ({
        ...current,
        scheduleMode,
      }),
    );
  };


  const handleRequestTimeChange = (
    index,
    value,
  ) => {
    setError('');

    setForm(
      (current) => ({
        ...current,

        requestTimes:
          current.requestTimes.map(
            (
              requestTime,
              requestTimeIndex,
            ) => (
              requestTimeIndex === index
                ? value
                : requestTime
            ),
          ),
      }),
    );
  };


  const handleAddRequestTime = () => {
    if (
      form.requestTimes.length
      >= MAX_REQUEST_TIME_COUNT
    ) {
      setError(
        `자동 요청 시간은 최대 ${MAX_REQUEST_TIME_COUNT}개까지 설정할 수 있습니다.`,
      );

      return;
    }

    const lastTime =
      form.requestTimes[
        form.requestTimes.length - 1
      ] ?? '09:00';

    const [
      hourText,
      minuteText,
    ] = lastTime.split(':');

    const nextHour =
      (
        Number(hourText) + 1
      ) % 24;

    const nextTime =
      `${String(nextHour).padStart(
        2,
        '0',
      )}:${minuteText ?? '00'}`;

    setError('');

    setForm(
      (current) => ({
        ...current,

        requestTimes: [
          ...current.requestTimes,
          nextTime,
        ],
      }),
    );
  };


  const handleDeleteRequestTime = (
    index,
  ) => {
    if (
      form.requestTimes.length <= 1
    ) {
      setError(
        '자동 요청 시간은 최소 1개 이상 필요합니다.',
      );

      return;
    }

    setError('');

    setForm(
      (current) => ({
        ...current,

        requestTimes:
          current.requestTimes.filter(
            (
              _,
              requestTimeIndex,
            ) => (
              requestTimeIndex
              !== index
            ),
          ),
      }),
    );
  };


  const validateDirectRequestTimes = () => {
    const normalizedTimes =
      form.requestTimes
        .map(
          normalizeRequestTime,
        )
        .filter(Boolean);

    if (
      normalizedTimes.length
      !== form.requestTimes.length
    ) {
      setError(
        '자동 요청 시간을 모두 확인해 주세요.',
      );

      return null;
    }

    const uniqueTimes = [
      ...new Set(
        normalizedTimes,
      ),
    ];

    if (
      uniqueTimes.length
      !== normalizedTimes.length
    ) {
      setError(
        '같은 시간을 중복해서 설정할 수 없습니다.',
      );

      return null;
    }

    if (
      uniqueTimes.length === 0
    ) {
      setError(
        '자동 요청 시간은 최소 1개 이상 필요합니다.',
      );

      return null;
    }

    return uniqueTimes.sort();
  };


  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !seniorId
      || loading
      || saving
    ) {
      return;
    }

    const timeoutMinutes =
      Number(
        form.timeoutMinutes,
      );

    if (
      !Number.isInteger(
        timeoutMinutes,
      )
      || timeoutMinutes < 5
      || timeoutMinutes > 180
    ) {
      setError(
        '응답 대기 시간은 5분 이상 180분 이하로 설정해 주세요.',
      );

      return;
    }

    let requestTimes = [];

    if (
      form.scheduleMode
      === 'DIRECT'
    ) {
      const validatedTimes =
        validateDirectRequestTimes();

      if (!validatedTimes) {
        return;
      }

      requestTimes =
        validatedTimes;
    }

    const intervalHours =
      form.scheduleMode
      === 'INTERVAL'
        ? Number(
          form.intervalHours,
        )
        : null;

    if (
      form.scheduleMode
      === 'INTERVAL'
      && (
        !Number.isInteger(
          intervalHours,
        )
        || intervalHours <= 0
        || intervalHours > 24
      )
    ) {
      setError(
        '발송 간격을 확인해 주세요.',
      );

      return;
    }

    setSaving(true);
    setError('');

    try {
      await saveCheckInSchedule(
        seniorId,
        {
          enabled:
            Boolean(
              form.enabled,
            ),

          scheduleMode:
            form.scheduleMode,

          requestTimes,

          requestTime:
            requestTimes[0]
            ?? null,

          intervalHours,

          timeoutMinutes,

          timezone:
            form.timezone
            || 'Asia/Seoul',
        },
      );

      onClose();
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          '자동 안부 설정을 저장하지 못했습니다.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };


  if (!open) {
    return null;
  }


  return (
    <div
      className="guardian-connect-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target
          === event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <form
        className={[
          'guardian-connect-modal',
          'guardian-checkin-schedule-modal',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guardian-checkin-schedule-title"
        onSubmit={handleSubmit}
      >
        <header>
          <div>
            <h2
              id="guardian-checkin-schedule-title"
            >
              자동 안부 설정
            </h2>
          </div>

          <button
            type="button"
            aria-label="닫기"
            disabled={saving}
            onClick={handleClose}
          >
            ×
          </button>
        </header>

        <p>
          {seniorName
            ? `${seniorName} 님에게 정해진 시간마다 안부 확인을 요청합니다.`
            : '정해진 시간마다 안부 확인을 요청합니다.'}
        </p>

        {loading ? (
          <div
            className="guardian-checkin-schedule-modal__state"
          >
            자동 안부 설정을 불러오는 중입니다.
          </div>
        ) : (
          <>
            <label>
              자동 안부 확인

              <select
                value={
                  form.enabled
                    ? 'true'
                    : 'false'
                }
                disabled={saving}
                onChange={(event) => {
                  setForm(
                    (current) => ({
                      ...current,

                      enabled:
                        event.target.value
                        === 'true',
                    }),
                  );
                }}
              >
                <option value="true">
                  사용
                </option>

                <option value="false">
                  사용 안 함
                </option>
              </select>
            </label>

            <fieldset
              className="guardian-checkin-schedule-modal__mode"
              disabled={
                saving
                || !form.enabled
              }
            >
              <legend>
                발송 방식
              </legend>

              <div
                className="guardian-checkin-schedule-modal__mode-options"
              >
                <label
                  className={[
                    'guardian-checkin-schedule-modal__mode-option',
                    form.scheduleMode
                      === 'DIRECT'
                      ? 'active'
                      : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="scheduleMode"
                    value="DIRECT"
                    checked={
                      form.scheduleMode
                      === 'DIRECT'
                    }
                    onChange={() => {
                      handleScheduleModeChange(
                        'DIRECT',
                      );
                    }}
                  />

                  <span>
                    <strong>
                      시간 직접 설정
                    </strong>

                    <small>
                      원하는 시간을 여러 개 등록합니다.
                    </small>
                  </span>
                </label>

                <label
                  className={[
                    'guardian-checkin-schedule-modal__mode-option',
                    form.scheduleMode
                      === 'INTERVAL'
                      ? 'active'
                      : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="scheduleMode"
                    value="INTERVAL"
                    checked={
                      form.scheduleMode
                      === 'INTERVAL'
                    }
                    onChange={() => {
                      handleScheduleModeChange(
                        'INTERVAL',
                      );
                    }}
                  />

                  <span>
                    <strong>
                      일정 간격 설정
                    </strong>

                    <small>
                      정해진 시간 간격으로 반복합니다.
                    </small>
                  </span>
                </label>
              </div>
            </fieldset>

            {form.scheduleMode
              === 'DIRECT'
              ? (
                <section
                  className="guardian-checkin-schedule-modal__times"
                >
                  <div
                    className="guardian-checkin-schedule-modal__section-heading"
                  >
                    <strong>
                      안부 요청 시간
                    </strong>

                    <small>
                      최대
                      {' '}
                      {MAX_REQUEST_TIME_COUNT}
                      개
                    </small>
                  </div>

                  <div
                    className="guardian-checkin-schedule-modal__time-list"
                  >
                    {form.requestTimes.map(
                      (
                        requestTime,
                        index,
                      ) => (
                        <div
                          key={`${index}-${requestTime}`}
                          className="guardian-checkin-schedule-modal__time-row"
                        >
                          <input
                            type="time"
                            value={
                              requestTime
                            }
                            disabled={
                              saving
                              || !form.enabled
                            }
                            aria-label={`자동 요청 시간 ${index + 1}`}
                            onChange={(event) => {
                              handleRequestTimeChange(
                                index,
                                event.target.value,
                              );
                            }}
                          />

                          <button
                            type="button"
                            className="guardian-checkin-schedule-modal__delete-time"
                            disabled={
                              saving
                              || !form.enabled
                              || form.requestTimes
                                .length <= 1
                            }
                            onClick={() => {
                              handleDeleteRequestTime(
                                index,
                              );
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    className="guardian-checkin-schedule-modal__add-time"
                    disabled={
                      saving
                      || !form.enabled
                      || form.requestTimes.length
                      >= MAX_REQUEST_TIME_COUNT
                    }
                    onClick={
                      handleAddRequestTime
                    }
                  >
                    <span aria-hidden="true">
                      +
                    </span>

                    시간 추가
                  </button>
                </section>
              )
              : (
                <section
                  className="guardian-checkin-schedule-modal__interval"
                >
                  <label>
                    발송 간격

                    <select
                      value={
                        form.intervalHours
                      }
                      disabled={
                        saving
                        || !form.enabled
                      }
                      onChange={(event) => {
                        setForm(
                          (current) => ({
                            ...current,

                            intervalHours:
                              event.target.value,
                          }),
                        );
                      }}
                    >
                      <option value="3">
                        3시간마다
                      </option>

                      <option value="4">
                        4시간마다
                      </option>

                      <option value="6">
                        6시간마다
                      </option>

                      <option value="8">
                        8시간마다
                      </option>

                      <option value="12">
                        12시간마다
                      </option>

                      <option value="24">
                        24시간마다
                      </option>
                    </select>
                  </label>

                  <div
                    className="guardian-checkin-schedule-modal__interval-preview"
                  >
                    <strong>
                      예상 발송 시간
                    </strong>

                    <div>
                      {intervalPreviewTimes.map(
                        (requestTime) => (
                          <span
                            key={requestTime}
                          >
                            {requestTime}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                </section>
              )}

            <label>
              응답 대기 시간

              <select
                value={
                  form.timeoutMinutes
                }
                disabled={
                  saving
                  || !form.enabled
                }
                onChange={(event) => {
                  setForm(
                    (current) => ({
                      ...current,

                      timeoutMinutes:
                        event.target.value,
                    }),
                  );
                }}
              >
                <option value="5">
                  5분
                </option>

                <option value="10">
                  10분
                </option>

                <option value="20">
                  20분
                </option>

                <option value="30">
                  30분
                </option>

                <option value="60">
                  1시간
                </option>

                <option value="120">
                  2시간
                </option>

                <option value="180">
                  3시간
                </option>
              </select>
            </label>

            <div
              className="guardian-checkin-schedule-modal__notice"
            >
              {form.scheduleMode
                === 'DIRECT'
                ? (
                  <>
                    등록한 시간마다 안부 확인을 요청하며,
                    응답 대기 시간이 지나면 미응답으로 처리됩니다.
                  </>
                )
                : (
                  <>
                    자정부터 선택한 간격으로 안부 확인을 요청하며,
                    응답 대기 시간이 지나면 미응답으로 처리됩니다.
                  </>
                )}
            </div>
          </>
        )}

        {error && (
          <div
            className="guardian-connect-modal__error"
          >
            {error}
          </div>
        )}

        <footer>
          <button
            type="button"
            disabled={saving}
            onClick={handleClose}
          >
            취소
          </button>

          <button
            type="submit"
            className="primary"
            disabled={
              loading
              || saving
              || !seniorId
            }
          >
            {saving
              ? '저장 중...'
              : '설정 저장'}
          </button>
        </footer>
      </form>
    </div>
  );
}