import PropTypes from 'prop-types';
export default function Pagination({ pager }) {
  if (pager.pages < 2) return null;
  return <nav className="pagination" aria-label="Phân trang">
    <button className="btn-secondary" disabled={pager.page <= 1} onClick={()=>pager.setPage(pager.page - 1)}>Trang trước</button>
    <span>Trang {pager.page}/{pager.pages} · {pager.total} mục</span>
    <button className="btn-secondary" disabled={pager.page >= pager.pages} onClick={()=>pager.setPage(pager.page + 1)}>Trang sau</button>
  </nav>;
}
Pagination.propTypes = { pager: PropTypes.shape({ page: PropTypes.number.isRequired, pages: PropTypes.number.isRequired, total: PropTypes.number.isRequired, setPage: PropTypes.func.isRequired }).isRequired };
