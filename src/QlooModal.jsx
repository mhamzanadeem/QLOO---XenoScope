import { useEffect, useRef } from "react";
import { Info, LoaderCircle, RefreshCw, X } from "lucide-react";

export default function QlooModal({ message, retrying, onRetry, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (message && !dialog.current.open) dialog.current.showModal();
    if (!message && dialog.current.open) dialog.current.close();
  }, [message]);
  return (
    <dialog
      ref={dialog}
      className="qloo-modal"
      aria-labelledby="qloo-modal-title"
      aria-describedby="qloo-modal-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        className="icon-button modal-close"
        aria-label="Close Qloo availability dialog"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <div className="icon-box">
        <Info size={28} />
      </div>
      <p className="eyebrow">LIVE CONNECTION INTERRUPTED</p>
      <h2 id="qloo-modal-title">Qloo is currently unavailable</h2>
      <p id="qloo-modal-description">{message}</p>
      <p className="small-print">
        XenoScope uses Qloo data only. Your inputs are preserved. Once access is
        restored, retry your search or comparison.
      </p>
      <div className="actions">
        <button
          className="button primary"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}{" "}
          {retrying ? "Checking connection…" : "Retry connection"}
        </button>
        <button className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
