import { resolveUploadUrl } from "../api/userPageApi.js";

export default function ProfilePhotoPicker({
  classPrefix,
  imageUrl,
  uploading = false,
  onChange,
  onRemove,
  alt = "프로필 사진",
}) {
  return (
    <div className={`${classPrefix}-photo-field`}>
      <label className={`${classPrefix}-photo-picker`}>
        {imageUrl ? (
          <img src={resolveUploadUrl(imageUrl)} alt={alt} />
        ) : (
          <span>사진</span>
        )}

        <input type="file" accept="image/*" onChange={onChange} disabled={uploading} />
      </label>

      <div className={`${classPrefix}-photo-copy`}>
        <strong>프로필 사진</strong>
        <p>
          사진 영역을 눌러 등록하거나 변경할 수 있습니다.
          {uploading && <span className={`${classPrefix}-photo-uploading`}> 업로드 중...</span>}
        </p>

        {imageUrl && (
          <button className={`${classPrefix}-photo-remove`} type="button" onClick={onRemove}>
            사진 삭제
          </button>
        )}
      </div>
    </div>
  );
}
