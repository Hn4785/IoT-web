import { useState } from "react";
import Button from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { dataSourceService, type DataSource } from "@/services/dataSourceService";
import { dataSourceDisplayName } from "@/utils/dataSourceDisplayName";
import { normalizeApiError } from "@/utils/apiError";
import styles from "./SourceNodeImport.module.css";

export interface SourceNodeImportProps {
  source: DataSource | null;
  newStationCodes: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSource: DataSource, importedCount: number) => void;
}

export default function SourceNodeImport({
  source,
  newStationCodes,
  isOpen,
  onClose,
  onSuccess,
}: SourceNodeImportProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isCapReached = selectedCodes.length >= 100;

  const toggleCode = (code: string) => {
    setSelectedCodes((current) => {
      if (current.includes(code)) {
        return current.filter((c) => c !== code);
      }
      if (current.length >= 100) {
        return current;
      }
      return [...current, code];
    });
  };

  const handleClose = () => {
    if (busy) return;
    setSelectedCodes([]);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!source || selectedCodes.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await dataSourceService.importStations(source.id, selectedCodes);
      setSelectedCodes([]);
      onSuccess(result.source, result.importedStationCodes.length);
      onClose();
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Review and Add Nodes${source ? ` — ${dataSourceDisplayName(source)}` : ""}`}
      description="Select discovered soil stations to add to your source. New stations are owned by you and are not shared automatically. Existing station permissions stay unchanged."
      size="md"
    >
      <div className={styles.summary}>
        <span>{selectedCodes.length} of {newStationCodes.length} selected (maximum 100)</span>
      </div>
      {isCapReached && (
        <p className={styles.limitNotice}>
          Maximum limit of 100 nodes reached. Uncheck selected nodes to choose others.
        </p>
      )}

      <div className={styles.codeList} role="group" aria-label="Discovered soil stations">
        {newStationCodes.map((code) => {
          const isChecked = selectedCodes.includes(code);
          return (
            <label key={code} htmlFor={`import-node-${code}`} className={styles.codeItem}>
              <input
                id={`import-node-${code}`}
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleCode(code)}
                disabled={busy || (!isChecked && isCapReached)}
              />
              <span>{code}</span>
            </label>
          );
        })}
      </div>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button variant="outline" onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={busy}
          disabled={busy || selectedCodes.length === 0}
        >
          Add Selected Nodes
        </Button>
      </div>
    </Modal>
  );
}
