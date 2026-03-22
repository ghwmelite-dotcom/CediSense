import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Account, Category } from '@cedisense/shared';
import { getCSVFormats } from '@cedisense/shared';
import { api, ApiRequestError } from '@/lib/api';
import {
  ImportPreview,
  type CategorizedTransaction,
  type DuplicateEntry,
  type ImportRowState,
} from '@/components/transactions/ImportPreview';

// ─── Shapes returned by the import API ────────────────────────────────────────

interface ImportSmsResponse {
  import_id: string;
  parsed: CategorizedTransaction[];
  duplicates: DuplicateEntry[];
  total_received: number;
  total_parsed: number;
}

interface ImportCsvResponse {
  import_id: string;
  parsed: CategorizedTransaction[];
  duplicates: DuplicateEntry[];
  total_rows: number;
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-income/90 text-ghana-dark font-medium shadow-lg motion-safe:animate-slide-up">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="flex-1 text-sm">{message}</span>
      <button type="button" onClick={onClose} className="text-ghana-dark/50 hover:text-ghana-dark transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRowStates(
  parsed: CategorizedTransaction[],
  duplicates: DuplicateEntry[]
): ImportRowState[] {
  const dupSet = new Set(
    duplicates.map((d) => `${d.transaction.transaction_date}|${d.transaction.amount_pesewas}`)
  );

  return parsed.map((txn) => ({
    transaction: txn,
    skip: false,
    category_id: txn.category_id,
    isDuplicate: dupSet.has(`${txn.transaction_date}|${txn.amount_pesewas}`),
  }));
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ImportPage() {
  const navigate = useNavigate();
  const csvFileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'sms' | 'csv'>('sms');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Shared
  const [accountId, setAccountId] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRowState[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // SMS tab
  const [smsText, setSmsText] = useState('');

  // CSV tab
  const [csvFormat, setCsvFormat] = useState('mtn_momo');
  const [csvData, setCsvData] = useState('');
  const [csvFileName, setCsvFileName] = useState('');

  const csvFormats = getCSVFormats();

  // Load reference data
  useEffect(() => {
    Promise.all([
      api.get<Account[]>('/accounts'),
      api.get<Category[]>('/categories'),
    ]).then(([accs, cats]) => {
      setAccounts(accs);
      setCategories(cats);
      const primary = accs.find((a) => a.is_primary === 1);
      if (primary) setAccountId(primary.id);
    }).catch(() => {/* non-fatal */});
  }, []);

  // Reset preview when tab changes
  function switchTab(next: 'sms' | 'csv') {
    setTab(next);
    setBatchId(null);
    setRows([]);
    setDuplicates([]);
    setParseError(null);
  }

  // ── SMS parse ──────────────────────────────────────────────────────────────

  async function handleSmsParse() {
    if (!accountId) { setParseError('Please select an account first.'); return; }
    if (!smsText.trim()) { setParseError('Paste at least one SMS message.'); return; }

    setParseError(null);
    setParsing(true);
    setBatchId(null);
    setRows([]);

    const messages = smsText
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((body) => ({
        body,
        sender: 'Unknown',
        timestamp: new Date().toISOString(),
      }));

    try {
      const result = await api.post<ImportSmsResponse>('/import/sms', {
        messages,
        account_id: accountId,
      });
      setBatchId(result.import_id);
      setDuplicates(result.duplicates);
      setRows(buildRowStates(result.parsed, result.duplicates));
    } catch (err) {
      setParseError(
        err instanceof ApiRequestError ? err.message : 'Failed to parse SMS messages.'
      );
    } finally {
      setParsing(false);
    }
  }

  // ── CSV file pick ──────────────────────────────────────────────────────────

  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvData(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  // ── CSV parse ──────────────────────────────────────────────────────────────

  async function handleCsvParse() {
    if (!accountId) { setParseError('Please select an account first.'); return; }
    if (!csvData.trim()) { setParseError('Please upload a CSV file first.'); return; }

    setParseError(null);
    setParsing(true);
    setBatchId(null);
    setRows([]);

    try {
      const result = await api.post<ImportCsvResponse>('/import/csv', {
        account_id: accountId,
        format: csvFormat,
        csv_data: csvData,
      });
      setBatchId(result.import_id);
      setDuplicates(result.duplicates);
      setRows(buildRowStates(result.parsed, result.duplicates));
    } catch (err) {
      setParseError(
        err instanceof ApiRequestError ? err.message : 'Failed to parse CSV file.'
      );
    } finally {
      setParsing(false);
    }
  }

  // ── Row state changes ──────────────────────────────────────────────────────

  function handleRowChange(index: number, patch: Partial<ImportRowState>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  // ── Confirm import ─────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!batchId) return;
    setConfirming(true);
    setParseError(null);

    const overrides = rows
      .map((row, idx) => {
        if (row.skip) return null;
        const original = row.transaction.category_id;
        if (row.category_id !== original) {
          return { index: idx, category_id: row.category_id ?? undefined };
        }
        return null;
      })
      .filter(Boolean);

    try {
      const result = await api.post<{ inserted: number; total: number }>('/import/confirm', {
        batch_id: batchId,
        overrides: overrides.length > 0 ? overrides : undefined,
      });
      setToast(`${result.inserted} transaction${result.inserted !== 1 ? 's' : ''} imported successfully!`);
      setBatchId(null);
      setRows([]);
      setSmsText('');
      setCsvData('');
      setCsvFileName('');
      setTimeout(() => navigate('/transactions'), 1800);
    } catch (err) {
      setParseError(
        err instanceof ApiRequestError ? err.message : 'Import failed. Please try again.'
      );
    } finally {
      setConfirming(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 pb-32 relative">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white hover:bg-white/[0.07] transition-all min-h-[44px]"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white text-xl font-bold font-display tracking-tight">Import Transactions</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1.5 mb-6">
        {(['sms', 'csv'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
              tab === t
                ? 'bg-ghana-surface text-white shadow-sm border border-white/[0.04]'
                : 'text-muted hover:text-white'
            }`}
          >
            {t === 'sms' ? 'SMS Messages' : 'CSV File'}
          </button>
        ))}
      </div>

      {/* Account selector */}
      <div className="mb-6">
        <label className="block text-muted/70 text-xs font-medium uppercase tracking-wider mb-2.5">
          Account
        </label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="input-premium appearance-none"
        >
          <option value="" className="bg-ghana-surface text-muted">Select account...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} className="bg-ghana-surface text-white">
              {a.name}
              {a.is_primary === 1 ? ' (Primary)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ── SMS tab ─────────────────────────────────────────────────────────── */}
      {tab === 'sms' && (
        <div className="space-y-4">
          <div>
            <label className="block text-muted/70 text-xs font-medium uppercase tracking-wider mb-2.5">
              Paste SMS Messages
            </label>
            <p className="text-muted/50 text-xs mb-2.5">
              Paste one or more SMS messages. Separate multiple messages with a blank line.
            </p>
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={8}
              placeholder={`You have received GHS 50.00 from 0241234567 on 14-03-2026. Your new MoMo balance is GHS 150.00\n\nYour MTN MoMo payment of GHS 25.00 to Shoprite has been completed.`}
              className="input-premium resize-none font-mono !py-3"
            />
          </div>

          <button
            type="button"
            onClick={handleSmsParse}
            disabled={parsing || !smsText.trim()}
            className="w-full py-3.5 rounded-xl bg-white/[0.03] border border-gold/20 text-gold font-semibold text-sm
              hover:bg-gold/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
          >
            {parsing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                Parsing...
              </span>
            ) : (
              'Parse SMS Messages'
            )}
          </button>
        </div>
      )}

      {/* ── CSV tab ─────────────────────────────────────────────────────────── */}
      {tab === 'csv' && (
        <div className="space-y-4">
          <div>
            <label className="block text-muted/70 text-xs font-medium uppercase tracking-wider mb-2.5">
              Statement Format
            </label>
            <select
              value={csvFormat}
              onChange={(e) => setCsvFormat(e.target.value)}
              className="input-premium appearance-none"
            >
              {csvFormats.map((f) => (
                <option key={f.provider} value={f.provider} className="bg-ghana-surface text-white">
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-muted/70 text-xs font-medium uppercase tracking-wider mb-2.5">
              CSV File
            </label>
            <button
              type="button"
              onClick={() => csvFileRef.current?.click()}
              className="w-full py-8 rounded-2xl border-2 border-dashed border-white/[0.08] flex flex-col items-center gap-2.5
                hover:border-gold/25 hover:bg-gold/[0.02] transition-all text-center min-h-[120px]"
            >
              <svg className="w-8 h-8 text-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-white/80 text-sm font-medium">
                {csvFileName || 'Tap to upload CSV file'}
              </span>
              {!csvFileName && (
                <span className="text-muted/50 text-xs">Supported: .csv files</span>
              )}
              {csvFileName && (
                <span className="text-income/80 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  File loaded
                </span>
              )}
            </button>
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChange}
              className="hidden"
              aria-label="Upload CSV file"
            />
          </div>

          <button
            type="button"
            onClick={handleCsvParse}
            disabled={parsing || !csvData.trim()}
            className="w-full py-3.5 rounded-xl bg-white/[0.03] border border-gold/20 text-gold font-semibold text-sm
              hover:bg-gold/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
          >
            {parsing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                Parsing...
              </span>
            ) : (
              'Parse CSV File'
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {parseError && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-expense/[0.06] border border-expense/[0.08] text-expense/90 text-sm">
          {parseError}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && batchId && (
        <div className="mt-8">
          <h2 className="text-white text-base font-semibold font-display mb-4">
            Preview
          </h2>
          <ImportPreview
            rows={rows}
            duplicates={duplicates}
            categories={categories}
            onRowChange={handleRowChange}
            onConfirm={handleConfirm}
            loading={confirming}
          />
        </div>
      )}
    </div>
  );
}
