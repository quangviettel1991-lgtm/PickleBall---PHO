import PropTypes from 'prop-types';
import './Modal.css';
import { useEffect, useRef, useId, useState } from "react";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, title, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [localError, setLocalError] = useState('');
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    if (!isOpen || !node) return;
    setLocalError('');
    const failed = event => setLocalError(event.error?.message || 'Thao tác chưa hoàn tất. Dữ liệu cũ được giữ lại.');
    window.addEventListener('error', failed);
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    return () => { window.removeEventListener('error', failed); node.close(); document.body.style.overflow = overflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialog} className="modal-backdrop" aria-modal="true" aria-labelledby={titleId} onCancel={e=>{ e.preventDefault(); close.current(); }}>


      <div className="modal-wrapper" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">{title}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng hộp thoại">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" onChangeCapture={()=>setLocalError('')}>
          {localError && <p className="operation-error" role="alert">{localError}</p>}
          {children}
        </div>
      </div>
    </dialog>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
};
