import axios from 'axios';

import {
  DOCUMENT_AI_BASE_URL,
} from '../config/api.js';
import { prepareImageForUpload } from '../utils/imageCompression.js';


export const productDocumentAiEnabled =
  String(
    import.meta.env
      .VITE_PRODUCT_LABEL_OCR_ENABLED
    ?? import.meta.env
      .VITE_PRODUCT_DOCUMENT_AI_ENABLED
    ?? 'true',
  ).toLowerCase() === 'true';


const documentAiClient =
  axios.create({
    baseURL:
      DOCUMENT_AI_BASE_URL,

    timeout:
      60000,
  });


export async function analyzeProductLabel({
  image,
  seniorId,
}) {
  if (!image) {
    throw new Error(
      '분석할 제품 라벨 이미지가 필요합니다.',
    );
  }

  const numericSeniorId =
    Number(seniorId);

  if (
    !Number.isInteger(numericSeniorId)
    || numericSeniorId <= 0
  ) {
    throw new Error(
      '올바른 어르신 ID가 필요합니다.',
    );
  }

  const formData =
    new FormData();

  const uploadImage =
    await prepareImageForUpload(image);

  formData.append(
    'image',
    uploadImage,
    uploadImage.name || 'product-label.jpg',
  );

  formData.append(
    'source',
    'GUARDIAN_WEB',
  );

  formData.append(
    'seniorId',
    String(numericSeniorId),
  );

  return documentAiClient.post(
    '/document-ai/product-label/analyze',
    formData,
  );
}


export function confirmProductLabelAnalysis(
  analysisId,
  fields,
  registeredProductId,
) {
  if (
    !analysisId
    || String(analysisId).trim().length === 0
  ) {
    throw new Error(
      '분석 이력 ID가 필요합니다.',
    );
  }

  if (
    !fields
    || typeof fields !== 'object'
    || Array.isArray(fields)
  ) {
    throw new Error(
      '확정할 제품 정보가 필요합니다.',
    );
  }

  const normalizedProductId =
    registeredProductId === null
    || registeredProductId === undefined
    || registeredProductId === ''
      ? null
      : Number(registeredProductId);

  return documentAiClient.patch(
    `/document-ai/product-label/analyses/${encodeURIComponent(
      analysisId,
    )}/confirmation`,

    {
      fields,

      registeredProductId:
        normalizedProductId,
    },

    {
      timeout:
        10000,
    },
  );
}
