import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlacesByKakao } from "../../api/kakaoLocalApi.js";
import { resolveUploadUrl } from "../../api/userPageApi";

const SAFE_ZONE_SEARCH_CACHE_KEY = "safeZoneSearchCache";
const SAFE_ZONE_SEARCH_COOLDOWN_KEY = "safeZoneSearchCooldownUntil";
const SAFE_ZONE_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const SAFE_ZONE_SEARCH_COOLDOWN_MS = 2 * 60 * 1000;

const readSearchCache = () => {
  try {
    return JSON.parse(localStorage.getItem(SAFE_ZONE_SEARCH_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};

const searchSafeZonePlaces = async (keyword) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const now = Date.now();
  const cooldownUntil = Number(localStorage.getItem(SAFE_ZONE_SEARCH_COOLDOWN_KEY) || 0);

  if (cooldownUntil > now) {
    throw new Error("SEARCH_COOLDOWN");
  }

  const cache = readSearchCache();
  const cached = cache[normalizedKeyword];

  if (cached && now - cached.savedAt < SAFE_ZONE_SEARCH_CACHE_TTL_MS) {
    return cached.results;
  }

  const results = await searchPlacesByKakao(keyword, { size: 5 }).catch(async (error) => {
    if (error.message === "KAKAO_RATE_LIMIT" || error.message === "KAKAO_COOLDOWN") {
      localStorage.setItem(SAFE_ZONE_SEARCH_COOLDOWN_KEY, String(now + SAFE_ZONE_SEARCH_COOLDOWN_MS));
      throw new Error("SEARCH_RATE_LIMIT");
    }

    const response = await fetch(
      `/nominatim/search?format=json&q=${encodeURIComponent(keyword)}&limit=5&countrycodes=kr`
    );

    if (response.status === 429) {
      localStorage.setItem(SAFE_ZONE_SEARCH_COOLDOWN_KEY, String(now + SAFE_ZONE_SEARCH_COOLDOWN_MS));
      throw new Error("SEARCH_RATE_LIMIT");
    }

    if (!response.ok) {
      throw new Error("SEARCH_FAILED");
    }

    return response.json();
  });
  localStorage.setItem(
    SAFE_ZONE_SEARCH_CACHE_KEY,
    JSON.stringify({
      ...cache,
      [normalizedKeyword]: {
        savedAt: now,
        results,
      },
    })
  );

  return results;
};

function UserPanel({
  selectedElder,
  selectedElderId,
  hasCurrentLocation,
  isOutsideSafeZone,
  distance,
  location,
  lastNormalLocation,
  safeZoneForm,
  formatShortAddress,
  formatSafeZoneAddress,
  isSafeZoneOpen,
  onToggleSafeZone,
  onSafeZoneChange,
  onSelectSafeZonePlace,
  onSaveSafeZone,
  isAddElderOpen,
  seniorSearch,
  setSeniorSearch,
  seniorSearchResults,
  isSearchingSenior,
  hasSearchedSenior,
  newSeniorForm,
  setNewSeniorForm,
  onCloseAddElder,
  onSearchSenior,
  onConnectSenior,
  onCreateAndConnectSenior,
  onDeleteElder,
  onOpenMedicineAlert,
}) {
  const [profileImages, setProfileImages] = useState(() => {
    const savedImages = localStorage.getItem("guardianProfileImages");
    return savedImages ? JSON.parse(savedImages) : {};
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [safeZoneKeyword, setSafeZoneKeyword] = useState("");
  const [safeZoneResults, setSafeZoneResults] = useState([]);
  const [isSearchingSafeZone, setIsSearchingSafeZone] = useState(false);

  const profileMenuRef = useRef(null);

  const navigate = useNavigate();

  const handleOpenUserPage = () => {
    if (!selectedElder?.id) return;

    const seniorProfile = {
      senior: {
        id: selectedElder.id,
        name: selectedElder.name,
        age: selectedElder.age,
        gender: selectedElder.gender,
        address: selectedElder.address,
        region: selectedElder.address,
        profileImageUrl: selectedElder.profileImageUrl || "",
      },
    };

    sessionStorage.setItem("currentSenior", JSON.stringify(seniorProfile));
    localStorage.setItem("current_senior_id", String(selectedElder.id));

    navigate("/user");
  };

  const guardianProfileImage = profileImages[selectedElderId] ?? null;

  const userProfileImage = selectedElder?.profileImageUrl
    ? resolveUploadUrl(selectedElder.profileImageUrl)
    : null;

  const profileImage = guardianProfileImage || userProfileImage;

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [selectedElderId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleProfileClick = () => {
    if (profileImage) {
      setIsProfileMenuOpen((prev) => !prev);
      return;
    }

    document.getElementById("profileImageInput").click();
  };

  const handleProfileImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const imageUrl = reader.result;

      setProfileImages((prev) => {
        const next = {
          ...prev,
          [selectedElderId]: imageUrl,
        };

        localStorage.setItem("guardianProfileImages", JSON.stringify(next));
        return next;
      });

      setIsProfileMenuOpen(false);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleChangeProfileImage = () => {
    document.getElementById("profileImageInput").click();
  };

  const handleDeleteProfileImage = () => {
    setProfileImages((prev) => {
      const next = { ...prev };
      delete next[selectedElderId];

      localStorage.setItem("guardianProfileImages", JSON.stringify(next));
      return next;
    });

    setIsProfileMenuOpen(false);
  };

  const handleSearchSafeZone = async () => {
    const keyword = safeZoneKeyword.trim();

    if (keyword.length < 2) {
      alert("장소나 주소를 2글자 이상 입력해 주세요.");
      return;
    }

    try {
      setIsSearchingSafeZone(true);
      const results = await searchSafeZonePlaces(keyword);
      setSafeZoneResults(results);
    } catch (error) {
      console.error("장소 검색 실패:", error);
      if (error.message === "SEARCH_RATE_LIMIT" || error.message === "SEARCH_COOLDOWN") {
        alert("장소 검색 요청이 너무 많아요. 잠시 후 다시 검색해 주세요.");
      } else {
        alert("장소 검색에 실패했습니다.");
      }
    } finally {
      setIsSearchingSafeZone(false);
    }
  };

  const handleSelectSafeZone = (place) => {
    onSelectSafeZonePlace({
      display_name:
        place.display_name ||
        place.road_address_name ||
        place.address_name ||
        place.place_name,
      lat: place.lat || place.y,
      lon: place.lon || place.x,
    });

    setSafeZoneKeyword("");
    setSafeZoneResults([]);
  };

  return (
    <>
      <aside className="left-panel">
        <section className="card status-overview profile-status-card">
          <div className="profile-image-area" ref={profileMenuRef}>
            <button
              className={`profile-image-button ${profileImage ? "has-image" : ""}`}
              type="button"
              onClick={handleProfileClick}
            >
              {profileImage ? (
                <img src={profileImage} alt={`${selectedElder.name} 프로필`} />
              ) : (
                <span>이미지</span>
              )}
            </button>

            <input
              id="profileImageInput"
              type="file"
              accept="image/*"
              onChange={handleProfileImageChange}
              hidden
            />

            {profileImage && isProfileMenuOpen && (
              <div className="profile-image-menu">
                <button type="button" onClick={handleChangeProfileImage}>
                  변경
                </button>
                <button type="button" onClick={handleDeleteProfileImage}>
                  삭제
                </button>
              </div>
            )}
          </div>

          <div className="status-profile-head">
            <button
              className="guardian-user-link"
              type="button"
              onClick={handleOpenUserPage}
            >
              {selectedElder.name} ({selectedElder.relation})
            </button>

            <p className={`status-line ${!hasCurrentLocation ? "muted" : isOutsideSafeZone ? "danger" : "normal"}`}>
              <span />
              {!hasCurrentLocation
                ? "미수신"
                : isOutsideSafeZone
                  ? `이탈 (${distance}m)`
                  : "정상"}
            </p>
          </div>

          <dl className="status-profile-list">
            <div>
              <dt>마지막 접속</dt>
              <dd>{selectedElder.lastLoginText || "기록 없음"}</dd>
            </div>
            <div>
              <dt>연락처</dt>
              <dd>{selectedElder.phone || "연락처 없음"}</dd>
            </div>
            <div>
              <dt>나이</dt>
              <dd>{selectedElder.age}</dd>
            </div>
            <div>
              <dt>담당 복지사</dt>
              <dd>
                {selectedElder.socialWorkerName || "미지정"}
                {selectedElder.socialWorkerPhone ? ` (${selectedElder.socialWorkerPhone})` : ""}
              </dd>
            </div>
            <div className="condition-row">
              <dt>주요 질환</dt>
              <dd>
                {(() => {
                  const conditions = (selectedElder.condition || "")
                    .split(", ")
                    .map((condition) => condition.split(":")[0].trim())
                    .filter(Boolean);

                  if (conditions.length === 0) {
                    return "등록 없음";
                  }

                  return (
                    <>
                      {conditions.slice(0, 2).join(" · ")}
                      {conditions.length > 2 ? ` 외 ${conditions.length - 2}` : ""}
                    </>
                  );
                })()}
              </dd>
            </div>
            <div className="condition-row">
              <dt>복약 정보</dt>
              <dd>
                <button
                  className="medicine-info-text-button"
                  type="button"
                  onClick={onOpenMedicineAlert}
                >
                  {selectedElder.medications?.length ? (
                    <ul className="condition-list">
                      {selectedElder.medications.map((medicine, index) => (
                        <li key={`${medicine.name}-${index}`}>
                          {[
                            medicine.name,
                            medicine.ongoing
                              ? `${medicine.startDate || "시작일 미입력"}부터 계속 복용`
                              : [medicine.startDate, medicine.endDate].filter(Boolean).join(" ~ "),
                            medicine.interval ? `${medicine.interval}시간마다` : "",
                            medicine.dailyCount ? `하루 ${medicine.dailyCount}회` : "",
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    selectedElder.medicineCount || "없음"
                  )}
                </button>
              </dd>
            </div>
          </dl>

          <div className="battery-box">
            <div className="battery-title-row">
              <span>GPS 배터리</span>
              <strong>{selectedElder.battery}%</strong>
            </div>
            <div className="battery-row">
              <div className="battery-bar">
                <div style={{ width: `${selectedElder.battery}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="card location-summary">
          <div className="summary-row">
            <span>현재 위치</span>
            <strong>
              {hasCurrentLocation ? formatShortAddress(location.address) : "위치 미수신"}
            </strong>
          </div>

          <div className="summary-row">
            <span>마지막 정상 위치</span>
            <strong>
              {selectedElder.lastNormalLocation
                ? formatShortAddress(lastNormalLocation.address)
                : "기록 없음"}
            </strong>
          </div>

          <div className="summary-row safe-zone-summary">
            <span>안전 반경 중심</span>

            <button
              className={`safe-zone-trigger ${isSafeZoneOpen ? "active" : ""}`}
              type="button"
              onClick={onToggleSafeZone}
            >
              <span className="safe-zone-top">
                <span className="safe-zone-name-row">
                  <span className="safe-zone-name">{safeZoneForm?.name || "기본구역"}</span>
                  <span className="safe-zone-edit">수정</span>
                </span>

                {safeZoneForm?.address && (
                  <span className="safe-zone-address">
                    {formatSafeZoneAddress(safeZoneForm.address)}
                  </span>
                )}
              </span>

              <span className="safe-zone-radius">
                반경 {safeZoneForm?.radiusMeters ?? 500}m 설정
              </span>
            </button>
          </div>
        </section>

        {isSafeZoneOpen && (
          <section className="card safe-zone-card">
            <h2>안전 반경 설정</h2>

            <label>
              장소 이름
              <input
                name="name"
                value={safeZoneForm.name}
                onChange={onSafeZoneChange}
              />
            </label>

            <label>
              주소
              <input
                name="address"
                value={safeZoneForm.address || ""}
                onChange={onSafeZoneChange}
                placeholder="예: 서울특별시 광진구 자양동"
              />
            </label>

            <label>
              위치 검색
              <div className="safe-zone-search">
                <input
                  value={safeZoneKeyword}
                  onChange={(event) => setSafeZoneKeyword(event.target.value)}
                  placeholder={safeZoneForm.address || "예: 자양고등학교"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearchSafeZone();
                    }
                  }}
                />

                <button type="button" onClick={handleSearchSafeZone}>
                  {isSearchingSafeZone ? "검색 중" : "검색"}
                </button>
              </div>
            </label>

            {safeZoneResults.length > 0 && (
              <div className="safe-zone-results">
                {safeZoneResults.map((place, index) => (
                  <button
                    key={`${place.place_id || place.id || index}-${place.lat || place.y}-${place.lon || place.x}`}
                    type="button"
                    onClick={() => handleSelectSafeZone(place)}
                  >
                    {place.display_name ||
                      place.place_name ||
                      place.road_address_name ||
                      place.address_name}
                  </button>
                ))}
              </div>
            )}

            <label>
              반경
              <select
                name="radiusMeters"
                value={safeZoneForm.radiusMeters}
                onChange={onSafeZoneChange}
              >
                <option value={300}>300m</option>
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
                <option value={1500}>1.5km</option>
              </select>
            </label>

            <button className="primary-button" type="button" onClick={onSaveSafeZone}>
              저장
            </button>
          </section>
        )}
      </aside>

      {isAddElderOpen && (
        <AddElderModal
          seniorSearch={seniorSearch}
          setSeniorSearch={setSeniorSearch}
          seniorSearchResults={seniorSearchResults}
          isSearchingSenior={isSearchingSenior}
          hasSearchedSenior={hasSearchedSenior}
          newSeniorForm={newSeniorForm}
          setNewSeniorForm={setNewSeniorForm}
          onClose={onCloseAddElder}
          onSearchSenior={onSearchSenior}
          onConnectSenior={onConnectSenior}
          onCreateAndConnectSenior={onCreateAndConnectSenior}
        />
      )}
    </>
  );
}

function AddElderModal({
  seniorSearch,
  setSeniorSearch,
  seniorSearchResults,
  isSearchingSenior,
  hasSearchedSenior,
  newSeniorForm,
  setNewSeniorForm,
  onClose,
  onSearchSenior,
  onConnectSenior,
  onCreateAndConnectSenior,
}) {
  const [isCreateElderOpen, setIsCreateElderOpen] = useState(false);
  const [connectRelation, setConnectRelation] = useState("보호 대상자");

  const handleClose = () => {
    setIsCreateElderOpen(false);
    onClose();
  };

  return (
    <div className="add-elder-backdrop" onClick={handleClose}>
      <section className="add-elder-modal" onClick={(event) => event.stopPropagation()}>
        <div className="add-elder-header">
          <div>
            <h2>보호 대상자 추가</h2>
            <p>기존 사용자를 검색해서 연결하거나 새로 등록합니다.</p>
          </div>

          <button className="add-elder-close" type="button" onClick={handleClose}>
            닫기
          </button>
        </div>

        <div className="add-elder-connect-fields">
          <div className="add-elder-search">
            <input
              value={seniorSearch}
              onChange={(event) => setSeniorSearch(event.target.value)}
              placeholder="이름 또는 연락처로 검색"
              onKeyDown={(event) => event.key === "Enter" && onSearchSenior()}
            />

            <button type="button" onClick={onSearchSenior}>
              검색
            </button>
          </div>

          <label className="add-elder-relation-field">
            관계
            <input
              value={connectRelation}
              onChange={(event) => setConnectRelation(event.target.value)}
              placeholder="어머니, 아버지, 배우자"
            />
          </label>
        </div>

        <div className="add-elder-list">
          {!hasSearchedSenior ? (
            <p className="add-elder-empty">보호 대상자의 이름이나 연락처를 입력해 검색해주세요.</p>
          ) : isSearchingSenior ? (
            <p className="add-elder-empty">사용자를 검색하는 중입니다.</p>
          ) : seniorSearchResults.length === 0 ? (
            <p className="add-elder-empty">검색 결과가 없습니다. 보호 대상자 등록을 눌러 새로 등록할 수 있습니다..</p>
          ) : (
            seniorSearchResults.map((profile) => {
              const senior = profile.senior;

              return (
                <article key={senior.id} className="add-elder-item">
                  <div>
                    <strong>{senior.name}</strong>
                    <span>{senior.phone || "연락처 없음"}</span>
                    <em>{senior.region || senior.address || "주소 없음"}</em>
                  </div>

                  <button type="button" onClick={() => onConnectSenior(senior.id, connectRelation)}>
                    선택
                  </button>
                </article>
              );
            })
          )}
        </div>

        <div className="add-elder-create-toggle">
          <button
            className="add-elder-create-button"
            type="button"
            onClick={() => setIsCreateElderOpen((prev) => !prev)}
          >
            보호 대상자 등록
          </button>
        </div>

        {isCreateElderOpen && (
          <div className="add-elder-create">
            <h3>신규 보호 대상자 등록</h3>

            <label>
              이름
              <input
                value={newSeniorForm.name}
                onChange={(event) =>
                  setNewSeniorForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="예: 김영희"
              />
            </label>

            <label>
              연락처
              <input
                value={newSeniorForm.phone}
                onChange={(event) =>
                  setNewSeniorForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="010-0000-0000"
              />
            </label>

            <label>
              주소
              <input
                value={newSeniorForm.region}
                onChange={(event) =>
                  setNewSeniorForm((prev) => ({ ...prev, region: event.target.value }))
                }
                placeholder="서울시 광진구"
              />
            </label>

            <label>
              관계
              <input
                value={newSeniorForm.relation}
                onChange={(event) =>
                  setNewSeniorForm((prev) => ({ ...prev, relation: event.target.value }))
                }
                placeholder="어머니, 아버지, 보호 대상자"
              />
            </label>

            <button className="add-elder-create-button" type="button" onClick={onCreateAndConnectSenior}>
              등록하고 연결
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default UserPanel;
