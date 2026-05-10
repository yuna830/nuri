import { useEffect, useRef, useState } from "react";
import { resolveUploadUrl } from "../../api/userPageApi";

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
      alert("장소나 주소를 2글자 이상 입력해주세요.");
      return;
    }

    try {
      setIsSearchingSafeZone(true);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keyword)}&limit=5&countrycodes=kr`
      );

      if (!response.ok) {
        throw new Error("장소 검색 실패");
      }

      const results = await response.json();
      setSafeZoneResults(results);
    } catch (error) {
      console.error("장소 검색 실패:", error);
      alert("장소 검색에 실패했습니다.");
    } finally {
      setIsSearchingSafeZone(false);
    }
  };

  const handleSelectSafeZone = (place) => {
    onSelectSafeZonePlace(place);
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
            <strong>
              {selectedElder.name} ({selectedElder.relation})
            </strong>
            <p className={`status-line ${!hasCurrentLocation ? "muted" : isOutsideSafeZone ? "danger" : "normal"}`}>
              <span />
              {!hasCurrentLocation ? "미수신" : isOutsideSafeZone ? "이탈" : "정상"}
            </p>
          </div>

          <p className="status-message">
            {!hasCurrentLocation
              ? "최근 위치를 아직 수신하지 못했습니다"
              : isOutsideSafeZone
                ? "안전 반경 밖에 있습니다"
                : "현재 안전 반경 안에 있습니다"}
          </p>
          <small>{hasCurrentLocation ? `${distance}m 거리` : "위치 미수신"}</small>

          <dl className="status-profile-list">
            <div>
              <dt>나이</dt>
              <dd>{selectedElder.age}</dd>
            </div>
            <div>
              <dt>성별</dt>
              <dd>{selectedElder.gender}</dd>
            </div>
            <div>
              <dt>주소</dt>
              <dd>{selectedElder.address}</dd>
            </div>
            <div className="condition-row">
              <dt>주요 질환</dt>
              <dd>
                <ul className="condition-list">
                  {selectedElder.condition.split(", ").map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
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
            <strong>{hasCurrentLocation ? formatShortAddress(location.address) : "위치 미수신"}</strong>
          </div>

          <div className="summary-row">
            <span>마지막 정상 위치</span>
            <strong>
              {selectedElder.lastNormalLocation ? formatShortAddress(lastNormalLocation.address) : "기록 없음"}
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
                  <span className="safe-zone-name">{safeZoneForm.name}</span>
                  <span className="safe-zone-edit">수정</span>
                </span>

                {safeZoneForm.address && (
                  <span className="safe-zone-address">
                    {formatShortAddress(safeZoneForm.address)}
                  </span>
                )}
              </span>
              <span className="safe-zone-radius">
                반경 {safeZoneForm.radiusMeters}m 설정
              </span>
            </button>
          </div>
        </section>

        {isSafeZoneOpen && (
          <section className="card safe-zone-card">
            <h2>안전 반경 설정</h2>

            <label>
              장소 이름
              <input name="name" value={safeZoneForm.name} onChange={onSafeZoneChange} />
            </label>

            <label>
              주소
              <input
                name="address"
                value={safeZoneForm.address || ""}
                onChange={onSafeZoneChange}
                placeholder="예: 서울특별시 서초3동 서초중앙로"
              />
            </label>

            <label>
              위치 검색
              <div className="safe-zone-search">
                <input
                  value={safeZoneKeyword}
                  onChange={(event) => setSafeZoneKeyword(event.target.value)}
                  placeholder={safeZoneForm.address || "예: 서울시 동작구, 서초중앙로"}
                  onKeyDown={(event) => event.key === "Enter" && handleSearchSafeZone()}
                />
                <button type="button" onClick={handleSearchSafeZone}>
                  {isSearchingSafeZone ? "검색 중" : "검색"}
                </button>
              </div>
            </label>

            {safeZoneResults.length > 0 && (
              <div className="safe-zone-results">
                {safeZoneResults.map((place) => (
                  <button
                    key={`${place.place_id}-${place.lat}-${place.lon}`}
                    type="button"
                    onClick={() => handleSelectSafeZone(place)}
                  >
                    {place.display_name}
                  </button>
                ))}
              </div>
            )}

            <label>
              반경
              <select name="radiusMeters" value={safeZoneForm.radiusMeters} onChange={onSafeZoneChange}>
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
            <h2>보호 대상 추가</h2>
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
            <p className="add-elder-empty">보호 대상자의 이름이나 연락처를 입력한 뒤 검색해주세요.</p>
          ) : isSearchingSenior ? (
            <p className="add-elder-empty">사용자를 검색하는 중입니다.</p>
          ) : seniorSearchResults.length === 0 ? (
            <p className="add-elder-empty">검색 결과가 없습니다. 보호 대상 등록을 눌러 새로 등록할 수 있습니다.</p>
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
            보호 대상 등록
          </button>
        </div>

        {isCreateElderOpen && (
          <div className="add-elder-create">
            <h3>신규 보호 대상 등록</h3>

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
