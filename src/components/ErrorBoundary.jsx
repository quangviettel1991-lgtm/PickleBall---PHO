import PropTypes from 'prop-types';
import { Component } from 'react';
import { downloadJson, recoveryBundle } from '../utils/storage.js';
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="recovery-panel" role="alert">
      <h1>Chưa mở được màn hình</h1><p>Dữ liệu trên máy vẫn được giữ nguyên. Hãy tải bản cứu hộ trước khi thử lại.</p>
      <button className="btn-neon-green" onClick={() => downloadJson(recoveryBundle(), 'pickleball-recovery.json')}>Tải bản cứu hộ</button>
      <button className="btn-secondary" onClick={() => location.reload()}>Tải lại trang</button>
    </main>;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
};
