import type { SavedSessionSummary } from '../hooks/useSessionPersistence';
import buttons from '../styles/buttons.module.css';
import styles from './SessionPicker.module.css';

interface SessionPickerProps {
  sessionName: string;
  onSessionNameChange: (name: string) => void;
  savedSessions: SavedSessionSummary[];
  onSave: () => void;
  onLoad: (id: string) => void;
  onNew: () => void;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

function SessionPicker({
  sessionName,
  onSessionNameChange,
  savedSessions,
  onSave,
  onLoad,
  onNew,
  isSaving,
  isLoading,
  error,
}: SessionPickerProps) {
  const busy = isSaving || isLoading;

  return (
    <div className={styles.picker}>
      <input
        className={styles.name}
        value={sessionName}
        onChange={(event) => onSessionNameChange(event.target.value)}
        placeholder="Session name"
      />
      <button type="button" className={buttons.pill} onClick={onSave} disabled={busy}>
        {isSaving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className={buttons.pillOutline} onClick={onNew} disabled={busy}>
        New session
      </button>
      {savedSessions.length > 0 && (
        <select
          className={styles.select}
          value=""
          onChange={(event) => {
            if (event.target.value) onLoad(event.target.value);
          }}
          disabled={busy}
        >
          <option value="" disabled>
            {isLoading ? 'Loading…' : 'Load a saved session…'}
          </option>
          {savedSessions.map((saved) => (
            <option key={saved.id} value={saved.id}>
              {saved.name} — {new Date(saved.updatedAt).toLocaleDateString()}
            </option>
          ))}
        </select>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export default SessionPicker;
