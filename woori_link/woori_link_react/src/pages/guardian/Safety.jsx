import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import GuardianLayout from './GuardianLayout.jsx';
import { getSeniorsByGuardian } from '../../api/guardianApi.js';
import { deleteProduct, getProductsBySenior, registerProduct, updateCurrentUseStatus } from '../../api/recallApi.js';
import { createAction, getActionsBySenior, updateActionStatus } from '../../api/actionApi.js';
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
const emptyForm = { seniorId: '', productType: '', productName: '', manufacturer: '', modelNumber: '', currentUseStatus: 'IN_USE' };

function asArray(value) { return Array.isArray(value) ? value : []; }
function formatDate(value) { if (!value) return '확인 기록 없음'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '확인 기록 없음' : date.toLocaleDateString('ko-KR').replace(/\. /g, '.').replace('.', ''); }

export default function Safety() {
  const [params, setParams] = useSearchParams();
  const [seniors, setSeniors] = useState([]);
  const [products, setProducts] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [checkDetail, setCheckDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
  const recallCount = visibleProducts.filter(p => p.recallStatus === 'RECALLED' && !['STOPPED', 'DISPOSED', 'NOT_OWNED'].includes(p.currentUseStatus)).length;
  const uncheckedCount = CHECKS.filter(c => !latestChecks[c.type]).length;

  async function submitProduct(event) {
    event.preventDefault();
    await registerProduct({ ...form, seniorId: Number(form.seniorId), recallStatus: 'UNKNOWN' });
    setRegisterOpen(false); setForm(emptyForm); await load();
  }
  async function changeUse(product, status) { await updateCurrentUseStatus(product.id, status); await load(); }
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
    <header className="guardian-safety-page__header"><div><h1>제품·생활안전</h1><p>등록 제품의 리콜 상태와 생활안전 점검 결과를 관리합니다.</p></div><button onClick={() => { setForm({ ...emptyForm, seniorId: selectedId === 'ALL' ? seniors[0]?.id || '' : selectedId }); setRegisterOpen(true); }}>제품 직접 등록</button></header>
    <div className="guardian-safety-page__seniors">{[{ id: 'ALL', name: '전체' }, ...seniors].map(s => <button key={s.id} className={String(s.id) === selectedId ? 'active' : ''} onClick={() => setParams(s.id === 'ALL' ? {} : { seniorId: s.id })}>{s.name}</button>)}</div>
    <section className="guardian-safety-summary"><div><span>등록 제품</span><strong>{visibleProducts.length}개</strong></div><div className={recallCount ? 'danger' : ''}><span>리콜 확인 필요</span><strong>{recallCount}개</strong></div><div className={uncheckedCount ? 'warning' : ''}><span>생활안전 미점검</span><strong>{uncheckedCount}개</strong></div></section>
    {error && <p className="guardian-safety-page__error">{error}</p>}
    <section className="guardian-safety-section"><div className="guardian-safety-section__heading"><div><h2>등록 제품</h2><p>제품별 리콜 여부와 현재 사용 상태를 확인하세요.</p></div><span>{visibleProducts.length}개</span></div>
      {loading ? <div className="guardian-safety-empty">불러오는 중입니다.</div> : visibleProducts.length === 0 ? <div className="guardian-safety-empty">등록된 제품이 없습니다.</div> : <div className="guardian-product-grid">{visibleProducts.map(product => <article className={`guardian-product-card ${product.recallStatus === 'RECALLED' ? 'danger' : ''}`} key={product.id}><div className="guardian-product-card__top"><div><span>{product.productType || '제품 종류 미등록'}</span><h3>{product.productName}</h3><p>{product.seniorName} 어르신</p></div><b>{product.recallStatus === 'RECALLED' ? '리콜 대상' : product.recallStatus === 'SAFE' ? '안전 확인' : '확인 필요'}</b></div><dl><div><dt>제조사</dt><dd>{product.manufacturer || '-'}</dd></div><div><dt>모델번호</dt><dd>{product.modelNumber || '-'}</dd></div><div><dt>사용 상태</dt><dd>{USE_LABEL[product.currentUseStatus] || '확인 필요'}</dd></div><div><dt>마지막 확인</dt><dd>{formatDate(product.lastCheckedAt)}</dd></div></dl>{product.recallStatus === 'RECALLED' && <div className="guardian-product-card__alert"><strong>리콜 대상 제품입니다.</strong><span>{product.currentUseStatus === 'IN_USE' ? '현재 사용 중이므로 즉시 사용을 중지해 주세요.' : '사용 중지 또는 후속 조치 상태를 확인해 주세요.'}</span></div>}<div className="guardian-product-card__actions"><button onClick={() => setDetail(product)}>리콜 상세</button>{product.currentUseStatus === 'IN_USE' ? <button className="primary" onClick={() => changeUse(product, 'STOPPED')}>사용 중지</button> : <button onClick={() => changeUse(product, 'DISPOSED')}>폐기 완료</button>}<button className="delete" onClick={() => removeProduct(product)}>삭제</button></div></article>)}</div>}
    </section>
    <section className="guardian-safety-section"><div className="guardian-safety-section__heading"><div><h2>생활안전 점검</h2><p>어르신별 안전 항목의 최근 점검 상태를 관리합니다.</p></div></div><div className="guardian-check-list">{CHECKS.map(check => { const record = latestChecks[check.type]; return <button key={check.type} onClick={() => setCheckDetail({ check, record })}><span><i className={record ? record.status.toLowerCase() : 'unchecked'} />{check.label}</span><strong>{record ? CHECK_STATUS[record.status] || '점검 필요' : '미점검'}</strong><small>{record ? formatDate(record.updatedAt || record.createdAt) : '점검 기록 없음'}</small></button>; })}</div></section>
    {registerOpen && <div className="guardian-safety-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setRegisterOpen(false)}><form className="guardian-safety-modal" onSubmit={submitProduct}><header><h2>제품 직접 등록</h2><button type="button" onClick={() => setRegisterOpen(false)}>×</button></header><label>어르신<select required value={form.seniorId} onChange={e => setForm({ ...form, seniorId: e.target.value })}><option value="">선택</option>{seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>제품 종류<input required value={form.productType} onChange={e => setForm({ ...form, productType: e.target.value })} /></label><label>제품명<input required value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} /></label><label>제조사<input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></label><label>모델번호<input value={form.modelNumber} onChange={e => setForm({ ...form, modelNumber: e.target.value })} /></label><label>현재 사용 여부<select value={form.currentUseStatus} onChange={e => setForm({ ...form, currentUseStatus: e.target.value })}><option value="IN_USE">사용 중</option><option value="STOPPED">사용 중지</option><option value="DISPOSED">폐기 완료</option><option value="UNKNOWN">확인 필요</option></select></label><button className="submit">등록하기</button></form></div>}
    {detail && <div className="guardian-safety-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}><section className="guardian-safety-modal"><header><h2>리콜 상세</h2><button onClick={() => setDetail(null)}>×</button></header><h3>{detail.productName}</h3><p className="detail-copy">{detail.recallReason || (detail.recallStatus === 'RECALLED' ? '리콜 대상 제품입니다. 제조사 안내에 따라 사용을 중지하고 교환·수리·환불 방법을 확인하세요.' : '등록된 리콜 상세 내용이 없습니다.')}</p><dl className="detail-list"><div><dt>제조사</dt><dd>{detail.manufacturer || '-'}</dd></div><div><dt>모델번호</dt><dd>{detail.modelNumber || '-'}</dd></div><div><dt>마지막 확인</dt><dd>{formatDate(detail.lastCheckedAt)}</dd></div></dl>{detail.currentUseStatus === 'IN_USE' && <button className="submit" onClick={async () => { await changeUse(detail, 'STOPPED'); setDetail(null); }}>사용 중지 처리</button>}</section></div>}
    {checkDetail && <div className="guardian-safety-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setCheckDetail(null)}><section className="guardian-safety-modal"><header><h2>{checkDetail.check.label}</h2><button onClick={() => setCheckDetail(null)}>×</button></header><dl className="detail-list"><div><dt>점검 상태</dt><dd>{checkDetail.record ? CHECK_STATUS[checkDetail.record.status] : '미점검'}</dd></div><div><dt>마지막 점검일</dt><dd>{formatDate(checkDetail.record?.updatedAt || checkDetail.record?.createdAt)}</dd></div><div><dt>점검한 사람</dt><dd>{checkDetail.record?.actionSubject === 'GUARDIAN' ? '보호자' : checkDetail.record?.actionSubject === 'WELFARE_WORKER' ? '복지사' : '-'}</dd></div><div><dt>특이사항</dt><dd>{checkDetail.record?.note || '기록 없음'}</dd></div></dl><button className="submit" onClick={() => completeCheck(checkDetail.check)}>점검 완료 처리</button></section></div>}
  </main></GuardianLayout>;
}
