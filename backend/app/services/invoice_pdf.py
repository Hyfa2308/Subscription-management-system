"""
REVORA – Invoice PDF Generator.
Generates professional branded invoices using ReportLab.
No hardcoded registration numbers, GSTIN, or bank details.
Company information is read from environment variables.
"""

from __future__ import annotations

import io
import os
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


BRAND_DARK  = colors.HexColor("#1e1b4b")
BRAND_MID   = colors.HexColor("#4f46e5")
BRAND_LIGHT = colors.HexColor("#e0e7ff")
GREY        = colors.HexColor("#64748b")
LIGHT_GREY  = colors.HexColor("#f1f5f9")


def _fmt(value, currency: str = "INR") -> str:
    try:
        v = Decimal(str(value))
    except Exception:
        v = Decimal("0")
    return f"{currency} {v:,.2f}"


def _date(dt) -> str:
    if not dt:
        return "—"
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt.strftime("%d %b %Y")


def generate_invoice_pdf(invoice, customer=None, subscription=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    normal  = ParagraphStyle("normal",  fontSize=9,  leading=13, textColor=colors.HexColor("#334155"))
    small   = ParagraphStyle("small",   fontSize=8,  leading=11, textColor=GREY)
    heading = ParagraphStyle("heading", fontSize=20, leading=24, textColor=BRAND_DARK, fontName="Helvetica-Bold")
    label   = ParagraphStyle("label",   fontSize=7,  leading=10, textColor=GREY,      fontName="Helvetica-Bold", spaceAfter=2)
    bold9   = ParagraphStyle("bold9",   fontSize=9,  leading=13, fontName="Helvetica-Bold", textColor=colors.HexColor("#0f172a"))
    meta    = ParagraphStyle("meta",    fontSize=9,  leading=13, textColor=colors.HexColor("#334155"))

    company_name    = _env("COMPANY_NAME",    "REVORA")
    company_address = _env("COMPANY_ADDRESS", "")
    company_email   = _env("COMPANY_EMAIL",   "")
    company_phone   = _env("COMPANY_PHONE",   "")
    company_website = _env("COMPANY_WEBSITE", "")
    payment_instructions = _env("PAYMENT_INSTRUCTIONS", "Please process payment within the due date.")

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(f"<b>{company_name}</b>", heading),
        Paragraph("<b>INVOICE</b>", ParagraphStyle(
            "inv_title", fontSize=26, leading=30, textColor=BRAND_MID,
            fontName="Helvetica-Bold", alignment=2,
        )),
    ]]
    header_tbl = Table(header_data, colWidths=["50%", "50%"])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_tbl)

    # Company sub-info
    co_parts = [p for p in [company_address, company_email, company_phone, company_website] if p]
    if co_parts:
        story.append(Paragraph(" &nbsp;·&nbsp; ".join(co_parts), small))

    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND_MID, spaceAfter=8, spaceBefore=6))

    # ── Invoice meta row ──────────────────────────────────────────────────────
    inv_no  = getattr(invoice, "invoice_number", "—")
    inv_dt  = _date(getattr(invoice, "invoice_date", None))
    due_dt  = _date(getattr(invoice, "due_date", None))
    status  = str(getattr(invoice, "status", "")).replace("_", " ").title()
    currency = str(getattr(invoice, "currency", "INR"))

    meta_data = [[
        Paragraph("INVOICE NO.",    label), Paragraph("DATE",   label),
        Paragraph("DUE DATE",       label), Paragraph("STATUS", label),
    ], [
        Paragraph(f"<b>{inv_no}</b>", bold9), Paragraph(inv_dt, meta),
        Paragraph(due_dt,   meta),            Paragraph(f"<b>{status}</b>", bold9),
    ]]
    meta_tbl = Table(meta_data, colWidths=["25%", "25%", "25%", "25%"])
    meta_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), LIGHT_GREY),
        ("ROWBACKGROUNDS",(0, 1), (-1, 1), [colors.white]),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, GREY),
        ("BOX",           (0, 0), (-1, -1), 0.3, GREY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 6))

    # ── Billing period ────────────────────────────────────────────────────────
    p_start = getattr(invoice, "billing_period_start", None)
    p_end   = getattr(invoice, "billing_period_end",   None)
    if p_start or p_end:
        period_str = f"{_date(p_start)} — {_date(p_end)}"
        story.append(Paragraph(f"<b>Billing Period:</b> {period_str}", small))
        story.append(Spacer(1, 4))

    # ── Bill-to ────────────────────────────────────────────────────────────────
    story.append(Paragraph("BILL TO", label))
    if customer:
        story.append(Paragraph(f"<b>{customer.full_name}</b>", bold9))
        if getattr(customer, "company_name", None):
            story.append(Paragraph(customer.company_name, normal))
        story.append(Paragraph(customer.email, normal))
        if getattr(customer, "phone", None):
            story.append(Paragraph(customer.phone, normal))
    else:
        story.append(Paragraph("—", normal))

    if subscription:
        story.append(Spacer(1, 4))
        story.append(Paragraph("SUBSCRIPTION REFERENCE", label))
        story.append(Paragraph(subscription.subscription_number, bold9))

    story.append(Spacer(1, 10))

    # ── Line items table ──────────────────────────────────────────────────────
    item_header = ["#", "Description", "Qty", "Unit Price", "Disc %", "Tax %", "Total"]
    item_rows   = [item_header]
    items = getattr(invoice, "items", [])
    for i, item in enumerate(items, 1):
        item_rows.append([
            str(i),
            str(item.description),
            str(item.quantity),
            _fmt(item.unit_price, currency),
            f"{item.discount_percentage}%",
            f"{item.tax_percentage}%",
            _fmt(item.line_total, currency),
        ])

    item_tbl = Table(item_rows, colWidths=[8*mm, None, 15*mm, 30*mm, 16*mm, 16*mm, 30*mm])
    item_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), BRAND_DARK),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, GREY),
        ("BOX",           (0, 0), (-1, -1), 0.3, GREY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("ALIGN",         (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN",         (0, 0), (0, -1), "CENTER"),
    ]))
    story.append(item_tbl)
    story.append(Spacer(1, 6))

    # ── Totals ────────────────────────────────────────────────────────────────
    totals_data = [
        ["Subtotal",       _fmt(getattr(invoice, "subtotal",        0), currency)],
        ["Discount",       f"- {_fmt(getattr(invoice, 'discount_amount', 0), currency)}"],
        ["Tax",            _fmt(getattr(invoice, "tax_amount",       0), currency)],
        ["Total Amount",   _fmt(getattr(invoice, "total_amount",     0), currency)],
        ["Amount Paid",    _fmt(getattr(invoice, "amount_paid",      0), currency)],
        ["Amount Due",     _fmt(getattr(invoice, "amount_due",       0), currency)],
    ]
    totals_tbl = Table(totals_data, colWidths=["*", 50*mm], hAlign="RIGHT")
    totals_tbl.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("ALIGN",         (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE",     (0, 3), (-1, 3), 0.5, GREY),
        ("FONTNAME",      (0, 3), (-1, 3), "Helvetica-Bold"),
        ("FONTNAME",      (0, 5), (-1, 5), "Helvetica-Bold"),
        ("TEXTCOLOR",     (0, 5), (-1, 5), BRAND_MID),
        ("BACKGROUND",    (0, 5), (-1, 5), BRAND_LIGHT),
        ("LINEABOVE",     (0, 4), (-1, 4), 0.5, GREY),
    ]))
    story.append(totals_tbl)

    # ── Payment instructions ──────────────────────────────────────────────────
    if payment_instructions:
        story.append(Spacer(1, 8))
        story.append(Paragraph("PAYMENT INSTRUCTIONS", label))
        story.append(Paragraph(payment_instructions, small))

    # ── Notes / Terms ─────────────────────────────────────────────────────────
    notes = getattr(invoice, "notes", None)
    terms = getattr(invoice, "terms_and_conditions", None)
    if notes:
        story.append(Spacer(1, 6))
        story.append(Paragraph("NOTES", label))
        story.append(Paragraph(notes, small))
    if terms:
        story.append(Spacer(1, 6))
        story.append(Paragraph("TERMS & CONDITIONS", label))
        story.append(Paragraph(terms, small))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY))
    story.append(Paragraph(
        f"Generated by {company_name} · {company_email}",
        ParagraphStyle("footer", fontSize=7, textColor=GREY, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()
