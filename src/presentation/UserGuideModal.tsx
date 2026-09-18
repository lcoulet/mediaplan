// UserGuideModal.tsx — Affiche la documentation utilisateur inline

import { useEffect, useState } from 'react';

interface UserGuideModalProps {
  onClose: () => void;
}

export default function UserGuideModal({ onClose }: UserGuideModalProps) {
  const [content, setContent] = useState<string>('Chargement...');

  useEffect(() => {
    fetch('/docs/user-guide.md')
      .then((res) => res.text())
      .then(setContent)
      .catch(() => setContent('Erreur de chargement de la documentation.'));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Documentation utilisateur</h2>
        <div className="user-guide-content">
          <pre>{content}</pre>
        </div>
      </div>
    </div>
  );
}
