import { useEffect, useState } from 'react';

const fieldValue = (analysis, name) => analysis?.fields?.[name]?.value || '';
const normalized = (value) => String(value || '').trim().toUpperCase();
const isCompleteModelNumber = (value) => {
  const candidate = normalized(value);
  return !candidate.startsWith('R-R-')
    && /[A-Z]/.test(candidate)
    && /\d/.test(candidate)
    && /^[A-Z0-9][A-Z0-9._/-]{3,}$/.test(candidate);
};
const isCompleteCertificationNumber = (value) => {
  const candidate = normalized(value);
  return /^(?:XU|HU|JU|CB)\d{6,}-\d{4,}$/.test(candidate)
    || /^R-R-[A-Z0-9]{2,}-[A-Z0-9-]{2,}$/.test(candidate);
};
const isCompleteBarcode = (value) => /^\d{8,14}$/.test(String(value || '').trim());

export default function ProductRegistrationModal({
  open,
  seniors,
  form,
  setForm,
  method,
  setMethod,
  image,
  setImage,
  analysis,
  setAnalysis,
  analyzing,
  registering,
  onAnalyze,
  onSubmit,
  onClose,
  photoEnabled,
  registrationError,
}) {
  const [editing, setEditing] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!image) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (!open) return null;

  const validModelNumber = isCompleteModelNumber(form.modelNumber);
  const validCertificationNumber = isCompleteCertificationNumber(form.certificationNumber);
  const validBarcode = isCompleteBarcode(form.barcode);
  const certificationNumbers = analysis?.fields?.certificationNumbers?.value || [];
  const hasModelWithMaker = validModelNumber && Boolean(form.brandName.trim() || form.manufacturer.trim());
  const hasStrongIdentifier = validCertificationNumber || validBarcode || hasModelWithMaker;
  const photoReady = hasStrongIdentifier;
  const resetPhoto = () => {
    setImage(null);
    setAnalysis(null);
    setEditing(false);
  };
  const changeMethod = (nextMethod) => {
    setMethod(nextMethod);
    setEditing(false);
  };

  const basicFields = (
    <>
      <label>제품명{method === 'MANUAL' ? ' *' : ''}<input required={method === 'MANUAL'} value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} /></label>
      <label>브랜드<input value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value })} /></label>
      <label>모델명·모델번호<input value={form.modelNumber} onChange={(event) => setForm({ ...form, modelNumber: event.target.value })} /></label>
      <label>인증·신고번호<input value={form.certificationNumber} onChange={(event) => setForm({ ...form, certificationNumber: event.target.value })} /></label>
    </>
  );

  return (
    <div className="guardian-safety-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="guardian-safety-modal guardian-product-register-modal product-registration-flow" onSubmit={(event) => {
        const identifier = validCertificationNumber
          ? `인증·신고번호 ${form.certificationNumber}`
          : validBarcode
            ? `바코드 ${form.barcode}`
            : `모델번호 ${form.modelNumber}`;
        if (!form.productName.trim() && !window.confirm(`제품명이 인식되지 않았습니다.\n\n${identifier}을 기준으로 제품을 등록하고 공식 정보를 조회할까요?`)) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}>
        <header><h2>제품 등록</h2><button type="button" aria-label="닫기" onClick={onClose}>×</button></header>
        <label>대상 어르신
          <select required value={form.seniorId} onChange={(event) => setForm({ ...form, seniorId: event.target.value })}>
            <option value="">선택</option>
            {seniors.map((senior) => <option key={senior.id} value={senior.id}>{senior.name} 어르신</option>)}
          </select>
        </label>

        {photoEnabled && <div className="registration-method">
          <button type="button" className={method === 'PHOTO' ? 'active' : ''} onClick={() => changeMethod('PHOTO')}>라벨 촬영·업로드</button>
          <button type="button" className={method === 'MANUAL' ? 'active' : ''} onClick={() => changeMethod('MANUAL')}>직접 입력</button>
        </div>}

        {photoEnabled && method === 'PHOTO' ? (
          <section className="photo-registration">
            {!analysis ? <>
              <div className="photo-registration__intro">
                <strong>제품 라벨 사진</strong>
                <p>제품 뒷면이나 바닥의 라벨을 가까이 촬영해 주세요.<br />모델명 또는 인증번호가 선명하게 보여야 합니다.</p>
              </div>
              <label className={`label-upload-box ${previewUrl ? 'has-image' : ''}`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImage(event.target.files?.[0] || null); setAnalysis(null); }} />
                {previewUrl ? <img src={previewUrl} alt="선택한 제품 라벨 미리보기" /> : <><span className="label-upload-box__icon">▧</span><strong>제품 라벨 사진 올리기</strong><small>제품 전체 사진이 아닌 라벨 사진 · JPG, PNG, WEBP</small></>}
              </label>
              {image && <div className="selected-label-file"><span>{image.name}</span><label>다른 사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImage(event.target.files?.[0] || null); setAnalysis(null); }} /></label></div>}
              {registrationError && <div className="analysis-inline-warning"><strong>제품 정보를 충분히 읽지 못했습니다.</strong><span>{registrationError}</span><button type="button" className="switch-manual" onClick={() => changeMethod('MANUAL')}>직접 입력으로 전환</button></div>}
              <button type="button" className="submit" disabled={!image || analyzing} onClick={onAnalyze}>{analyzing ? '사진 분석 중...' : '사진 분석'}</button>
            </> : <>
              <div className="analysis-result-heading"><strong>제품 정보가 인식되었습니다.</strong><p>모델번호와 인증번호가 실제 라벨과 같은지 확인해 주세요.</p></div>
              <div className="analysis-result-layout">
                {previewUrl && <img className="analysis-result-image" src={previewUrl} alt="분석한 제품 라벨" />}
                <dl className="analysis-result-summary">
                  <div><dt>제품명</dt><dd>{form.productName || '등록 후 공식 조회로 확인 예정'}</dd></div>
                  <div><dt>브랜드</dt><dd>{form.brandName || '확인되지 않음'}</dd></div>
                  <div><dt>모델번호</dt><dd>{form.modelNumber || '확인되지 않음'}</dd>{validModelNumber && fieldValue(analysis, 'modelNumber') && <small>✓ 라벨에서 확인됨</small>}{form.modelNumber && !validModelNumber && <small className="invalid-field">불완전한 모델번호입니다.</small>}</div>
                  <div><dt>인증·신고번호</dt><dd>{certificationNumbers.length ? certificationNumbers.join(' / ') : form.certificationNumber || '확인되지 않음'}</dd>{validCertificationNumber && fieldValue(analysis, 'certificationNumber') && <small>✓ 라벨에서 확인됨</small>}{form.certificationNumber && !validCertificationNumber && <small className="invalid-field">전체 인증번호가 아닙니다.</small>}</div>
                  <div><dt>제조번호</dt><dd>{form.serialNumber || '확인되지 않음'}</dd>{form.serialNumber && <small>✓ 라벨에서 확인됨</small>}</div>
                  <div><dt>수입원</dt><dd>{fieldValue(analysis, 'importer') || '확인되지 않음'}</dd></div>
                  <div><dt>바코드</dt><dd>{form.barcode || '확인되지 않음'}</dd></div>
                </dl>
              </div>
              {!hasStrongIdentifier && <div className="analysis-inline-warning"><strong>제품을 식별할 수 있는 정보가 충분하지 않습니다.</strong><span>전체 인증번호, 바코드 또는 모델번호와 브랜드를 확인해 주세요.</span></div>}
              {editing && <section className="analysis-edit-panel"><h3>인식 결과 수정</h3>{basicFields}</section>}
              <div className="analysis-result-actions">
                <button type="button" disabled={registering} onClick={resetPhoto}>다시 촬영</button>
                <button type="button" disabled={registering} onClick={() => setEditing((value) => !value)}>{editing ? '수정 닫기' : '인식 결과 수정'}</button>
                <button type="submit" className={`primary ${registering ? 'is-loading' : ''}`} disabled={!photoReady || registering}>{registering ? '등록 중...' : '이 정보로 제품 등록'}</button>
              </div>
              {!photoReady && <button type="button" className="switch-manual" onClick={() => changeMethod('MANUAL')}>직접 입력으로 전환</button>}
            </>}
          </section>
        ) : (
          <section className="manual-registration">
            {basicFields}
            <button type="button" className="additional-fields-toggle" onClick={() => setShowExtra((value) => !value)}>추가 정보 입력 {showExtra ? '▲' : '▼'}</button>
            {showExtra && <div className="analysis-extra">
              <label>바코드<input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></label>
              <label>제조사<input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></label>
              <label>제조일자<input value={form.manufacturingDate} onChange={(event) => setForm({ ...form, manufacturingDate: event.target.value })} /></label>
            </div>}
            <label>현재 사용 여부 *<select required value={form.currentUseStatus} onChange={(event) => setForm({ ...form, currentUseStatus: event.target.value })}><option value="IN_USE">사용 중</option><option value="STOPPED">사용 중지</option><option value="DISPOSED">폐기 완료</option><option value="UNKNOWN">확인 필요</option></select></label>
            <button className={`submit ${registering ? 'is-loading' : ''}`} disabled={registering}>{registering ? '등록 중...' : '이 정보로 제품 등록'}</button>
          </section>
        )}
      </form>
    </div>
  );
}
