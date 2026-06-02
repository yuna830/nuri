import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Repeat2 } from "lucide-react";

import { getSeniorGuardians, getSeniorWelfareWorker, updateSeniorWelfareWorker } from "../../api/adminApi";
import AdminLayout from "./AdminLayout";
import { useAdminData } from "./useAdminData";

function AdminSeniorDetail() {
  const { id } = useParams();
  const { seniors, welfareWorkers, welfareById, guardianById, isLoading, loadError } = useAdminData();
  const senior = useMemo(() => seniors.find((item) => String(item.id) === String(id)), [id, seniors]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [localWorkerId, setLocalWorkerId] = useState(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [fallApiUrl, setFallApiUrl] = useState("");
  const [isCameraSaving, setIsCameraSaving] = useState(false);
  const [cameraSaveMessage, setCameraSaveMessage] = useState(null);

  const displayedSenior = senior
    ? {
        ...senior,
        welfareId: localWorkerId !== undefined ? localWorkerId : senior.welfareId,
        welfareWorker: localWorkerId !== undefined ? null : senior.welfareWorker,
      }
    : null;

  const worker = getSeniorWelfareWorker(displayedSenior, welfareById);
  const guardians = getSeniorGuardians(displayedSenior, guardianById);
  const currentWorkerId = displayedSenior?.welfareId ? String(displayedSenior.welfareId) : "";
  const hasSelectionChanged = selectedWorkerId !== currentWorkerId;
  const actionLabel = selectedWorkerId ? "\uc7ac\ubc30\uc815" : worker ? "\ub2f4\ub2f9 \ud574\uc81c" : "\uc7ac\ubc30\uc815";

  useEffect(() => {
    if (!displayedSenior) return;
    setSelectedWorkerId(displayedSenior.welfareId ? String(displayedSenior.welfareId) : "");
    setFallApiUrl(displayedSenior.fallApiUrl || "");
  }, [displayedSenior?.id, displayedSenior?.welfareId, displayedSenior?.fallApiUrl]);

  const handleCameraSave = async () => {
    if (!displayedSenior) return;
    setIsCameraSaving(true);
    setCameraSaveMessage(null);
    try {
      const response = await fetch(`/api/seniors/${displayedSenior.id}/fall-api-url`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fallApiUrl: fallApiUrl.trim() }),
      });
      if (!response.ok) throw new Error();
      setCameraSaveMessage({ type: "success", text: "카메라 주소가 저장되었습니다." });
    } catch {
      setCameraSaveMessage({ type: "error", text: "저장에 실패했습니다." });
    } finally {
      setIsCameraSaving(false);
    }
  };

  const handleReassign = async () => {
    if (!displayedSenior || !hasSelectionChanged) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const updatedSenior = await updateSeniorWelfareWorker(displayedSenior.id, selectedWorkerId);
      setLocalWorkerId(updatedSenior.welfareId ?? null);
      setSaveMessage({
        type: "success",
        text: selectedWorkerId
          ? "\ubcf5\uc9c0\uc0ac \uc7ac\ubc30\uc815\uc774 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4."
          : "\ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac\uac00 \ud574\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.",
      });
    } catch {
      setSaveMessage({
        type: "error",
        text: selectedWorkerId
          ? "\uc7ac\ubc30\uc815 \uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4."
          : "\ub2f4\ub2f9 \ud574\uc81c\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <header className="admin-page-header">
        <h1>{"\uc5b4\ub974\uc2e0 \uc0c1\uc138"}</h1>
        <p>{"\uc5f0\uacb0\ub41c \ubcf4\ud638\uc790\uc640 \ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac\ub97c \ud655\uc778\ud558\uace0 \ubcf5\uc9c0\uc0ac\ub97c \uc7ac\ubc30\uc815\ud569\ub2c8\ub2e4."}</p>
      </header>

      {loadError ? (
        <p className="admin-error-note">{loadError}</p>
      ) : isLoading ? (
        <p className="admin-empty">{"\uc5b4\ub974\uc2e0 \uc815\ubcf4\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4."}</p>
      ) : !displayedSenior ? (
        <div className="admin-panel">
          <p className="admin-empty">{"\ud574\ub2f9 \uc5b4\ub974\uc2e0\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."}</p>
          <Link className="admin-button" to="/admin/seniors">{"\ubaa9\ub85d\uc73c\ub85c"}</Link>
        </div>
      ) : (
        <div className="admin-detail-grid">
          <section className="admin-panel">
            <h2>{"\uae30\ubcf8 \uc815\ubcf4"}</h2>
            <dl className="admin-info-list">
              <dt>{"\uc774\ub984"}</dt>
              <dd>{displayedSenior.name}</dd>
              <dt>{"\ub098\uc774"}</dt>
              <dd>{displayedSenior.age ? `${displayedSenior.age}\uc138` : "-"}</dd>
              <dt>{"\uc131\ubcc4"}</dt>
              <dd>{displayedSenior.gender || "-"}</dd>
              <dt>{"\uc5f0\ub77d\ucc98"}</dt>
              <dd>{displayedSenior.phone || "-"}</dd>
              <dt>{"\uc8fc\uc18c"}</dt>
              <dd>{displayedSenior.address || "-"}</dd>
              <dt>{"\uc0c1\ud0dc"}</dt>
              <dd>
                <span className={`admin-badge ${displayedSenior.active ? "active" : "inactive"}`}>
                  {displayedSenior.active ? "\ud65c\uc131" : "\ube44\ud65c\uc131"}
                </span>
              </dd>
            </dl>
          </section>

          <section className="admin-panel">
            <h2>{"\ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac"}</h2>
            {worker ? (
              <div className="admin-linked-item">
                <strong>{worker.name}</strong>
                <span>{`${worker.center || "-"} / ${worker.phone || "\uc5f0\ub77d\ucc98 \uc5c6\uc74c"}`}</span>
              </div>
            ) : (
              <p className="admin-empty">{"\ub2f4\ub2f9 \ubcf5\uc9c0\uc0ac\uac00 \ubc30\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4."}</p>
            )}

            <div className="admin-reassign-row">
              <select
                className="admin-select"
                value={selectedWorkerId}
                onChange={(event) => {
                  setSelectedWorkerId(event.target.value);
                  setSaveMessage(null);
                }}
                aria-label="\uc7ac\ubc30\uc815\ud560 \ubcf5\uc9c0\uc0ac"
              >
                <option value="">{worker ? "\ub2f4\ub2f9 \ud574\uc81c" : "\ubcf5\uc9c0\uc0ac \uc120\ud0dd"}</option>
                {welfareWorkers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.name} / ${item.center || "-"}${item.active ? "" : " / \ube44\ud65c\uc131"}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="admin-button primary"
                onClick={handleReassign}
                disabled={!hasSelectionChanged || isSaving}
              >
                <Repeat2 size={16} />
                {isSaving ? "\uc800\uc7a5 \uc911" : actionLabel}
              </button>
            </div>
            {saveMessage ? (
              <p className={`admin-action-message ${saveMessage.type}`}>{saveMessage.text}</p>
            ) : null}
          </section>

          <section className="admin-panel">
            <h2>\uce74\uba54\ub77c \uc5f0\ub3d9</h2>
            <p className="admin-section-desc">\ub099\uc0c1 \uac10\uc9c0 \uce74\uba54\ub77c \uc11c\ubc84 \uc8fc\uc18c\ub97c \uc785\ub825\ud558\uba74 \ud65c\ub3d9 \ub370\uc774\ud130\uac00 \uc790\ub3d9\uc73c\ub85c \uc800\uc7a5\ub429\ub2c8\ub2e4.</p>
            <div className="admin-reassign-row">
              <input
                className="admin-input"
                type="url"
                placeholder="\uc608: http://192.168.0.10:5000"
                value={fallApiUrl}
                onChange={(event) => {
                  setFallApiUrl(event.target.value);
                  setCameraSaveMessage(null);
                }}
              />
              <button
                type="button"
                className="admin-button primary"
                onClick={handleCameraSave}
                disabled={isCameraSaving}
              >
                {isCameraSaving ? "\uc800\uc7a5 \uc911" : "\uc800\uc7a5"}
              </button>
            </div>
            {cameraSaveMessage && (
              <p className={`admin-action-message ${cameraSaveMessage.type}`}>{cameraSaveMessage.text}</p>
            )}
          </section>

          <section className="admin-panel">
            <h2>{"\uc5f0\uacb0 \ubcf4\ud638\uc790"}</h2>
            <div className="admin-linked-list">
              {guardians.length === 0 ? (
                <p className="admin-empty">{"\uc5f0\uacb0\ub41c \ubcf4\ud638\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."}</p>
              ) : (
                guardians.map((guardian) => (
                  <div key={guardian.id} className="admin-linked-item">
                    <strong>{guardian.name}</strong>
                    <span>{`${guardian.relation || "\uad00\uacc4 \ubbf8\ub4f1\ub85d"} / ${guardian.phone || "\uc5f0\ub77d\ucc98 \uc5c6\uc74c"}`}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminSeniorDetail;
