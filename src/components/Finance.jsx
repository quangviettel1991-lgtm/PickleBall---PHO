import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import PropTypes from 'prop-types';
import './Finance.css';
import Modal from './Modal';
import { localDate } from '../utils/dates.js';
import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Edit2, Search, Calendar, User, Tag, Check } from "lucide-react";
import { addTransaction, deleteTransaction, updateTransaction } from "../utils/db";

export default function Finance({ data, setData, isAdmin }) {
  const { members = [], transactions = [] } = data;

  // Trạng thái bộ lọc
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, income, expense
  const [filterCategory, setFilterCategory] = useState("all");

  // Trạng thái Form (Thêm/Sửa)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);

  const [txType, setTxType] = useState("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Khác");
  const [txDescription, setTxDescription] = useState("");
  const [txDate, setTxDate] = useState(localDate());
  const [txPerformedBy, setTxPerformedBy] = useState("");

  // Trạng thái thông báo thành công
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Danh mục chi tiêu & thu nhập mặc định
  const categories = ["Đóng tiền quỹ", "Thuê sân", "Mua bóng", "Nước uống", "Giải thưởng", "Khác"];

  // Tính toán Tổng Thu, Tổng Chi, Số Dư
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === "income") {
        income += t.amount;
      } else if (t.type === "expense") {
        expense += t.amount;
      }
    });
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [transactions]);

  // Bộ lọc các giao dịch
  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Mới nhất lên trước
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (t.performedBy || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                              t.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === "all" || t.type === filterType;
        const matchesCategory = filterCategory === "all" || t.category === filterCategory;
        return matchesSearch && matchesType && matchesCategory;
      });
  }, [transactions, searchQuery, filterType, filterCategory]);

  const handleOpenAddForm = () => {
    setEditingTxId(null);
    setTxType("expense");
    setTxAmount("");
    setTxCategory("Khác");
    setTxDescription("");
    setTxDate(localDate());
    setTxPerformedBy("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tx) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxAmount(tx.amount.toString());
    setTxCategory(tx.category);
    setTxDescription(tx.description);
    setTxDate(tx.date);
    setTxPerformedBy(tx.performedBy || "");
    setIsFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) return;

    const txData = {
      type: txType,
      amount: Number(txAmount),
      category: txCategory,
      description: txDescription,
      date: txDate,
      performedBy: txPerformedBy
    };

    let updatedData;
    if (editingTxId) {
      updatedData = updateTransaction({ id: editingTxId, ...txData });
      triggerSuccess("Đã cập nhật giao dịch thành công!");
    } else {
      updatedData = addTransaction(txData);
      triggerSuccess("Đã thêm giao dịch quỹ thành công!");
    }

    setData(updatedData);
    setIsFormOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Anh có chắc chắn muốn xóa giao dịch này không?")) {
      const updatedData = deleteTransaction(id);
      setData(updatedData);
      triggerSuccess("Đã xóa giao dịch quỹ thành công!");
    }
  };

  const triggerSuccess = (msg) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  // Cuộn thông minh khi focus vào input trên di động
  const handleInputFocus = (e) => {
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  };

  const pager = usePagination(filteredTransactions, `${searchQuery}|${filterType}|${filterCategory}`);
  return (
    <div className="finance-container animate-fade-in">
      <Pagination pager={pager} />


      {/* Success Notification */}
      {showSuccess && (
        <div className="success-toast animate-slide-up">
          <Check size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="finance-header">
        <h1 className="finance-title">Quỹ Câu Lạc Bộ <span>Thu Chi</span></h1>
        {isAdmin && (
          <button className="btn-neon-green btn-add-tx" onClick={handleOpenAddForm}>
            <Plus size={16} /> Ghi khoản mới
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="finance-stats-grid">
        {/* Số Dư Hiện Tại */}
        <div className="glass-panel finance-stat-card glow-border-green">
          <div className="finance-stat-icon-wrapper icon-balance">
            <DollarSign size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label-light">Số dư hiện tại</span>
            <span className="stat-value-large value-balance">{formatCurrency(totals.balance)}</span>
          </div>
        </div>

        {/* Tổng Thu */}
        <div className="glass-panel finance-stat-card">
          <div className="finance-stat-icon-wrapper icon-income">
            <TrendingUp size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label-light">Tổng khoản thu</span>
            <span className="stat-value-large value-income">{formatCurrency(totals.income)}</span>
          </div>
        </div>

        {/* Tổng Chi */}
        <div className="glass-panel finance-stat-card">
          <div className="finance-stat-icon-wrapper icon-expense">
            <TrendingDown size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label-light">Tổng khoản chi</span>
            <span className="stat-value-large value-expense">{formatCurrency(totals.expense)}</span>
          </div>
        </div>
      </div>

      {/* Search & Filtering Panel */}
      <div className="glass-panel finance-ops-panel">
        <div className="finance-filters">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input aria-label="Tìm kiếm"
              type="text"
              className="form-input"
              placeholder="Tìm kiếm nội dung, người chi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select aria-label="Lọc theo loại giao dịch"
            className="form-select filter-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">Tất cả giao dịch</option>
            <option value="income">Các khoản thu (+)</option>
            <option value="expense">Các khoản chi (-)</option>
          </select>

          <select aria-label="Lọc theo danh mục"
            className="form-select filter-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table for PC */}
      <div className="glass-panel finance-table-wrapper">
        {filteredTransactions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>Không tìm thấy giao dịch nào phù hợp.</p>
        ) : (
          <table className="finance-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Ngày</th>
                <th style={{ width: "140px" }}>Loại quỹ</th>
                <th style={{ width: "160px" }}>Danh mục</th>
                <th>Nội dung giao dịch</th>
                <th style={{ width: "180px" }}>Người thực hiện</th>
                <th style={{ width: "180px", textAlign: "right" }}>Số tiền</th>
                {isAdmin && <th style={{ width: "120px", textAlign: "center" }}>Hành động</th>}
              </tr>
            </thead>
            <tbody>
              {pager.items.map(tx => (
                <tr key={tx.id}>
                  <td>{tx.date}</td>
                  <td>
                    <span className={`tx-badge ${tx.type === "income" ? "tx-badge-income" : "tx-badge-expense"}`}>
                      {tx.type === "income" ? "Thu nhập" : "Chi phí"}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "var(--accent-electric-blue)", fontWeight: "600" }}>{tx.category}</span>
                  </td>
                  <td style={{ fontWeight: "600", color: "#fff" }}>{tx.description}</td>
                  <td>{tx.performedBy || <span style={{ color: "var(--text-muted)" }}>N/A</span>}</td>
                  <td className="tx-amount-text" style={{ textAlign: "right" }}>
                    <span className={tx.type === "income" ? "tx-amount-income" : "tx-amount-expense"}>
                      {tx.type === "income" ? "+" : "-"} {formatCurrency(tx.amount)}
                    </span>
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: "center" }}>
                      <button className="action-icon-btn" onClick={() => handleOpenEditForm(tx)} title="Sửa giao dịch">
                        <Edit2 size={14} />
                      </button>
                      <button className="action-icon-btn btn-delete-tx" onClick={() => handleDelete(tx.id)} title="Xóa giao dịch">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cards List for Mobile */}
      <div className="finance-mobile-list">
        {filteredTransactions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>Không có giao dịch nào phù hợp.</p>
        ) : (
          pager.items.map(tx => (
            <div key={tx.id} className="glass-panel mobile-tx-card">
              <div className="mobile-tx-header">
                <div className="mobile-tx-title">{tx.description}</div>
                <span className={`tx-badge ${tx.type === "income" ? "tx-badge-income" : "tx-badge-expense"}`}>
                  {tx.type === "income" ? "Thu" : "Chi"}
                </span>
              </div>

              <div className="mobile-tx-details">
                <div className="mobile-tx-row">
                  <Calendar size={12} />
                  <span>Ngày: {tx.date}</span>
                </div>
                <div className="mobile-tx-row">
                  <Tag size={12} />
                  <span>Danh mục: <strong style={{ color: "var(--accent-electric-blue)" }}>{tx.category}</strong></span>
                </div>
                <div className="mobile-tx-row">
                  <User size={12} />
                  <span>Người thực hiện: <strong>{tx.performedBy || "Không rõ"}</strong></span>
                </div>
              </div>

              <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="stat-label-light">Số tiền:</span>
                <span className={`tx-amount-text ${tx.type === "income" ? "tx-amount-income" : "tx-amount-expense"}`} style={{ fontSize: "1.1rem" }}>
                  {tx.type === "income" ? "+" : "-"} {formatCurrency(tx.amount)}
                </span>
              </div>

              {isAdmin && (
                <div className="mobile-tx-actions">
                  <button className="action-icon-btn" onClick={() => handleOpenEditForm(tx)}>
                    <Edit2 size={13} /> Sửa
                  </button>
                  <button className="action-icon-btn btn-delete-tx" onClick={() => handleDelete(tx.id)}>
                    <Trash2 size={13} /> Xóa
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Floating Add/Edit Modal */}
      <Modal isOpen={isFormOpen} onClose={()=>setIsFormOpen(false)} title={editingTxId ? "Cập Nhật Giao Dịch" : "Ghi Nhận Giao Dịch"}>
            <form onSubmit={handleSubmit}>
              <div className="modal-form-grid">
                {/* Thu/Chi selector */}
                <div className="type-selector-tab">
                  <button
                    type="button"
                    className={`type-tab-btn ${txType === "income" ? "active-income" : ""}`}
                    onClick={() => {
                      setTxType("income");
                      if (txCategory === "Thuê sân" || txCategory === "Mua bóng" || txCategory === "Nước uống") {
                        setTxCategory("Khác");
                      }
                    }}
                  >
                    <TrendingUp size={16} /> Thu Nhập (+)
                  </button>
                  <button
                    type="button"
                    className={`type-tab-btn ${txType === "expense" ? "active-expense" : ""}`}
                    onClick={() => {
                      setTxType("expense");
                      if (txCategory === "Đóng tiền quỹ") {
                        setTxCategory("Khác");
                      }
                    }}
                  >
                    <TrendingDown size={16} /> Chi Phí (-)
                  </button>
                </div>

                {/* Số tiền */}
                <div className="form-group">
                  <label className="form-label">Số tiền (VNĐ) <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <div style={{ position: "relative" }}>
                    <input aria-label="Số tiền (VNĐ)"
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="form-input"
                      placeholder="Ví dụ: 100000"
                      required
                      min="1"
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      onFocus={handleInputFocus}
                    />
                    {txAmount && (
                      <span
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: "0.82rem",
                          fontWeight: "700",
                          color: txType === "income" ? "var(--color-success)" : "var(--color-danger)"
                        }}
                      >
                        {formatCurrency(txAmount)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Danh mục */}
                <div className="form-group">
                  <label className="form-label">Danh mục quỹ</label>
                  <select aria-label="Danh mục"
                    className="form-select"
                    value={txCategory}
                    onChange={e => setTxCategory(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Ngày giao dịch */}
                <div className="form-group">
                  <label className="form-label">Ngày giao dịch</label>
                  <input aria-label="Ngày giao dịch"
                    type="date"
                    className="form-input"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                  />
                </div>

                {/* Người thực hiện */}
                <div className="form-group">
                  <label className="form-label">Người thực hiện</label>
                  <div style={{ position: "relative" }}>
                    <input aria-label="Người thực hiện"
                      type="text"
                      className="form-input"
                      placeholder="Tên thành viên hoặc đối tác..."
                      value={txPerformedBy}
                      onChange={e => setTxPerformedBy(e.target.value)}
                      onFocus={handleInputFocus}
                      list="members-datalist"
                    />
                    {/* Datalist gợi ý từ thành viên CLB */}
                    <datalist id="members-datalist">
                      {members.map(m => (
                        <option key={m.id} value={m.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Nội dung chi tiết */}
                <div className="form-group">
                  <label className="form-label">Nội dung chi tiết</label>
                  <textarea aria-label="Nội dung giao dịch"
                    className="form-input"
                    style={{ minHeight: "80px", resize: "vertical" }}
                    placeholder="Mô tả cụ thể giao dịch..."
                    value={txDescription}
                    onChange={e => setTxDescription(e.target.value)}
                    onFocus={handleInputFocus}
                  />
                </div>
              </div>

              <div className="modal-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn-neon-green">Xác nhận</button>
              </div>
            </form>
      </Modal>
    </div>
  );
}

Finance.propTypes = {
  data: PropTypes.object,
  setData: PropTypes.func,
  isAdmin: PropTypes.bool,
};
