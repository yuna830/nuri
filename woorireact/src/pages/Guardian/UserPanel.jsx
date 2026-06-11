import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatPhoneNumber } from "../../utils/common/phone.js";
import { resolveUploadUrl, uploadProfileImage } from "../../api/userPageApi";
import { updateGuardianSeniorRelation, updateSeniorRequestedInfo } from "../../api/guardianApi";
import { getCurrentGuardianId } from "../../utils/guardian/guardianSession.js";

import { gToast } from "../../utils/guardian/guardianToast.js";
import { saveCurrentSenior } from "../../utils/common/session.js";

const ACTIVITY_LABELS = {
  activity: "활동성",
  stability: "안정성",
  rest_balance: "휴식 균형",
  posture_quality: "자세 상태",
  safety: "안전도",
};

const formatActivityScore = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "-";
};

const getActivityReportSummary = (activityReport) => {
  if (activityReport?.isLoading) {
    return { tone: "normal", title: "활동 리포트 확인 중", message: "오늘 컨디션을 어제 기록과 비교하고 있습니다." };
  }

  if (activityReport?.error) {
    return { tone: "warning", title: "리포트 확인 필요", message: activityReport.error };
  }

  const fallWarnings = activityReport?.fallPattern?.status === "ok"
    ? activityReport.fallPattern.warning_signs || []
    : [];

  if (fallWarnings.length > 0) {
    return { tone: "danger", title: "낙상 전후 변화 확인", message: fallWarnings[0] };
  }

  const trend = activityReport?.trend;

  if (trend?.status !== "ok") {
    return {
      tone: "normal",
      title: "기록 수집 중",
      message: trend?.message || "어제와 비교하려면 오늘과 어제의 활동 기록이 더 필요합니다.",
    };
  }

  const strongestChange = Object.entries(trend.changes || {})
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => Math.abs(b.pct_change || 0) - Math.abs(a.pct_change || 0))[0];

  if (!strongestChange || Math.abs(strongestChange.pct_change || 0) < 10) {
    return { tone: "normal", title: "어제와 비슷함", message: "오늘 활동 컨디션은 어제와 큰 차이가 없습니다." };
  }

  const label = ACTIVITY_LABELS[strongestChange.key] || strongestChange.key;
  const direction = strongestChange.pct_change > 0 ? "높아졌습니다" : "낮아졌습니다";
  const tone = strongestChange.pct_change < -15 ? "warning" : "normal";

  return {
    tone,
    title: `어제보다 ${label} 변화`,
    message: `${label} 점수가 어제보다 ${Math.abs(strongestChange.pct_change).toFixed(0)}% ${direction}.`,
  };
};

function UserPanel({
  selectedElder,
  selectedElderId,
  hasCurrentLocation,
  isOutsideSafeZone,
  distance,
  safeZones,
  safeZoneForm,
  isSafeZoneOpen,
  onToggleSafeZone,
  onSelectSafeZoneForm,
  onDeleteSafeZone,
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
  onProfileUpdated,

  activityReport,
}) {
  const [deviceBattery, setDeviceBattery] = useState(null);
  const [profileImages, setProfileImages] = useState(() => {
    const savedImages = localStorage.getItem("guardianProfileImages");
    return savedImages ? JSON.parse(savedImages) : {};
  });

  useEffect(() => {
    if (!navigator.getBattery) return undefined;

    let batteryRef = null;
    const update = () => {
      if (!batteryRef) return;
      setDeviceBattery(Math.round(batteryRef.level * 100));
    };

    navigator.getBattery().then((bat) => {
      batteryRef = bat;
      update();
      bat.addEventListener("levelchange", update);
    }).catch(() => {});

    return () => {
      batteryRef?.removeEventListener?.("levelchange", update);
    };
  }, []);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({
    relation: "",
    phone: "",
    condition: "",
    medications: "",
  });
  const [isSavingProfileEdit, setIsSavingProfileEdit] = useState(false);

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

    saveCurrentSenior(seniorProfile);
    localStorage.setItem("current_senior_id", String(selectedElder.id));

    navigate("/user");
  };

  const openProfileEdit = () => {
    setProfileEditForm({
      relation: selectedElder.relation || "",
      phone: selectedElder.phone || "",
      condition: selectedElder.healthInfo?.otherDisease || "",
      medications: selectedElder.medications?.map((item) => item.name).join(", ") || "",
    });

    setIsProfileEditOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handleProfileEditChange = (key, value) => {
    setProfileEditForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const buildMedicationPayload = (value) => {
    const names = String(value || "")
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return JSON.stringify(names.map((name) => ({ name })));
  };

  const handleSaveProfileEdit = async () => {
    if (!selectedElder?.id) return;

    const guardianId = getCurrentGuardianId();
    const relation = profileEditForm.relation.trim() || "보호 대상자";

    try {
      setIsSavingProfileEdit(true);

      await updateSeniorRequestedInfo(selectedElder.id, {
        phone: profileEditForm.phone.trim(),
        otherDisease: profileEditForm.condition.trim(),
        medicationsJson: buildMedicationPayload(profileEditForm.medications),
      });

      if (guardianId) {
        await updateGuardianSeniorRelation(guardianId, selectedElder.id, relation);
      }

      selectedElder.relation = relation;
      selectedElder.phone = profileEditForm.phone.trim();
      selectedElder.condition = profileEditForm.condition.trim();
      selectedElder.medications = JSON.parse(buildMedicationPayload(profileEditForm.medications));

      await onProfileUpdated?.();
      setIsProfileEditOpen(false);
    } catch (error) {
      console.error("보호 대상자 정보 수정 실패:", error);
      gToast.error("보호 대상자 정보 수정에 실패했습니다.");
    } finally {
      setIsSavingProfileEdit(false);
    }
  };

  const savedGuardianProfileImage = profileImages[selectedElderId] ?? null;

  const guardianProfileImage = savedGuardianProfileImage
    ? resolveUploadUrl(savedGuardianProfileImage)
    : null;

  const userProfileImage = selectedElder?.profileImageUrl
    ? resolveUploadUrl(selectedElder.profileImageUrl)
    : null;

  const profileImage = guardianProfileImage || userProfileImage;
  const activitySummary = getActivityReportSummary(activityReport);
  const activityChanges = activityReport?.trend?.status === "ok"
    ? Object.entries(activityReport.trend.changes || {}).slice(0, 3)
    : [];

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

  const handleProfileImageChange = async (event) => {
    const file = event.target.files[0];

    if (!file || !selectedElder?.id) return;

    try {
      const { imageUrl } = await uploadProfileImage(file);
      const nextImageUrl = resolveUploadUrl(imageUrl);

      await updateSeniorRequestedInfo(selectedElder.id, {
        profileImageUrl: nextImageUrl,
      });

      setProfileImages((prev) => {
        const next = {
          ...prev,
          [selectedElderId]: nextImageUrl,
        };

        localStorage.setItem("guardianProfileImages", JSON.stringify(next));
        return next;
      });

      // eslint-disable-next-line react-hooks/immutability
      selectedElder.profileImageUrl = nextImageUrl;
      setIsProfileMenuOpen(false);
    } catch {
      console.error("프로필 사진 저장 실패");
      gToast.error("프로필 사진 저장에 실패했습니다.");
    } finally {
      event.target.value = "";
    }
  };

  const handleChangeProfileImage = () => {
    document.getElementById("profileImageInput").click();
  };

  const handleDeleteProfileImage = async () => {
    if (!selectedElder?.id) return;

    try {
      await updateSeniorRequestedInfo(selectedElder.id, {
        profileImageUrl: "",
      });

      setProfileImages((prev) => {
        const next = { ...prev };
        delete next[selectedElderId];

        localStorage.setItem("guardianProfileImages", JSON.stringify(next));
        return next;
      });

      // eslint-disable-next-line react-hooks/immutability
      selectedElder.profileImageUrl = "";
      setIsProfileMenuOpen(false);
    } catch {
      console.error("프로필 사진 삭제 실패");
      gToast.error("프로필 사진 삭제에 실패했습니다.");
    }
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
                <button type="button" onClick={openProfileEdit}>
                  정보 수정
                </button>
                <button type="button" onClick={handleChangeProfileImage}>
                  사진 변경
                </button>
                <button type="button" onClick={handleDeleteProfileImage}>
                  사진 삭제
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
                {selectedElder.medications?.length ? (
                  <ul className="profile-medicine-list">
                    {selectedElder.medications.map((medicine, index) => (
                      <li key={`${medicine.name}-${index}`}>
                        {[medicine.name, medicine.startDate ? `${medicine.startDate}부터` : ""]
                          .filter(Boolean)
                          .join(" / ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  selectedElder.medicineCount || "없음"
                )}
              </dd>
            </div>
            <div>
              <dt>안전 반경</dt>
              <dd>
                <button
                  className="medicine-info-text-button"
                  type="button"
                  onClick={onToggleSafeZone}
                >
                  {safeZoneForm?.name || "기본구역"} · {safeZoneForm?.radiusMeters ?? 500}m
                </button>
              </dd>
            </div>
          </dl>

          <div className="battery-box">
            <div className="battery-title-row">
              <span>기기 배터리</span>
              <strong>{deviceBattery != null ? `${deviceBattery}%` : "--"}</strong>
            </div>
            <div className="battery-row">
              <div className="battery-bar">
                <div
                  style={{
                    width: deviceBattery != null ? `${deviceBattery}%` : "0%",
                    background:
                      deviceBattery == null ? "transparent"
                      : deviceBattery >= 80 ? "var(--main-color)"
                      : deviceBattery >= 30 ? "#d89b2b"
                      : "#e05252",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={`card guardian-activity-report ${activitySummary.tone}`}>
          <div className="guardian-activity-report-head">
            <div>
              <span>오늘의 활동 컨디션</span>
              <strong>{activitySummary.title}</strong>
            </div>
            {activityReport?.updatedAt && <em>{activityReport.updatedAt}</em>}
          </div>

          <p>{activitySummary.message}</p>

          {activityChanges.length > 0 && (
            <>
              <small className="guardian-activity-report-note">
                오른쪽 숫자는 평소 평균 대비 오늘 점수 변화입니다.
              </small>
              <div className="guardian-activity-report-list">
                {activityChanges.map(([key, change]) => (
                  <div key={key}>
                    <span>{ACTIVITY_LABELS[key] || key}</span>
                    <strong>{formatActivityScore(change.today)}</strong>
                    <em>{change.diff > 0 ? "+" : ""}{formatActivityScore(change.diff)}</em>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {isSafeZoneOpen && (
          <section className="card safe-zone-card">
            <div className="safe-zone-card-header">
              <h2>안전 반경 관리</h2>
              <span>{safeZones.length}/3</span>
            </div>

            <div className="safe-zone-list">
              {safeZones.map((zone) => (
                <article
                  key={zone.id}
                  className={`safe-zone-list-item${zone.id === safeZoneForm.id ? " active" : ""}`}
                >
                  <button
                    type="button"
                    className="safe-zone-list-content"
                    onClick={() => onSelectSafeZoneForm(zone.id)}
                  >
                    <strong>{zone.name || "안전 반경"}</strong>
                    <span>{zone.radiusMeters ?? 500}m</span>
                    <small>{zone.address || "주소 정보 없음"}</small>
                  </button>

                  {safeZones.length > 1 && (
                    <button
                      type="button"
                      className="safe-zone-remove-button"
                      onClick={() => onDeleteSafeZone(zone.id)}
                      aria-label={`${zone.name || "안전 반경"} 삭제`}
                    >
                      ×
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </aside>

      {isProfileEditOpen && (
        <div className="profile-edit-backdrop" onClick={() => setIsProfileEditOpen(false)}>
          <section className="profile-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="profile-edit-header">
              <div>
                <h2>보호 대상자 정보 수정</h2>
                <p>{selectedElder.name}님의 카드 정보를 간단히 수정합니다.</p>
              </div>

              <button type="button" onClick={() => setIsProfileEditOpen(false)}>
                닫기
              </button>
            </div>

            <div className="profile-edit-form">
              <label>
                관계
                <input
                  value={profileEditForm.relation}
                  onChange={(event) => handleProfileEditChange("relation", event.target.value)}
                  placeholder="예: 엄마, 아빠, 배우자"
                />
              </label>

              <label>
                연락처
                <input
                  value={profileEditForm.phone}
                  onChange={(event) => handleProfileEditChange("phone", formatPhoneNumber(event.target.value))}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                />
              </label>

              <label>
                주요 질환
                <input
                  value={profileEditForm.condition}
                  onChange={(event) => handleProfileEditChange("condition", event.target.value)}
                  placeholder="예: 치매/인지, 당뇨"
                />
              </label>

              <label>
                복약 정보
                <textarea
                  value={profileEditForm.medications}
                  onChange={(event) => handleProfileEditChange("medications", event.target.value)}
                  placeholder="예: 당뇨약, 관절약"
                  rows={3}
                />
              </label>
            </div>

            <div className="profile-edit-actions">
              <button type="button" onClick={() => setIsProfileEditOpen(false)}>
                취소
              </button>

              <button type="button" onClick={handleSaveProfileEdit} disabled={isSavingProfileEdit}>
                {isSavingProfileEdit ? "저장 중" : "저장"}
              </button>
            </div>
          </section>
        </div>
      )}

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
              value={seniorSearch.name}
              onChange={(event) =>
                setSeniorSearch((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="이름"
              onKeyDown={(event) => event.key === "Enter" && onSearchSenior()}
            />

            <input
              value={seniorSearch.phone}
              onChange={(event) =>
                setSeniorSearch((prev) => ({
                  ...prev,
                  phone: formatPhoneNumber(event.target.value),
                }))
              }
              placeholder="전화번호"
              inputMode="numeric"
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
            <p className="add-elder-empty">보호 대상자의 이름과 전화번호를 모두 입력해 검색해주세요.</p>
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
                  setNewSeniorForm((prev) => ({
                    ...prev,
                    phone: formatPhoneNumber(event.target.value),
                  }))
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
