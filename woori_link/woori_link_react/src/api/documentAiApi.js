import axios from 'axios';
import { DOCUMENT_AI_BASE_URL } from '../config/api.js';

export const productDocumentAiEnabled = (
  String(import.meta.env.VITE_PRODUCT_LABEL_OCR_ENABLED ?? import.meta.env.VITE_PRODUCT_DOCUMENT_AI_ENABLED ?? 'true').toLowerCase() === 'true'
);

export async function analyzeProductLabel({ image, seniorId }) {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('source', 'GUARDIAN_WEB');
  formData.append('seniorId', String(seniorId));
  return axios.post(
    `${DOCUMENT_AI_BASE_URL}/api/document-ai/product-label/analyze`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 },
  );
}

export const confirmProductLabelAnalysis = (analysisId, fields, registeredProductId) => (
  axios.patch(
    `${DOCUMENT_AI_BASE_URL}/api/document-ai/product-label/analyses/${analysisId}/confirmation`,
    { fields, registeredProductId },
    { timeout: 10000 },
  )
);
