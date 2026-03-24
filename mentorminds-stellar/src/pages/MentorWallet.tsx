'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PayoutRequest from '../components/wallet/PayoutRequest';
import {
  AssetCode,
  Balance,
  TransactionItem,
  connectActivityStream,
  exportTransactionsCsv,
  fetchAccountBalances,
  fetchTransactions,
  getEarningsSummary,
  streamPayments,
} from '../services/mentor-wallet.service';

function useEnvWallet() {
  const env = process.env.NEXT_PUBLIC_MENTOR_WALLET_ADDRESS;
  const [addr, setAddr] = useState(env ?? '');
  return [addr, setAddr] as const;
}

export default function MentorWallet() {
  const [address, setAddress] = useEnvWallet();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [txs, setTxs] = useState<TransactionItem[]>([]);
  const [filters, setFilters] = useState<{ asset?: AssetCode; start?: string; end?: string; min?: string; max?: string }>({});
  const [loadingTx, setLoadingTx] = useState(false);
  const [earnings, setEarnings] = useState<{ pending: Record<string, string>; confirmed: Record<string, string> }>({ pending: {}, confirmed: {} });
  const [notifications, setNotifications] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const stopStreamsRef = useRef<(() => void)[]>([]);

  const totalUsd = useMemo(() => {
    const byAsset = Object.fromEntries(balances.map(b => [b.asset, Number(b.amount)]));
    const xlmUsd = 0.1;
    return ((byAsset['USDC'] ?? 0) + (byAsset['PYUSD'] ?? 0) + (byAsset['XLM'] ?? 0) * xlmUsd).toFixed(2);
  }, [balances]);

  function addNotification(msg: string) {
    setNotifications(n => [msg, ...n].slice(0, 5));
  }

  async function loadBalances() {
    if (!address) return;
    setLoadingBalances(true);
    try {
      const b = await fetchAccountBalances(address);
      setBalances(b);
    } finally {
      setLoadingBalances(false);
    }
  }

  async function loadTx() {
    if (!address) return;
    setLoadingTx(true);
    try {
      let r = await fetchTransactions(address, {
        asset: filters.asset,
        startDate: filters.start,
        endDate: filters.end,
      });
      const min = filters.min ? Number(filters.min) : undefined;
      const max = filters.max ? Number(filters.max) : undefined;
      if (min != null || max != null) {
        r = r.filter(t => {
          const v = Number(t.amount);
          if (Number.isNaN(v)) return true;
          if (min != null && v < min) return false;
          if (max != null && v > max) return false;
          return true;
        });
      }
      setTxs(r);
    } finally {
      setLoadingTx(false);
    }
  }

  async function loadEarnings() {
    if (!address) return;
    const e = await getEarningsSummary(address);
    setEarnings(e);
  }

  function setupStreams() {
    stopStreamsRef.current.forEach(fn => fn());
    stopStreamsRef.current = [];
    if (!address) return;
    const stopPayments = streamPayments(address, ev => {
      addNotification('New on-chain activity detected');
      loadBalances();
      loadTx();
    });
    stopStreamsRef.current.push(stopPayments);
    const stopBackend = connectActivityStream(address, _ => {
      addNotification('Payment tracker update received');
      loadEarnings();
    });
    stopStreamsRef.current.push(stopBackend);
  }

  async function ensureQr() {
    if (!address) return setQrUrl(null);
    try {
      const mod = await import('qrcode').catch(() => null as any);
      if (mod && mod.toDataURL) {
        const dataUrl = await mod.toDataURL(address, { margin: 1, width: 200 });
        setQrUrl(dataUrl);
      } else {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`;
        setQrUrl(url);
      }
    } catch {
      setQrUrl(null);
    }
  }

  useEffect(() => {
    loadBalances();
    loadTx();
    loadEarnings();
    ensureQr();
    setupStreams();
    return () => {
      stopStreamsRef.current.forEach(fn => fn());
      stopStreamsRef.current = [];
    };
  }, [address, filters.asset, filters.start, filters.end]);

  function onExportCsv() {
    const csv = exportTransactionsCsv(txs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${address || 'wallet'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const byAsset = useMemo(() => {
    const map = new Map<AssetCode, string>([['XLM', '0'], ['USDC', '0'], ['PYUSD', '0']]);
    for (const b of balances) map.set(b.asset, b.amount);
    return map;
  }, [balances]);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <h2>Mentor Wallet</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={{ flex: 1 }}
          placeholder="Enter your Stellar public address"
          value={address}
          onChange={e => setAddress(e.target.value)}
        />
        <button onClick={() => { loadBalances(); loadTx(); loadEarnings(); ensureQr(); }}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div>Balance (XLM)</div>
          <div style={{ fontSize: 22 }}>{byAsset.get('XLM')}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div>Balance (USDC)</div>
          <div style={{ fontSize: 22 }}>{byAsset.get('USDC')}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div>Balance (PYUSD)</div>
          <div style={{ fontSize: 22 }}>{byAsset.get('PYUSD')}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div>Total USD (est.)</div>
          <div style={{ fontSize: 22 }}>${totalUsd}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select value={filters.asset ?? ''} onChange={e => setFilters(f => ({ ...f, asset: (e.target.value || undefined) as any }))}>
              <option value="">All assets</option>
              <option value="XLM">XLM</option>
              <option value="USDC">USDC</option>
              <option value="PYUSD">PYUSD</option>
            </select>
            <input type="date" value={filters.start ?? ''} onChange={e => setFilters(f => ({ ...f, start: e.target.value || undefined }))} />
            <input type="date" value={filters.end ?? ''} onChange={e => setFilters(f => ({ ...f, end: e.target.value || undefined }))} />
            <input type="number" step="any" placeholder="Min amt" value={filters.min ?? ''} onChange={e => setFilters(f => ({ ...f, min: e.target.value || undefined }))} />
            <input type="number" step="any" placeholder="Max amt" value={filters.max ?? ''} onChange={e => setFilters(f => ({ ...f, max: e.target.value || undefined }))} />
            <button onClick={onExportCsv} disabled={!txs.length}>Export CSV</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Date</th>
                  <th style={{ textAlign: 'left' }}>Type</th>
                  <th style={{ textAlign: 'left' }}>Amount</th>
                  <th style={{ textAlign: 'left' }}>Asset</th>
                  <th style={{ textAlign: 'left' }}>From</th>
                  <th style={{ textAlign: 'left' }}>To</th>
                  <th style={{ textAlign: 'left' }}>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                    <td>{t.type}</td>
                    <td>{t.amount}</td>
                    <td>{t.asset}</td>
                    <td>{t.from.slice(0, 6)}…{t.from.slice(-4)}</td>
                    <td>{t.to.slice(0, 6)}…{t.to.slice(-4)}</td>
                    <td>{t.txHash.slice(0, 8)}…</td>
                  </tr>
                ))}
                {!txs.length ? <tr><td colSpan={7} style={{ opacity: 0.7 }}>{loadingTx ? 'Loading…' : 'No transactions'}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ marginBottom: 8 }}>Wallet QR</div>
            {qrUrl ? <img src={qrUrl} alt="Wallet QR" width={200} height={200} /> : <div style={{ opacity: 0.7 }}>No address</div>}
            <div style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 8 }}>{address}</div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ marginBottom: 8 }}>Earnings</div>
            <div style={{ fontSize: 13 }}>
              <div>Pending: {Object.entries(earnings.pending).map(([k, v]) => `${k}: ${v}`).join('  ') || '—'}</div>
              <div>Completed: {Object.entries(earnings.confirmed).map(([k, v]) => `${k}: ${v}`).join('  ') || '—'}</div>
            </div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ marginBottom: 8 }}>Activity</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {notifications.map((n, i) => <div key={i} style={{ fontSize: 12, opacity: 0.9 }}>• {n}</div>)}
              {!notifications.length ? <div style={{ fontSize: 12, opacity: 0.7 }}>No recent activity</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Request Payout</h3>
        <PayoutRequest mentorAddress={address} />
      </div>
    </div>
  );
}
