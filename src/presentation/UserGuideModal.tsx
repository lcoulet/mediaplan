// UserGuideModal.tsx — Affiche la documentation utilisateur via iframe

interface UserGuideModalProps {
  onClose: () => void;
}

export default function UserGuideModal({ onClose }: UserGuideModalProps) {
  console.log('UserGuideModal rendered');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Documentation utilisateur</h2>
        <div className="user-guide-iframe-wrapper">
          <iframe
            src="/user-guide.html"
            title="Documentation utilisateur MediaPlan"
            className="user-guide-iframe"
          />
        </div>
      </div>
    </div>
  );
}
