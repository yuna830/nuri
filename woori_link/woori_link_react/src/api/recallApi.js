import api from './index';
import {
  getToken,
} from '../utils/auth.js';


const authConfig = () => {
  const token =
    getToken();

  return token
    ? {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
    : {};
};


export const getRecalledProducts = () =>
  api.get(
    '/products/recalled',
    authConfig(),
  );


export const getRecalledProductsByWelfareWorker = (
  id,
) =>
  api.get(
    `/products/recalled/welfare-worker/${id}`,
    authConfig(),
  );


export const getProductsBySenior = (
  seniorId,
) =>
  api.get(
    `/products/senior/${seniorId}`,
    authConfig(),
  );


export const registerProduct = (
  data,
) =>
  api.post(
    '/products',
    data,
    authConfig(),
  );


export const refreshRecall = () =>
  api.post(
    '/products/refresh',
    null,
    authConfig(),
  );


export const updateCurrentUseStatus = (
  id,
  status,
) =>
  api.patch(
    `/products/${id}/current-use`,
    null,
    {
      ...authConfig(),

      params: {
        status,
      },
    },
  );


export const updateProductSenior = (
  id,
  seniorId,
) =>
  api.patch(
    `/products/${id}/senior`,
    {
      seniorId,
    },
    authConfig(),
  );


export const updateRecallWorkflow = (
  id,
  data,
) =>
  api.patch(
    `/products/${id}/workflow`,
    data,
    authConfig(),
  );


export const deleteProduct = (
  id,
) =>
  api.delete(
    `/products/${id}`,
    authConfig(),
  );


export const sendRecallNotification = (
  id,
  data,
) =>
  api.post(
    `/products/${id}/notifications`,
    data,
    authConfig(),
  );