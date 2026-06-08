export const ADMIN_PAGE_SIZE = 5;

const parseDateValue = (value) => {
  const time = Date.parse(value || "");
  return Number.isNaN(time) ? 0 : time;
};

export const getRecentSortValue = (item) => parseDateValue(item?.createdAt) || Number(item?.id) || 0;

export const sortRecentFirst = (items) =>
  [...items].sort((left, right) => getRecentSortValue(right) - getRecentSortValue(left));

export const getPageCount = (items, pageSize = ADMIN_PAGE_SIZE) =>
  Math.max(1, Math.ceil(items.length / pageSize));

export const paginateItems = (items, page, pageSize = ADMIN_PAGE_SIZE) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

const adminStatusPriority = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

export const sortAdminsByPendingFirst = (admins) =>
  [...admins].sort((left, right) => {
    const leftPriority = adminStatusPriority[left.status] ?? 9;
    const rightPriority = adminStatusPriority[right.status] ?? 9;

    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return getRecentSortValue(right) - getRecentSortValue(left);
  });
