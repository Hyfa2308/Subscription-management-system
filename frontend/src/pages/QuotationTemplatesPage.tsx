/**
 * REVORA – QuotationTemplatesPage
 * Route: /quotation-templates
 * Create, view, edit, activate/deactivate, and delete quotation templates.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Plus, Search, RefreshCw, X, Edit3,
  MoreHorizontal, ToggleLeft, ToggleRight, Trash2,
  CheckCircle2, XCircle, Eye,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/common/Button';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
} from '@/services/quotationTemplateApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type {
  QuotationTemplate, TemplateCreateRequest, TemplateUpdateRequest,
} from '@/types/quotation';

// ── Template Form Dialog ──────────────────────────────────────────────────────

interface TemplateFormProps {
  open:        boolean;
  onClose:     () => void;
  template?:   QuotationTemplate | null;
  onSuccess:   () => void;
}

function TemplateFormDialog({ open, onClose, template, onSuccess }: TemplateFormProps) {
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(template);

  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [notes,    setNotes]    = useState('');
  const [terms,    setTerms]    = useState('');
  const [validity, setValidity] = useState(30);
  const [active,   setActive]   = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setName(template.template_name);
      setDesc(template.description || '');
      setNotes(template.default_notes || '');
      setTerms(template.default_terms_and_conditions || '');
      setValidity(template.default_validity_days);
      setActive(template.is_active);
    } else {
      setName(''); setDesc(''); setNotes(''); setTerms('');
      setValidity(30); setActive(true);
    }
    setErrors({});
  }, [template, open]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (validity < 1) e.validity = 'Validity must be at least 1 day.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload: TemplateCreateRequest = {
      template_name: name.trim(),
      description:   desc.trim() || undefined,
      default_notes: notes.trim() || undefined,
      default_terms_and_conditions: terms.trim() || undefined,
      default_validity_days: validity,
      is_active: active,
    };
    try {
      if (isEdit && template) {
        await updateTemplate(template.id, payload as TemplateUpdateRequest);
        success('Updated', `Template "${name}" has been updated.`);
      } else {
        await createTemplate(payload);
        success('Created', `Template "${name}" has been created.`);
      }
      onClose();
      onSuccess();
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 409) toastError('Duplicate', 'A template with this name already exists.');
      else           toastError('Error', getApiErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit Template' : 'Create Template'}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                Templates pre-fill notes, terms, and validity when creating quotations.
              </Dialog.Description>
            </div>
            <Dialog.Close onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div>
              <label className="form-label">Template Name <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Standard 30-day" className={cn('form-input', errors.name && 'border-red-400')} />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Short description of when to use this template…" className="form-input resize-none" />
            </div>

            {/* Default validity */}
            <div>
              <label className="form-label">Default Validity <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" step="1" value={validity} onChange={e => setValidity(Number(e.target.value))}
                  className={cn('form-input w-24', errors.validity && 'border-red-400')} />
                <span className="text-sm text-slate-500">days</span>
              </div>
              {errors.validity && <p className="form-error">{errors.validity}</p>}
            </div>

            {/* Default notes */}
            <div>
              <label className="form-label">Default Notes</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Notes that will be pre-filled in the quotation…" className="form-input resize-none" />
            </div>

            {/* Default terms */}
            <div>
              <label className="form-label">Default Terms &amp; Conditions</label>
              <textarea rows={4} value={terms} onChange={e => setTerms(e.target.value)}
                placeholder="Payment terms, validity, warranty details…" className="form-input resize-none" />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-slate-700">Active</p>
                <p className="text-xs text-slate-400">Only active templates appear during quotation creation.</p>
              </div>
              <button type="button" onClick={() => setActive(a => !a)}
                className={cn(
                  'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-150',
                  active ? 'bg-indigo-600' : 'bg-slate-200',
                )}>
                <span className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-150',
                  active ? 'translate-x-4' : 'translate-x-0',
                )} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {isEdit ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Preview Slide-over ────────────────────────────────────────────────────────

function TemplatePreview({ template, onClose }: { template: QuotationTemplate; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col focus:outline-none">
          <div className="flex items-center justify-between px-6 py-5 border-b">
            <Dialog.Title className="text-sm font-semibold text-slate-900">Template Preview</Dialog.Title>
            <Dialog.Close onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Template Name</p>
              <p className="text-sm font-medium text-slate-800">{template.template_name}</p>
            </div>
            {template.description && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Description</p>
                <p className="text-sm text-slate-600">{template.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Default Validity</p>
              <p className="text-sm text-slate-800">{template.default_validity_days} days</p>
            </div>
            {template.default_notes && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Default Notes</p>
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">{template.default_notes}</div>
              </div>
            )}
            {template.default_terms_and_conditions && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Default Terms &amp; Conditions</p>
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-500 whitespace-pre-wrap">{template.default_terms_and_conditions}</div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-400 uppercase">Status</p>
              {template.is_active
                ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                : <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold"><XCircle className="w-3.5 h-3.5" /> Inactive</span>}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({ t, onEdit, onPreview, onDelete }: {
  t: QuotationTemplate;
  onEdit:    (t: QuotationTemplate) => void;
  onPreview: (t: QuotationTemplate) => void;
  onDelete:  (t: QuotationTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <button onClick={() => { setOpen(false); onPreview(t); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
            <Eye className="w-3.5 h-3.5 text-slate-400" /> Preview
          </button>
          <button onClick={() => { setOpen(false); onEdit(t); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
            <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Edit
          </button>
          <button onClick={() => { setOpen(false); onDelete(t); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuotationTemplatesPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [templates,    setTemplates]    = useState<QuotationTemplate[]>([]);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [apiError,     setApiError]     = useState('');

  const [search,     setSearch]     = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(20);

  const debouncedSearch = useDebounce(search, 400);

  const [formOpen,       setFormOpen]       = useState(false);
  const [editTarget,     setEditTarget]     = useState<QuotationTemplate | null>(null);
  const [previewTarget,  setPreviewTarget]  = useState<QuotationTemplate | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<QuotationTemplate | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [togglingId,     setTogglingId]     = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getTemplates({
        search:    debouncedSearch || undefined,
        is_active: activeFilter !== '' ? activeFilter === 'true' : undefined,
        page, limit,
      });
      setTemplates(res.templates);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) { setApiError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [debouncedSearch, activeFilter, page, limit]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { setPage(1); }, [debouncedSearch, activeFilter]);

  const handleToggleActive = async (t: QuotationTemplate) => {
    setTogglingId(t.id);
    try {
      await updateTemplate(t.id, { is_active: !t.is_active });
      success('Updated', `Template "${t.template_name}" ${t.is_active ? 'deactivated' : 'activated'}.`);
      fetchTemplates();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setTogglingId(null); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      success('Deleted', `Template "${deleteTarget.template_name}" deleted.`);
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const columns: Column<QuotationTemplate>[] = [
    {
      key: 'template_name', header: 'Template Name',
      render: t => (
        <div>
          <p className="text-sm font-medium text-slate-900">{t.template_name}</p>
          {t.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{t.description}</p>}
        </div>
      ),
    },
    {
      key: 'default_validity_days', header: 'Default Validity',
      render: t => <span className="text-sm text-slate-600">{t.default_validity_days} days</span>,
    },
    {
      key: 'default_notes', header: 'Has Notes',
      render: t => t.default_notes
        ? <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      key: 'is_active', header: 'Active',
      render: t => (
        <button
          onClick={() => handleToggleActive(t)}
          disabled={togglingId === t.id}
          className={cn('flex items-center gap-1.5 text-xs font-semibold transition-colors', t.is_active ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-slate-600')}
          title={t.is_active ? 'Click to deactivate' : 'Click to activate'}
        >
          {t.is_active
            ? <><ToggleRight className="w-4 h-4" /> Active</>
            : <><ToggleLeft  className="w-4 h-4" /> Inactive</>
          }
        </button>
      ),
    },
    {
      key: 'created_at', header: 'Created',
      render: t => <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: t => (
        <RowActions
          t={t}
          onEdit={tmpl => { setEditTarget(tmpl); setFormOpen(true); }}
          onPreview={setPreviewTarget}
          onDelete={setDeleteTarget}
        />
      ),
    },
  ];

  const hasFilters = !!(search || activeFilter);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quotation Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage reusable templates that pre-fill quotation fields.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/quotations')}>
            ← Quotations
          </Button>
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            Create Template
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search template name…" value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9 py-2 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>}
          </div>
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value as any)} className="form-input py-2 text-sm w-28">
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setActiveFilter(''); setPage(1); }} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="ml-auto">
            <button onClick={fetchTemplates} title="Refresh"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchTemplates} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={templates} keyExtractor={t => t.id}
          loading={loading}
          emptyTitle={hasFilters ? 'No templates found' : 'No templates yet'}
          emptyDescription={hasFilters ? 'Try adjusting filters.' : 'Create your first quotation template.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <TemplateFormDialog
        open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }}
        template={editTarget} onSuccess={fetchTemplates}
      />

      {previewTarget && (
        <TemplatePreview template={previewTarget} onClose={() => setPreviewTarget(null)} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)} onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Template"
        description={`Delete "${deleteTarget?.template_name}"? This cannot be undone.`}
        confirmLabel="Delete" variant="danger" loading={deleting} onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
