import api from './index';

export const searchAddresses = (query) =>
  api.get(`/addresses/search?query=${encodeURIComponent(query)}`);
