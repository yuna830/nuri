function AdminPagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div className="admin-pagination" aria-label="페이지 이동">
      <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        이전
      </button>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          className={page === pageNumber ? "active" : ""}
          onClick={() => onPageChange(pageNumber)}
        >
          {pageNumber}
        </button>
      ))}
      <button type="button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
        다음
      </button>
    </div>
  );
}

export default AdminPagination;
