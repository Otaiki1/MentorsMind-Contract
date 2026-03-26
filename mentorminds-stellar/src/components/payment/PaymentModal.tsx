import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  simulateTransaction,
  type SimulationResult,
} from "../../../../packages/contracts-sdk/src/simulate";

type PaymentModalProps = {
  isOpen: boolean;
  operationXdr: string;
  account: string;
  rpcEndpoint: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatFee(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toFixed(7)} XLM`;
}

export default function PaymentModal({
  isOpen,
  operationXdr,
  account,
  rpcEndpoint,
  onCancel,
  onConfirm,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function runSimulation() {
      if (!isOpen || !operationXdr || !rpcEndpoint) {
        return;
      }

      setLoading(true);
      setError(null);

      const simulation = await simulateTransaction(operationXdr, account, {
        endpoint: rpcEndpoint,
      });

      if (!active) return;

      setResult(simulation);
      if (!simulation.success) {
        setError(simulation.error ?? "Simulation failed");
      }
      setLoading(false);
    }

    runSimulation();

    return () => {
      active = false;
    };
  }, [isOpen, operationXdr, account, rpcEndpoint]);

  const canConfirm = useMemo(() => {
    return Boolean(result?.success) && !loading;
  }, [result, loading]);

  if (!isOpen) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" style={styles.backdrop}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Confirm Payment</h3>

        {loading && <p>Simulating transaction...</p>}

        {!loading && result && (
          <>
            <div style={styles.section}>
              <p>
                Estimated Fee: <strong>{formatFee(result.fee_estimate)}</strong>
              </p>
            </div>

            <div style={styles.section}>
              <p style={styles.subtitle}>State Preview</p>
              {result.state_changes.length === 0 ? (
                <p>No ledger state changes were reported.</p>
              ) : (
                <ul style={styles.list}>
                  {result.state_changes.map((change) => (
                    <li key={change.key}>
                      <strong>{change.type}</strong> {change.key}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {error && (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        )}

        <div style={styles.actions}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" disabled={!canConfirm} onClick={onConfirm}>
            Confirm & Sign
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
  },
  modal: {
    width: "min(560px, 92vw)",
    borderRadius: 12,
    background: "#ffffff",
    padding: 20,
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  title: {
    marginTop: 0,
    marginBottom: 8,
  },
  subtitle: {
    margin: 0,
    fontWeight: 600,
  },
  section: {
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    background: "#f7f9fc",
  },
  list: {
    marginTop: 8,
    marginBottom: 0,
    paddingLeft: 20,
  },
  actions: {
    marginTop: 18,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  error: {
    color: "#b00020",
    marginTop: 10,
  },
};
