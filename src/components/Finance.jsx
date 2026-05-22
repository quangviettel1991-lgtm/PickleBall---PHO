import React, { useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Edit2, Search, X, Calendar, User, Tag, FileText, Check } from "lucide-react";
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
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
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
    setTxDate(new Date().toISOString().split("T")[0]);
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
      amount: parseInt(txAmount),
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

  return (
    <div className="finance-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .finance-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px;
        }

        .finance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .finance-title {
          font-size: 1.6rem;
          font-weight: 800;
          color: #fff;
        }

        .finance-title span {
          color: var(--accent-neon-green);
        }

        /* Stats Cards */
        .finance-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        .finance-stat-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          position: relative;
          overflow: hidden;
          transition: transform var(--transition-normal);
        }

        .finance-stat-card:hover {
          transform: translateY(-4px);
        }

        .finance-stat-icon-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-income {
          background: rgba(46, 213, 115, 0.1);
          color: var(--color-success);
          border: 1px solid rgba(46, 213, 115, 0.2);
        }

        .icon-expense {
          background: rgba(255, 71, 87, 0.1);
          color: var(--color-danger);
          border: 1px solid rgba(255, 71, 87, 0.2);
        }

        .icon-balance {
          background: rgba(0, 230, 118, 0.15);
          color: var(--accent-neon-green);
          border: 1px solid rgba(0, 230, 118, 0.3);
          box-shadow: 0 0 15px rgba(0, 230, 118, 0.1);
        }

        .stat-details {
          display: flex;
          flex-direction: column;
        }

        .stat-label-light {
          font-size: 0.82rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .stat-value-large {
          font-size: 1.6rem;
          font-weight: 800;
          color: #fff;
        }

        .value-income {
          color: var(--color-success);
        }

        .value-expense {
          color: var(--color-danger);
        }

        .value-balance {
          color: var(--accent-neon-green);
          text-shadow: 0 0 10px rgba(0, 230, 118, 0.2);
        }

        /* Filters & Operations */
        .finance-ops-panel {
          padding: 20px;
          margin-bottom: 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
        }

        .finance-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          flex-grow: 1;
        }

        .search-input-wrapper {
          position: relative;
          min-width: 260px;
        }

        .search-input-wrapper input {
          width: 100%;
          padding-left: 36px;
        }

        .search-input-wrapper svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .filter-select {
          min-width: 130px;
        }

        /* History Table */
        .finance-table-wrapper {
          overflow-x: auto;
          margin-bottom: 80px; /* Bớt khoảng trống dưới chân */
        }

        .finance-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .finance-table th {
          padding: 16px 20px;
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-color);
        }

        .finance-table td {
          padding: 16px 20px;
          font-size: 0.92rem;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          vertical-align: middle;
        }

        .finance-table tr:hover td {
          background: rgba(255, 255, 255, 0.01);
        }

        .tx-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.76rem;
          font-weight: 700;
        }

        .tx-badge-income {
          background: rgba(46, 213, 115, 0.1);
          color: var(--color-success);
        }

        .tx-badge-expense {
          background: rgba(255, 71, 87, 0.1);
          color: var(--color-danger);
        }

        .tx-amount-text {
          font-weight: 800;
        }

        .tx-amount-income {
          color: var(--color-success);
        }

        .tx-amount-expense {
          color: var(--color-danger);
        }

        .action-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 8px;
        }

        .action-icon-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .btn-delete-tx:hover {
          color: var(--color-danger);
          background: rgba(255, 71, 87, 0.1);
          border-color: rgba(255, 71, 87, 0.2);
        }

        /* Success Toast */
        .success-toast {
          position: fixed;
          top: 24px;
          right: 24px;
          background: rgba(46, 213, 115, 0.95);
          backdrop-filter: blur(8px);
          color: #000;
          font-weight: 700;
          padding: 12px 24px;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(46, 213, 115, 0.3);
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Overlay/Form Modal */
        .finance-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .finance-modal-card {
          width: 100%;
          max-width: 500px;
          padding: 28px;
          position: relative;
          margin: auto;
        }

        .modal-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        .modal-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .type-selector-tab {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 4px;
        }

        .type-tab-btn {
          padding: 10px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-weight: 700;
          font-size: 0.9rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .type-tab-btn.active-income {
          background: var(--color-success);
          color: #000;
        }

        .type-tab-btn.active-expense {
          background: var(--color-danger);
          color: #fff;
        }

        /* Mobile Transactions Cards */
        .finance-mobile-list {
          display: none;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 80px;
        }

        .mobile-tx-card {
          padding: 16px;
          position: relative;
        }

        .mobile-tx-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .mobile-tx-title {
          font-weight: 700;
          color: #fff;
          font-size: 0.96rem;
        }

        .mobile-tx-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .mobile-tx-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mobile-tx-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          padding-top: 10px;
        }

        /* Responsive Layouts */
        @media (max-width: 1024px) {
          .finance-stats-grid {
            gap: 16px;
          }
          .finance-stat-card {
            padding: 16px;
            gap: 12px;
          }
          .stat-value-large {
            font-size: 1.3rem;
          }
        }

        @media (max-width: 768px) {
          .finance-container {
            padding: 16px 12px;
          }
          .finance-stats-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .finance-ops-panel {
            flex-direction: column;
            align-items: stretch;
            padding: 12px;
          }
          .finance-filters {
            flex-direction: column;
          }
          .search-input-wrapper {
            min-width: 100%;
          }
          .filter-select {
            width: 100%;
          }
          .finance-table-wrapper {
            display: none;
          }
          .finance-mobile-list {
            display: flex;
          }
          .btn-add-tx {
            width: 100%;
            justify-content: center;
          }
          .finance-header {
            margin-bottom: 16px;
          }
          .finance-title {
            font-size: 1.3rem;
          }
        }
      `}} />

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
            <input 
              type="text" 
              className="form-input" 
              placeholder="Tìm kiếm nội dung, người chi..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="form-select filter-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">Tất cả giao dịch</option>
            <option value="income">Các khoản thu (+)</option>
            <option value="expense">Các khoản chi (-)</option>
          </select>

          <select 
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
              {filteredTransactions.map(tx => (
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
          filteredTransactions.map(tx => (
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
      {isFormOpen && (
        <div className="finance-modal-overlay">
          <div className="glass-panel finance-modal-card glow-border-green animate-slide-up">
            <button className="admin-modal-close" onClick={() => setIsFormOpen(false)} style={{ top: "18px", right: "18px" }}>
              <X size={18} />
            </button>
            <h3 className="finance-title" style={{ fontSize: "1.25rem", marginBottom: "20px" }}>
              {editingTxId ? "Cập Nhật Khoản Giao Dịch" : "Ghi Nhận Giao Dịch Mới"}
            </h3>

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
                    <input 
                      type="number" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="form-input" 
                      placeholder="Ví dụ: 100000" 
                      required
                      min="1"
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value.replace(/\D/g, ""))}
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
                  <select 
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
                  <input 
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
                    <input 
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
                  <textarea 
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
          </div>
        </div>
      )}
    </div>
  );
}
