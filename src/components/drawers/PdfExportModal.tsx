import React, { useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  MessageCircle,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { Button, EduflowLogo } from '../ui/Primitives';

export const PdfExportModal: React.FC = () => {
  const { activePdfPayload, closePdfExport, showToast } = useEduflow();
  const [includeParentMessage, setIncludeParentMessage] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);

  if (!activePdfPayload) return null;

  const handlePrintPdf = () => {
    showToast(
      'اختر «حفظ كـ PDF / Save as PDF» من نافذة الطباعة لحفظ الملف أو طباعته مباشرة.',
      'info'
    );
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleCopyShareText = () => {
    navigator.clipboard?.writeText(activePdfPayload.shareText);
    setCopiedShare(true);
    showToast('تم نسخ ملخص التقرير جاهزاً للمشاركة مع ولي الأمر أو الإدارة');
    setTimeout(() => setCopiedShare(false), 2200);
  };

  const normalizedPhone = activePdfPayload.parentPhone
    ? activePdfPayload.parentPhone.replace(/^0/, '20')
    : '';
  const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(
    activePdfPayload.shareText
  )}`;

  const kpiToneClasses: Record<string, string> = {
    navy: 'bg-[#F4F7FA] text-[#0F2A4A] border-[#E2E8F0]',
    teal: 'bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20',
    success: 'bg-[#D1FAE5]/60 text-[#065F46] border-emerald-200',
    danger: 'bg-[#FEE2E2]/60 text-[#991B1B] border-red-200',
    warning: 'bg-[#FEF3C7]/70 text-[#92400E] border-amber-200',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="تصدير ومشاركة تقرير PDF"
    >
      <div className="w-full max-w-4xl bg-white rounded-[12px] border border-[#E2E8F0] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Toolbar (Hidden during Print) */}
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F4F7FA] print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#0F2A4A] text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F2A4A]">
                معاينة ملف PDF الجاهز للطباعة والمشاركة
              </h3>
              <p className="text-[11px] text-[#5B6B80]">
                صيغة A4 عربي RTL — متوافق مع الحفظ المباشر كملف PDF والطباعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activePdfPayload.parentGreeting && (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white border border-[#E2E8F0] text-xs font-semibold text-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeParentMessage}
                  onChange={(e) => setIncludeParentMessage(e.target.checked)}
                  className="w-4 h-4 accent-[#0F766E]"
                />
                <span>إظهار رسالة ولي الأمر</span>
              </label>
            )}
            <button
              type="button"
              onClick={closePdfExport}
              aria-label="إغلاق نافذة تصدير PDF"
              className="w-9 h-9 rounded-[8px] bg-white border border-[#E2E8F0] hover:bg-slate-50 flex items-center justify-center text-[#5B6B80] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document Preview Area */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
          <div
            id="printable-pdf-document"
            className="bg-white mx-auto max-w-[794px] border border-[#E2E8F0] rounded-[10px] shadow-xs p-6 sm:p-8 space-y-6 text-[#1E293B]"
          >
            {/* Document Official Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#0F2A4A]">
              <div className="space-y-1.5">
                <EduflowLogo dark={false} />
                <h2 className="text-lg font-bold text-[#0F2A4A] pt-1">
                  {activePdfPayload.centerName}
                </h2>
                <p className="text-xs text-[#5B6B80]">
                  {activePdfPayload.centerAddress} · هاتف: <span className="tabular-nums">{activePdfPayload.centerPhone}</span>
                </p>
              </div>

              <div className="text-right sm:text-left space-y-1 bg-[#F4F7FA] px-4 py-3 rounded-[8px] border border-[#E2E8F0]">
                <span className="text-[11px] font-bold text-[#0F766E] block">
                  مستند رسمي قابل للطباعة (PDF)
                </span>
                <span className="text-sm font-bold text-[#0F2A4A] tabular-nums block">
                  رقم المستند: #{activePdfPayload.documentCode}
                </span>
                <span className="text-xs text-[#5B6B80] tabular-nums block">
                  تاريخ الإصدار: {activePdfPayload.generatedAt}
                </span>
              </div>
            </div>

            {/* Report Title & Period */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-[#0F2A4A]">{activePdfPayload.title}</h1>
                <p className="text-xs text-[#5B6B80] mt-0.5">{activePdfPayload.subtitle}</p>
              </div>
              <span className="text-xs font-bold text-[#0F2A4A] bg-[#F4F7FA] px-3 py-1.5 rounded-[8px] border border-[#E2E8F0] tabular-nums self-start">
                {activePdfPayload.periodLabel}
              </span>
            </div>

            {/* Optional Parent Note Banner */}
            {activePdfPayload.parentGreeting && includeParentMessage && (
              <div className="p-4 rounded-[8px] bg-[#0F766E]/[0.06] border border-[#0F766E]/25 text-xs leading-relaxed text-[#0F2A4A] font-medium">
                {activePdfPayload.parentGreeting}
              </div>
            )}

            {/* KPI Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {activePdfPayload.kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className={`p-3.5 rounded-[8px] border ${
                    kpiToneClasses[kpi.tone || 'navy']
                  }`}
                >
                  <span className="text-[11px] font-semibold opacity-85 block">
                    {kpi.label}
                  </span>
                  <span className="text-lg font-bold tabular-nums block mt-1">
                    {kpi.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Report Data Tables */}
            <div className="space-y-6">
              {activePdfPayload.tables.map((section) => (
                <div key={section.title} className="space-y-2.5">
                  <h3 className="text-sm font-bold text-[#0F2A4A] border-b border-[#E2E8F0] pb-1.5">
                    {section.title}
                  </h3>

                  {section.rows.length === 0 ? (
                    <div className="p-4 rounded-[8px] bg-[#F4F7FA] text-xs text-[#5B6B80] text-center">
                      {section.emptyText || 'لا توجد بيانات مسجلة.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-[8px]">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#0F2A4A] text-white font-bold">
                            {section.columns.map((col) => (
                              <th
                                key={col.key}
                                className={`py-2.5 px-3 ${
                                  col.align === 'left' ? 'text-left' : 'text-right'
                                }`}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {section.rows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                              {section.columns.map((col) => (
                                <td
                                  key={col.key}
                                  className={`py-2.5 px-3 ${
                                    col.align === 'left' ? 'text-left font-bold' : 'text-right'
                                  } ${col.tabular ? 'tabular-nums' : ''}`}
                                >
                                  {row[col.key]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Official Signature & Verification Footer */}
            <div className="pt-5 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs text-[#5B6B80]">
              <div>
                <p className="font-bold text-[#0F2A4A]">معتمد من إدارة {activePdfPayload.centerName}</p>
                <p className="mt-0.5">تم استخراج هذا التقرير آلياً عبر نظام EDUFLOW لإدارة المراكز التعليمية</p>
              </div>
              <div className="text-center">
                <div className="w-40 border-b border-dashed border-slate-400 mb-1.5 h-6" />
                <span>ختم / توقيع إدارة السنتر</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyShareText}
              icon={copiedShare ? <Check className="w-4 h-4 text-[#065F46]" /> : <Copy className="w-4 h-4" />}
            >
              {copiedShare ? 'تم نسخ ملخص المشاركة' : 'نسخ ملخص لولي الأمر'}
            </Button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                showToast('تم تجهيز رسالة المشاركة لفتحها في واتساب', 'info')
              }
              className="inline-flex items-center justify-center gap-2 min-h-[36px] px-3.5 rounded-[8px] border border-[#0F766E]/30 bg-[#0F766E]/10 text-[#0F766E] hover:bg-[#0F766E]/15 text-xs font-bold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>مشاركة عبر واتساب</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={closePdfExport}>
              إغلاق
            </Button>
            <Button
              size="sm"
              onClick={handlePrintPdf}
              icon={<Printer className="w-4 h-4" />}
            >
              حفظ / طباعة PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
