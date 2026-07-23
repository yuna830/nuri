function text(value) {
  return String(value ?? '').trim()
}

export function recallRequestProductId(action) {
  return text(action?.note).match(/제품ID:\s*([^\n\r]+)/)?.[1]?.trim() || ''
}

export function recallRequestModelNumber(action) {
  return text(action?.note).match(/모델명:\s*([^\n\r]+)/)?.[1]?.trim() || ''
}

function recallRequestKey(action) {
  const productId = recallRequestProductId(action)
  if (productId) return `id:${productId}`

  const modelNumber = recallRequestModelNumber(action).toLowerCase()
  if (modelNumber) return `model:${modelNumber}`

  const productName = text(action?.productName).toLowerCase()
  return productName ? `name:${productName}` : ''
}

export function recallProductKey(product) {
  const productId = text(product?.id)
  if (productId) return `id:${productId}`

  const modelNumber = text(product?.modelNumber).toLowerCase()
  if (modelNumber) return `model:${modelNumber}`

  const productName = text(product?.productName).toLowerCase()
  return productName ? `name:${productName}` : ''
}

function recallProductKeys(product) {
  return [
    text(product?.id) && `id:${text(product.id)}`,
    text(product?.modelNumber) && `model:${text(product.modelNumber).toLowerCase()}`,
    text(product?.productName) && `name:${text(product.productName).toLowerCase()}`,
  ].filter(Boolean)
}

export function getRecallRequestActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .filter(action => action?.actionType === 'RECALL')
}

export function filterProductsByRecallRequests(products, actions) {
  const requestKeys = new Set(
    getRecallRequestActions(actions)
      .map(recallRequestKey)
      .filter(Boolean),
  )

  if (requestKeys.size === 0) return []

  return (Array.isArray(products) ? products : [])
    .filter(product => recallProductKeys(product).some(key => requestKeys.has(key)))
}
