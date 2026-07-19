import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import GuardianLayout from './GuardianLayout.jsx';
import { getSeniorsByGuardian } from '../../api/guardianApi.js';
import { deleteProduct, getProductsBySenior, registerProduct } from '../../api/recallApi.js';
import { createAction, getActionsBySenior, updateActionStatus } from '../../api/actionApi.js';
import { analyzeProductLabel, confirmProductLabelAnalysis, productDocumentAiEnabled } from '../../api/documentAiApi.js';
import ProductRegistrationModal from './ProductRegistrationModal.jsx';
import '../../css/guardian/Safety.css';

const USE_LABEL = { IN_USE: '사용 중', STOPPED: '사용 중지', DISPOSED: '폐기 완료', NOT_IN_USE: '사용 중지', NOT_OWNED: '폐기 완료', UNKNOWN: '확인 필요' };
const CHECKS = [
  { type: 'ELECTRIC_CHECK', label: '전기 안전' },
  { type: 'GAS_CHECK', label: '가스 안전' },
  { type: 'FIRE_CHECK', label: '화재·소방' },
  { type: 'HEATING_CHECK', label: '난방기기' },
  { type: 'FALL_CHECK', label: '욕실·낙상 위험' },
];
const CHECK_STATUS = { PENDING: '점검 필요', IN_PROGRESS: '조치 중', COMPLETED: '정상', CANCELLED: '조치 완료' };
const emptyForm = { seniorId: '', productType: '', productName: '', brandName: '', manufacturer: '', modelNumber: '', barcode: '', certificationNumber: '', serialNumber: '', manufacturingDate: '', currentUseStatus: 'IN_USE' };
const RECALL_LABEL = { RECALL_CONFIRMED: '공식 리콜 일치', NO_MATCH_FOUND: '등록 공고 일치 없음', REVIEW_REQUIRED: '추가 확인 필요' };
function recallMessage(product) {
  if (product.recallCheckStatus === 'FAILED') return '제품안전정보센터 조회에 실패했습니다. 이전 확인 결과는 유지됩니다. 잠시 후 다시 확인해 주세요.';
  if (product.recallDecisionStatus === 'RECALL_CONFIRMED') return '국가기술표준원 제품안전정보센터의 공식 리콜 공고와 일치하는 제품입니다.';
  if (product.recallDecisionStatus === 'NO_MATCH_FOUND') return '현재 등록된 리콜 공고 중 입력한 제품정보와 일치하는 항목을 찾지 못했습니다. 이 결과는 제품의 전반적인 안전성을 보증하지 않습니다.';
  if (product.recallDecisionStatus === 'REVIEW_REQUIRED') return '리콜 후보가 확인됐지만 제품정보가 부족하거나 추가 조건 확인이 필요합니다.';
  return product.recallReason || '리콜 정보를 확인하지 않았습니다.';
}

function asArray(value) { return Array.isArray(value) ? value : []; }
function cleanOfficialText(value) {
  if (!value) return '';
  return String(value)
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-•●○◦ㆍ·ㅇ]|[oO](?=[가-힣]))\s*/, '').trim())
    .filter(Boolean)
    .join('\n');
}
function formatDate(value) { if (!value) return '조회 기록 없음'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '조회 기록 없음'; return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`; }
function matchedEvidence(product) {
  const fields = asArray(product.matchedFields);
  const evidence = [];
  if (fields.includes('MODEL_NUMBER') && product.modelNumber) evidence.push(`모델번호 ${product.modelNumber}`);
  if ((fields.includes('MANUFACTURER_OR_BRAND') || fields.includes('BRAND_NAME')) && product.brandName) evidence.push(`브랜드 ${product.brandName}`);
  if (fields.includes('BARCODE') && product.barcode) evidence.push(`바코드 ${product.barcode}`);
  if (fields.includes('CERTIFICATION_NUMBER') && product.certificationNumber) evidence.push(`인증·신고번호 ${product.certificationNumber}`);
  return evidence;
}
const MISSING_LABEL = { MODEL_NUMBER: '제품의 모델번호가 등록되지 않았습니다.', BARCODE: '제품의 바코드가 등록되지 않았습니다.', CERTIFICATION_NUMBER: '제품의 인증번호가 등록되지 않았습니다.', MANUFACTURING_DATE: '제품 라벨의 제조일자를 확인해 주세요.', SERIAL_NUMBER: '제품의 일련번호를 확인해 주세요.', LOT_NUMBER: '제품의 제조 로트를 확인해 주세요.', ADDITIONAL_SCOPE_CONDITION: '공식 공고의 추가 대상 조건을 확인해 주세요.', MANUFACTURER_OR_BRAND_CONFIRMATION: '제품의 브랜드 또는 제조사를 확인해 주세요.' };
const ACTION_UI = {
  IMMEDIATE_STOP: { status: '즉시 사용 중지 필요', button: '리콜 제품 안내', fallback: '즉시 사용을 중지해 주세요.' },
  REPAIR_OR_COLLECTION: { status: '수선 필요', button: '리콜 제품 안내', fallback: '구입처 또는 고객센터를 통해 수거·수선을 신청해 주세요.' },
  EXCHANGE_OR_REFUND: { status: '교환·환불 필요', button: '리콜 제품 안내', fallback: '판매처에 교환·환불을 문의해 주세요.' },
  PRODUCT_CHECK_REQUIRED: { status: '추가 확인 필요', button: '리콜 제품 안내', fallback: '모델번호와 제조기간을 확인해 주세요.' },
  GENERAL_GUIDANCE: { status: '공식 조치 확인 필요', button: '리콜 제품 안내', fallback: '공식 리콜 행동요령을 확인해 주세요.' },
};
function actionUi(product) { return ACTION_UI[product.matchedRecallNotice?.actionType] || ACTION_UI.GENERAL_GUIDANCE; }
function displayProductName(product) {
  return product.matchedRecallNotice?.productName || product.productName || '제품명 확인 필요';
}
function productColorState(product) {
  if (product.actionStatus === 'COMPLETED' || product.followUpProgressStatus === 'COMPLETED' || product.finalResult) return 'completed';
  if (product.recallDecisionStatus === 'REVIEW_REQUIRED' || product.matchedRecallNotice?.actionType === 'PRODUCT_CHECK_REQUIRED') return 'review';
  if (product.matchedRecallNotice?.actionType === 'IMMEDIATE_STOP') return 'urgent';
  if (['REPAIR', 'COLLECTION', 'REPAIR_OR_COLLECTION', 'EXCHANGE', 'REFUND', 'EXCHANGE_OR_REFUND'].includes(product.matchedRecallNotice?.actionType)) return 'follow-up';
  return 'neutral';
}
function productStatusLabel(product, confirmed, action, colorState) {
  if (product.recallCheckStatus === 'FAILED') return '조회 실패';
  if (colorState === 'completed') return '조치 완료';
  if (colorState === 'review') return '추가 확인 필요';
  return confirmed ? action.status : RECALL_LABEL[product.recallDecisionStatus] || '확인 필요';
}
function compactActionMessage(product) {
  const type = product.matchedRecallNotice?.actionType;
  if (type === 'IMMEDIATE_STOP') return '안전을 위해 즉시 사용을 중지해 주세요.';
  if (type === 'REPAIR_OR_COLLECTION') return '구입처 또는 고객센터에 수거·수선을 신청해 주세요.';
  if (type === 'EXCHANGE_OR_REFUND') return '판매처에 교환·환불을 문의해 주세요.';
  if (type === 'PRODUCT_CHECK_REQUIRED') return '모델번호와 제조기간을 추가로 확인해 주세요.';
  return '공식 리콜 조치 내용을 확인해 주세요.';
}

export default function Safety() {
  const [params, setParams] = useSearchParams();
  const [seniors, setSeniors] = useState([]);
  const [products, setProducts] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registrationFlowOpen, setRegistrationFlowOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [guidanceTarget, setGuidanceTarget] = useState(null);
  const [checkDetail, setCheckDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [registrationMethod, setRegistrationMethod] = useState('MANUAL');
  const [labelImage, setLabelImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const selectedId = params.get('seniorId') || 'ALL';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const seniorResponse = await getSeniorsByGuardian();
      const seniorList = asArray(seniorResponse.data);
      setSeniors(seniorList);
      const results = await Promise.all(seniorList.map(async (senior) => {
        const [productResult, actionResult] = await Promise.all([
          getProductsBySenior(senior.id).catch(() => ({ data: [] })),
          getActionsBySenior(senior.id).catch(() => ({ data: [] })),
        ]);
        return { products: asArray(productResult.data).map(item => ({ ...item, seniorName: senior.name })), actions: asArray(actionResult.data) };
      }));
      setProducts(results.flatMap(item => item.products));
      setActions(results.flatMap(item => item.actions));
    } catch (e) { setError(e.response?.data?.message || '제품·생활안전 정보를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visibleProducts = useMemo(() => selectedId === 'ALL' ? products : products.filter(p => String(p.seniorId) === selectedId), [products, selectedId]);
  const visibleActions = useMemo(() => selectedId === 'ALL' ? actions : actions.filter(a => String(a.seniorId) === selectedId), [actions, selectedId]);
  const latestChecks = useMemo(() => Object.fromEntries(CHECKS.map(check => [check.type, visibleActions.filter(a => a.actionType === check.type).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0] || null])), [visibleActions]);
  const recalledCount = visibleProducts.filter(p => p.recallDecisionStatus === 'RECALL_CONFIRMED' || (!p.recallDecisionStatus && p.recallStatus === 'RECALLED')).length;
  const reviewCount = visibleProducts.filter(p => p.recallDecisionStatus === 'REVIEW_REQUIRED').length;

  async function submitProduct(event) {
    event.preventDefault();
    if (registering) return;
    setRegistering(true);
    setError('');
    try {
      const response = await registerProduct({
        seniorId: Number(form.seniorId),
        productName: form.productName.trim() || null,
        brandName: form.brandName.trim() || null,
        manufacturer: form.manufacturer.trim(),
        modelNumber: form.modelNumber.trim(),
        barcode: form.barcode.trim() || null,
        certificationNumber: form.certificationNumber.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        recallStatus: 'UNKNOWN',
        currentUseStatus: form.currentUseStatus,
        registrationSource: 'GUARDIAN_WEB',
      });
      if (analysis?.analysisId) {
        await confirmProductLabelAnalysis(
          analysis.analysisId,
          { productName: form.productName, brandName: form.brandName, manufacturer: form.manufacturer, modelNumber: form.modelNumber, barcode: form.barcode, certificationNumber: form.certificationNumber, serialNumber: form.serialNumber, importer: analysis?.fields?.importer?.value || '', manufacturingDate: form.manufacturingDate },
          response.data?.id,
        ).catch(() => {});
      }
      setRegisterOpen(false); setRegistrationFlowOpen(false); setForm(emptyForm); await load();
    } catch (registerError) {
      setError(registerError.response?.data?.message || '제품 등록 권한을 확인할 수 없습니다. 다시 로그인해 주세요.');
    } finally { setRegistering(false); }
  }
  async function analyzeLabel() {
    if (!form.seniorId || !labelImage) return setError('대상 어르신과 제품 라벨 사진을 선택해 주세요.');
    setAnalyzing(true); setError('');
    try {
      const response = await analyzeProductLabel({ image: labelImage, seniorId: form.seniorId });
      const result = response.data;
      setAnalysis(result);
      setForm(current => ({
        ...current,
        productName: result.fields?.productName?.value || current.productName,
        brandName: result.fields?.brandName?.value || current.brandName,
        manufacturer: result.fields?.manufacturer?.value || current.manufacturer,
        modelNumber: result.fields?.modelNumber?.value || current.modelNumber,
        barcode: result.fields?.barcode?.value || '',
        certificationNumber: result.fields?.certificationNumber?.value || '',
        serialNumber: result.fields?.serialNumber?.value || '',
        manufacturingDate: result.fields?.manufacturingDate?.value || '',
      }));
    } catch (e) {
      setError(e.response?.data?.detail || '모델명이나 인증번호가 보이도록 라벨을 더 가까이 촬영해 주세요.');
    } finally { setAnalyzing(false); }
  }
  function openRegistration() {
    setError('');
    setForm({ ...emptyForm, seniorId: selectedId === 'ALL' ? seniors[0]?.id || '' : selectedId });
    setRegistrationMethod(productDocumentAiEnabled ? 'PHOTO' : 'MANUAL'); setLabelImage(null); setAnalysis(null); setRegistrationFlowOpen(true);
  }
  async function removeProduct(product) {
    if (!window.confirm('등록 제품을 삭제하시겠습니까?\n삭제하면 리콜 확인 기록에서도 제외됩니다.')) return;
    await deleteProduct(product.id); await load();
  }
  async function completeCheck(check) {
    const existing = latestChecks[check.type];
    const note = window.prompt('점검 내용 또는 특이사항을 입력해 주세요.', existing?.note || '이상 없음');
    if (note == null) return;
    if (existing) await updateActionStatus(existing.id, 'COMPLETED', note);
    else {
      if (selectedId === 'ALL') return setError('점검을 완료할 어르신을 먼저 선택해 주세요.');
      await createAction({ seniorId: Number(selectedId), actionType: check.type, actionSubject: 'GUARDIAN', status: 'COMPLETED', note });
    }
    setCheckDetail(null); await load();
  }

  return <GuardianLayout activeMenu="safety"><main className="guardian-safety-page">
    <ProductRegistrationModal open={registrationFlowOpen} seniors={seniors} form={form} setForm={setForm} method={registrationMethod} setMethod={setRegistrationMethod} image={labelImage} setImage={setLabelImage} analysis={analysis} setAnalysis={setAnalysis} analyzing={analyzing} registering={registering} onAnalyze={analyzeLabel} onSubmit={submitProduct} onClose={() => !registering && setRegistrationFlowOpen(false)} photoEnabled={productDocumentAiEnabled} registrationError={error} />
    <header className="guardian-safety-page__header"><div><h1>제품·생활안전</h1><p>등록 제품의 리콜 상태와 생활안전 점검 결과를 관리합니다.</p></div><button onClick={openRegistration}>제품 등록</button></header>
    <div className="guardian-safety-page__seniors">{[{ id: 'ALL', name: '전체' }, ...seniors].map(s => <button key={s.id} className={String(s.id) === selectedId ? 'active' : ''} onClick={() => setParams(s.id === 'ALL' ? {} : { seniorId: s.id })}>{s.name}</button>)}</div>
    <section className="guardian-safety-summary"><div><span>등록 제품</span><strong>{visibleProducts.length}개</strong></div><div className={recalledCount ? 'danger' : ''}><span>리콜 대상</span><strong>{recalledCount}개</strong></div><div className={reviewCount ? 'warning' : ''}><span>추가 확인 필요</span><strong>{reviewCount}개</strong></div></section>
    {error && <p className="guardian-safety-page__error">{error}</p>}
    <section className="guardian-safety-section guardian-products-section"><div className="guardian-safety-section__heading"><div><h2>등록 제품</h2><p>제품별 리콜 여부와 조치 상태를 확인하세요.</p></div><span>{visibleProducts.length}개</span></div>
      {loading ? <div className="guardian-safety-empty">불러오는 중입니다.</div> : visibleProducts.length === 0 ? <div className="guardian-safety-empty">등록된 제품이 없습니다.</div> : <div className="guardian-product-grid">{visibleProducts.map(product => {
        const confirmed = product.recallDecisionStatus === 'RECALL_CONFIRMED' || (!product.recallDecisionStatus && product.recallStatus === 'RECALLED');
        const action = actionUi(product);
        const colorState = productColorState(product);
        return <article className={`guardian-product-card compact state-${colorState}`} key={product.id} onClick={() => setDetail(product)}>
          <div className="guardian-product-card__top"><div><h3>{product.productName}</h3><p>{product.seniorName} 어르신</p></div><b>{productStatusLabel(product, confirmed, action, colorState)}</b></div>
          <div className="guardian-product-card__compact-meta"><span>{product.modelNumber || '모델번호 확인 필요'}</span><strong>{USE_LABEL[product.currentUseStatus] || '확인 필요'}</strong><i>상세 보기</i></div>
        </article>;
      })}</div>}
    </section>
    <section className="guardian-safety-section"><div className="guardian-safety-section__heading"><div><h2>생활안전 점검</h2><p>어르신별 안전 항목의 최근 점검 상태를 관리합니다.</p></div></div><div className="guardian-check-list">{CHECKS.map(check => { const record = latestChecks[check.type]; return <button key={check.type} onClick={() => setCheckDetail({ check, record })}><span><i className={record ? record.status.toLowerCase() : 'unchecked'} />{check.label}</span><strong>{record ? CHECK_STATUS[record.status] || '점검 필요' : '미점검'}</strong><small>{record ? formatDate(record.updatedAt || record.createdAt) : '점검 기록 없음'}</small></button>; })}</div></section>
    {registerOpen && <div className="guardian-safety-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setRegisterOpen(false)}><form className="guardian-safety-modal guardian-product-register-modal" onSubmit={submitProduct}><header><h2>제품 등록</h2><button type="button" onClick={() => setRegisterOpen(false)}>×</button></header><label>대상 어르신<select required value={form.seniorId} onChange={e => setForm({ ...form, seniorId: e.target.value })}><option value="">선택</option>{seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{productDocumentAiEnabled && <div className="registration-method"><button type="button" className={registrationMethod === 'PHOTO' ? 'active' : ''} onClick={() => setRegistrationMethod('PHOTO')}>제품 라벨 사진</button><button type="button" className={registrationMethod === 'MANUAL' ? 'active' : ''} onClick={() => setRegistrationMethod('MANUAL')}>직접 입력</button></div>}{productDocumentAiEnabled && registrationMethod === 'PHOTO' && <section className="label-analysis"><label>제품 라벨 사진<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setLabelImage(e.target.files?.[0] || null); setAnalysis(null); }} /></label><button type="button" className="analyze" disabled={analyzing || !labelImage} onClick={analyzeLabel}>{analyzing ? '분석 중...' : '제품 라벨 분석'}</button>{analysis?.warnings?.length > 0 && <ul>{analysis.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}</section>}<p className="review-notice">분석 결과는 자동 등록되지 않습니다. 제품 라벨과 비교해 직접 확인·수정해 주세요.</p><label>제품명 *<input required value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} /></label><label>브랜드<input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} /></label><label>모델명·모델번호<input value={form.modelNumber} onChange={e => setForm({ ...form, modelNumber: e.target.value })} />{analysis?.fields?.modelNumber && <small>신뢰도 {Math.round((analysis.fields.modelNumber.confidence || 0) * 100)}% · 근거: {analysis.fields.modelNumber.sourceText || '없음'}</small>}</label><div className="analysis-extra"><label>인증·신고번호<input value={form.certificationNumber} onChange={e => setForm({ ...form, certificationNumber: e.target.value })} /></label><label>바코드<input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></label><label>제조사 (선택)<input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></label>{analysis && <label>제조일자<input value={form.manufacturingDate} onChange={e => setForm({ ...form, manufacturingDate: e.target.value })} /></label>}</div><label>현재 사용 여부 *<select required value={form.currentUseStatus} onChange={e => setForm({ ...form, currentUseStatus: e.target.value })}><option value="IN_USE">사용 중</option><option value="STOPPED">사용 중지</option><option value="DISPOSED">폐기 완료</option><option value="UNKNOWN">확인 필요</option></select></label><button className="submit">확인 후 등록</button></form></div>}
    {detail && (() => {
      const evidence = matchedEvidence(detail);
      const missing = asArray(detail.missingFields).map(field => MISSING_LABEL[field]).filter(Boolean);
      const confirmed = detail.recallDecisionStatus === 'RECALL_CONFIRMED';
      const action = actionUi(detail);
      const colorState = productColorState(detail);
      return <div className="guardian-safety-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}>
        <section className={`guardian-safety-modal recall-detail-modal state-${colorState}`}>
          <header>
            <div className="recall-detail-heading">
              <div className="recall-detail-title">
                <h2>{displayProductName(detail)}</h2>
                {confirmed && <span className="recall-status-badge">공식 리콜 대상 · {action.status}</span>}
              </div>
              <p className="recall-product-meta">
                {detail.seniorName} 어르신
                {detail.modelNumber && <> · 모델번호 {detail.modelNumber}</>}
                {' · '}{USE_LABEL[detail.currentUseStatus] || '사용 상태 확인 필요'}
              </p>
            </div>
            <button onClick={() => setDetail(null)}>×</button>
          </header>
          {detail.matchedRecallNotice?.imageUrls?.length > 0 && <section className="recall-photo-section"><strong>공식 제품 사진</strong><p>등록 제품이 아래 공식 리콜 제품과 같은지 추가로 확인해 주세요. 사진은 판정 근거가 아닌 확인 보조 자료입니다.</p><div className="recall-images">{detail.matchedRecallNotice.imageUrls.map(url => <img key={url} src={url} alt="공식 리콜 제품" />)}</div></section>}
          {evidence.length > 0 && <section className="recall-evidence"><strong>공식 공고와 일치한 정보</strong>{evidence.map(item => <span key={item}>✓ {item}</span>)}</section>}
          {missing.length > 0 && <section className="recall-missing"><strong>추가 확인 필요</strong><ul>{missing.map(item => <li key={item}>{item}</li>)}</ul></section>}
          <section className="recall-action-card"><strong>지금 해야 할 조치</strong><p>{cleanOfficialText(detail.consumerAction) || action.fallback}</p>{detail.inquiryTel && <b>문의처 {detail.inquiryTel}</b>}</section>
          <section className="recall-description"><div><strong>제품 결함</strong><p>{cleanOfficialText(detail.defectDescription) || '공식 공고에서 확인해 주세요.'}</p></div><div><strong>위해 정보</strong><p>{cleanOfficialText(detail.hazardDescription) || '공식 공고에서 확인해 주세요.'}</p></div></section>
          <dl className="recall-meta-list"><div><dt>공표일</dt><dd>{formatDate(detail.publishDate)}</dd></div><div><dt>최근 리콜 조회</dt><dd>{formatDate(detail.lastSuccessfulCheckedAt || detail.lastCheckedAt)}</dd></div><div><dt>공식 출처</dt><dd>{detail.sourceUrl ? <a href={detail.sourceUrl} target="_blank" rel="noreferrer">제품안전정보센터</a> : '-'}</dd></div></dl>
          {detail.stopGuidanceCompleted && <div className="guardian-product-card__completion"><strong>사용 중지 확인 완료</strong><span>{formatDate(detail.stopGuidanceCompletedAt)} · 보호자 {detail.stopGuidanceTarget || ''}</span></div>}
          {confirmed && <button className="submit guidance-action" onClick={() => setGuidanceTarget(detail)}>{action.button}</button>}
        </section>
      </div>;
    })()}
    {guidanceTarget && (() => { const action = actionUi(guidanceTarget); return <div className="guardian-safety-modal-backdrop"><section className="guardian-safety-modal guidance-preview-modal"><header><h2>{action.button}</h2><button onClick={() => setGuidanceTarget(null)}>×</button></header><span className="recall-status-badge">공식 리콜 대상 · {action.status}</span><h3>{guidanceTarget.productName}</h3><p className="guidance-recipient">안내 대상 · {guidanceTarget.seniorName} 어르신</p><section className="guidance-message-preview"><strong>[WOORI 제품 리콜 안내]</strong><p>등록된 제품이 공식 리콜 대상과 일치했습니다.</p>{guidanceTarget.hazardDescription && <><b>확인된 내용</b><p>{guidanceTarget.hazardDescription}</p></>}<b>필요한 조치</b><p>{guidanceTarget.consumerAction || action.fallback}</p>{guidanceTarget.inquiryTel && <p>문의처 {guidanceTarget.inquiryTel}</p>}</section><p className="guidance-preview-note">공식 소비자 행동요령을 기준으로 생성된 안내 내용입니다.</p><button className="submit" onClick={() => setGuidanceTarget(null)}>안내 내용 확인</button></section></div>; })()}
    {checkDetail && <div className="guardian-safety-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setCheckDetail(null)}><section className="guardian-safety-modal"><header><h2>{checkDetail.check.label}</h2><button onClick={() => setCheckDetail(null)}>×</button></header><dl className="detail-list"><div><dt>점검 상태</dt><dd>{checkDetail.record ? CHECK_STATUS[checkDetail.record.status] : '미점검'}</dd></div><div><dt>마지막 점검일</dt><dd>{formatDate(checkDetail.record?.updatedAt || checkDetail.record?.createdAt)}</dd></div><div><dt>점검한 사람</dt><dd>{checkDetail.record?.actionSubject === 'GUARDIAN' ? '보호자' : checkDetail.record?.actionSubject === 'WELFARE_WORKER' ? '복지사' : '-'}</dd></div><div><dt>특이사항</dt><dd>{checkDetail.record?.note || '기록 없음'}</dd></div></dl><button className="submit" onClick={() => completeCheck(checkDetail.check)}>점검 완료 처리</button></section></div>}
  </main></GuardianLayout>;
}
