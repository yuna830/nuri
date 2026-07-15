import { useEffect, useState } from 'react'
import { getRecalledProducts, refreshRecall, updateCurrentUseStatus } from '../../api/recallApi'
import '../../css/welfare/RecallList.css'

const USE_STATUS_LABEL = {
  UNKNOWN: '미확인',
  IN_USE: '현재 사용 중',
  NOT_IN_USE: '보유 중이나 사용하지 않음',
  STOPPED: '사용 중단 완료',
  NOT_OWNED: '보유하지 않음',
  INVALID_REGISTRATION: '잘못 등록됨',
}

const ACTION_STATUS_LABEL = {
  CONFIRMATION_NEEDED: '확인 필요',
  CONTACT_SCHEDULED: '연락 예정',
  STOP_GUIDANCE_COMPLETED: '사용 중단 안내 완료',
  RECALL_GUIDANCE_COMPLETED: '회수·교환 안내 완료',
  RECALL_IN_PROGRESS: '회수·교환 진행 중',
  COMPLETED: '조치 완료',
  UNREACHABLE: '연락 불가',
  NOT_RECALLED: '리콜 대상 아님',
}

function valueOrFallback(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : value
}

function formatDate(value) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

function modelMatchLabel(product) {
  const value = product.modelMatched ?? product.modelNumberMatched ?? product.modelMatch
  if (value === true) return '일치'
  if (value === false) return '불일치'
  return '미확인'
}

export default function RecallList() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const response = await getRecalledProducts().catch(() => ({ data: [] }))
    setProducts(Array.isArray(response.data) ? response.data : [])
  }

  async function handleRefresh() {
    setLoading(true)
    try {
      await refreshRecall()
      await load()
    } finally {
      setLoading(false)
    }
  }

  function openModal(product) {
    setSelected(product)
    setForm({
      currentUseStatus: product.currentUseStatus || 'UNKNOWN',
      actionStatus: product.actionStatus || 'CONFIRMATION_NEEDED',
      contactMethod: product.contactMethod || '',
      guardianContacted: product.guardianContacted ?? '',
      nextActionDate: product.nextActionDate || '',
      note: product.note || '',
    })
  }

  async function changeUseStatus(status) {
    setForm(previous => ({ ...previous, currentUseStatus: status }))
    try {
      await updateCurrentUseStatus(selected.id, status)
      setSelected(previous => ({ ...previous, currentUseStatus: status }))
      await load()
    } catch {
      setForm(previous => ({ ...previous, currentUseStatus: selected.currentUseStatus || 'UNKNOWN' }))
      alert('제품 사용 여부를 변경하지 못했습니다.')
    }
  }

  function handleActionSave(event) {
    event.preventDefault()
    // TODO: 리콜 조치 상태, 상담 방법, 보호자 연락 여부, 다음 조치일, 메모 저장 API 연결 필요
  }

  return (
    <div>
      <div className="recall-page-header">
        <h1 className="page-title">리콜 제품 확인 대상</h1>
        <button className="btn-primary" onClick={handleRefresh} disabled={loading}>
          {loading ? '업데이트 중...' : '리콜 정보 업데이트'}
        </button>
      </div>

      <div className="card recall-card">
        {products.length === 0 ? (
          <div className="recall-empty-state">
            <strong>현재 확인이 필요한 리콜 제품이 없습니다.</strong>
            <p>어르신이 등록한 제품은 최신 리콜 정보와 자동으로 비교됩니다.</p>
            <p>새로운 리콜 대상이 확인되면 이 목록에 표시됩니다.</p>
          </div>
        ) : (
          <table className="data-table recall-table">
            <thead>
              <tr>
                <th>어르신</th><th>제품 정보</th><th>위해 유형</th><th>사용 여부</th><th>조치 상태</th><th>발견일</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const useStatus = product.currentUseStatus || 'UNKNOWN'
                const actionStatus = product.actionStatus || 'CONFIRMATION_NEEDED'
                return (
                  <tr key={product.id}>
                    <td className="font-bold">{valueOrFallback(product.seniorName, '미확인')}</td>
                    <td>
                      <strong>{valueOrFallback(product.productName)}</strong>
                      <span className="recall-product-model"> · {valueOrFallback(product.modelNumber, '미확인')}</span>
                    </td>
                    <td>{valueOrFallback(product.hazardType ?? product.recallHazardType, '미확인')}</td>
                    <td><span className="recall-state-badge">{USE_STATUS_LABEL[useStatus] || '미확인'}</span></td>
                    <td><span className="recall-state-badge">{ACTION_STATUS_LABEL[actionStatus] || '미확인'}</span></td>
                    <td>{formatDate(product.discoveredAt ?? product.recallDiscoveredAt)}</td>
                    <td>
                      <button className="btn-primary recall-manage-btn" onClick={() => openModal(product)}>
                        {useStatus === 'UNKNOWN' ? '제품 확인' : '조치 관리'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="recall-modal-overlay" onClick={() => setSelected(null)}>
          <form className="recall-modal" onSubmit={handleActionSave} onClick={event => event.stopPropagation()}>
            <div className="recall-modal-header">
              <div>
                <h2>{valueOrFallback(selected.seniorName, '어르신 미확인')} · {valueOrFallback(selected.seniorAge, '-')}세</h2>
                <p>리콜 제품 확인 및 조치 관리</p>
              </div>
              <button type="button" className="recall-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <section className="recall-information">
              <h3>리콜 제품 정보</h3>
              <dl>
                <div><dt>제품명</dt><dd>{valueOrFallback(selected.productName)}</dd></div>
                <div><dt>제조사</dt><dd>{valueOrFallback(selected.manufacturer)}</dd></div>
                <div><dt>모델명</dt><dd>{valueOrFallback(selected.modelNumber, '미확인')}</dd></div>
                <div><dt>등록 또는 OCR 정보</dt><dd>{valueOrFallback(selected.ocrInfo ?? selected.registrationSource ?? selected.ocrText, '미확인')}</dd></div>
                <div><dt>리콜 사유</dt><dd>{valueOrFallback(selected.recallReason, '미확인')}</dd></div>
                <div><dt>조치 방법</dt><dd>{valueOrFallback(selected.remedy ?? selected.actionMethod, '미확인')}</dd></div>
                <div><dt>공표 기관</dt><dd>{valueOrFallback(selected.announcingAgency ?? selected.recallAgency, '미확인')}</dd></div>
                <div><dt>모델명 일치 여부</dt><dd>{modelMatchLabel(selected)}</dd></div>
              </dl>
            </section>

            <div className="recall-form-grid">
              <label>
                제품 사용 여부
                <select value={form.currentUseStatus} onChange={event => changeUseStatus(event.target.value)}>
                  <option value="UNKNOWN">미확인</option>
                  <option value="IN_USE">현재 사용 중</option>
                  <option value="NOT_IN_USE">보유 중이나 사용하지 않음</option>
                  <option value="STOPPED">사용 중단 완료</option>
                  <option value="NOT_OWNED">보유하지 않음</option>
                  <option value="INVALID_REGISTRATION">잘못 등록됨</option>
                </select>
              </label>
              <label>
                조치 상태
                <select value={form.actionStatus} onChange={event => setForm(previous => ({ ...previous, actionStatus: event.target.value }))}>
                  {Object.entries(ACTION_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                상담 방법
                <select value={form.contactMethod} onChange={event => setForm(previous => ({ ...previous, contactMethod: event.target.value }))}>
                  <option value="">선택</option><option value="전화">전화</option><option value="방문">방문</option><option value="대면 상담">대면 상담</option><option value="보호자 연락">보호자 연락</option><option value="문자">문자</option><option value="기타">기타</option>
                </select>
              </label>
              <label>
                보호자 연락 여부
                <select value={form.guardianContacted} onChange={event => setForm(previous => ({ ...previous, guardianContacted: event.target.value }))}>
                  <option value="">미확인</option><option value="true">연락 완료</option><option value="false">연락하지 않음</option>
                </select>
              </label>
              <label>
                다음 조치일
                <input type="date" value={form.nextActionDate} onChange={event => setForm(previous => ({ ...previous, nextActionDate: event.target.value }))} />
              </label>
              <label className="recall-note-field">
                담당자 메모
                <textarea value={form.note} onChange={event => setForm(previous => ({ ...previous, note: event.target.value }))} placeholder="확인 및 조치 내용을 기록하세요" />
              </label>
            </div>

            <div className="recall-save-notice">조치 기록 저장 API 연결이 필요합니다.</div>
            <div className="recall-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setSelected(null)}>닫기</button>
              <button type="submit" className="btn-primary" disabled title="조치 기록 저장 API 연결 필요">조치 기록 저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
