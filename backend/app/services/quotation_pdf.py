"""
REVORA – PDF generator for Quotations using ReportLab.
Generates a professional, branded PDF byte stream.
Company details come from environment variables (no hardcoded data).
"""

from __future__ import annotations

import io
import os
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ── Brand palette ─────────────────────────────────────────────────────────────
BRAND       = colors.HexColor("#4F46E5")   # indigo-600
BRAND_LIGHT = colors.HexColor("#EEF2FF")   # indigo-50
SLATE_800   = colors.HexColor("#1E293B")
SLATE_500   = colors.HexColor("#64748B")
SLATE_100   = colors.HexColor("#F1F5F9")
WHITE       = colors.white


def generate_quotation_pdf(quotation: "Quotation") -> bytes:  # type: ignore[name-defined]
    """Return a PDF byte string for the given Quotation ORM object."""
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )

    styles = getSampleStyleSheet()

    def style(**kw) -> ParagraphStyle:
        return ParagraphStyle("_", parent=styles["Normal"], **kw)

    title_s  = style(fontSize=22, textColor=BRAND, leading=26, fontName="Helvetica-Bold")
    h2_s     = style(fontSize=11, textColor=SLATE_800, fontName="Helvetica-Bold", leading=16)
    label_s  = style(fontSize=8,  textColor=SLATE_500, leading=11)
    value_s  = style(fontSize=9,  textColor=SLATE_800, leading=13)
    small_s  = style(fontSize=8,  textColor=SLATE_500, leading=11)
    body_s   = style(fontSize=9,  textColor=SLATE_800, leading=14)

    # ── Company info from env (no hardcoded values) ───────────────────────────
    company_name    = os.getenv("COMPANY_NAME",    "REVORA")
    company_address = os.getenv("COMPANY_ADDRESS", "")
    company_email   = os.getenv("COMPANY_EMAIL",   "")
    company_phone   = os.getenv("COMPANY_PHONE",   "")
    company_website = os.getenv("COMPANY_WEBSITE", "")

    def fmt_date(dt) -> str:
        if not dt:
            return "—"
        if isinstance(dt, str):
            return dt[:10]
        return dt.strftime("%d %b %Y")

    def fmt_money(val) -> str:
        try:
            return f"{quotation.currency} {Decimal(str(val)):,.2f}"
        except Exception:
            return str(val)

    elements = []

    # ── Header strip ─────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(company_name, title_s),
        Paragraph(
            f"<b>QUOTATION</b><br/><font size=9 color='#64748B'>{quotation.quotation_number}</font>",
            style(fontSize=16, textColor=SLATE_800, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        ),
    ]]
    header_table = Table(header_data, colWidths=["60%", "40%"])
    header_table.setStyle(TableStyle([
        ("VALIGN",  (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING",   (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0), (-1,-1), 0),
    ]))
    elements.append(header_table)

    # Company sub-info
    company_lines = [x for x in [company_address, company_email, company_phone, company_website] if x]
    if company_lines:
        elements.append(Spacer(1, 3*mm))
        elements.append(Paragraph(" | ".join(company_lines), small_s))

    elements.append(Spacer(1, 5*mm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BRAND))
    elements.append(Spacer(1, 5*mm))

    # ── Meta row (dates + status) ─────────────────────────────────────────────
    meta_data = [[
        Paragraph("Quotation Date", label_s), Paragraph("Expiry Date", label_s),
        Paragraph("Status", label_s),         Paragraph("Currency", label_s),
    ], [
        Paragraph(fmt_date(quotation.quotation_date), value_s),
        Paragraph(fmt_date(quotation.expiry_date),    value_s),
        Paragraph(quotation.status.upper(),            value_s),
        Paragraph(quotation.currency,                  value_s),
    ]]
    meta_table = Table(meta_data, colWidths=["25%"]*4)
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), SLATE_100),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE]),
        ("FONTNAME",  (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",  (0,0), (-1,-1), 8),
        ("PADDING",   (0,0), (-1,-1), 5),
        ("GRID",      (0,0), (-1,-1), 0.3, colors.HexColor("#CBD5E1")),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 5*mm))

    # ── Customer info ─────────────────────────────────────────────────────────
    elements.append(Paragraph("Bill To", h2_s))
    elements.append(Spacer(1, 2*mm))
    customer = quotation.customer
    if customer:
        cust_lines = [f"<b>{customer.full_name}</b>"]
        if customer.company_name:
            cust_lines.append(customer.company_name)
        if customer.email:
            cust_lines.append(customer.email)
        if hasattr(customer, "phone") and customer.phone:
            cust_lines.append(customer.phone)
        elements.append(Paragraph("<br/>".join(cust_lines), body_s))
    elements.append(Spacer(1, 5*mm))

    # ── Items table ───────────────────────────────────────────────────────────
    elements.append(Paragraph("Line Items", h2_s))
    elements.append(Spacer(1, 2*mm))

    col_headers = ["#", "Description", "Qty", "Unit Price", "Disc %", "Tax %", "Total"]
    item_rows   = [col_headers]
    for i, item in enumerate(quotation.items, 1):
        item_rows.append([
            str(i),
            Paragraph(item.description, style(fontSize=8, leading=11)),
            str(item.quantity),
            fmt_money(item.unit_price),
            f"{item.discount_percentage}%",
            f"{item.tax_percentage}%",
            fmt_money(item.line_total),
        ])

    items_table = Table(
        item_rows,
        colWidths=["5%","37%","8%","15%","8%","8%","14%"],
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0), BRAND),
        ("TEXTCOLOR",    (0,0), (-1,0), WHITE),
        ("FONTNAME",     (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, SLATE_100]),
        ("GRID",         (0,0), (-1,-1), 0.3, colors.HexColor("#CBD5E1")),
        ("PADDING",      (0,0), (-1,-1), 5),
        ("ALIGN",        (2,0), (-1,-1), "RIGHT"),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 5*mm))

    # ── Totals block ──────────────────────────────────────────────────────────
    totals_data = [
        ["Subtotal:",        fmt_money(quotation.subtotal)],
        ["Discount:",        f"- {fmt_money(quotation.discount_amount)}"],
        ["Tax:",             fmt_money(quotation.tax_amount)],
        ["",                 ""],  # spacer row
        ["Total Amount:",    fmt_money(quotation.total_amount)],
    ]
    totals_table = Table(totals_data, colWidths=["75%","25%"])
    totals_table.setStyle(TableStyle([
        ("FONTNAME",     (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",     (0,0), (-1,-1), 9),
        ("ALIGN",        (1,0), (1,-1), "RIGHT"),
        ("FONTNAME",     (0,4), (-1,4), "Helvetica-Bold"),
        ("FONTSIZE",     (0,4), (-1,4), 11),
        ("TEXTCOLOR",    (0,4), (-1,4), BRAND),
        ("LINEABOVE",    (0,4), (-1,4), 1.5, BRAND),
        ("TOPPADDING",   (0,4), (-1,4), 6),
        ("BOTTOMPADDING",(0,4), (-1,4), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 6*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1")))

    # ── Notes + Terms ─────────────────────────────────────────────────────────
    if quotation.notes:
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph("Notes", h2_s))
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(quotation.notes, body_s))

    if quotation.terms_and_conditions:
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph("Terms &amp; Conditions", h2_s))
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(quotation.terms_and_conditions, small_s))

    # ── Footer ────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 8*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BRAND))
    elements.append(Spacer(1, 2*mm))
    footer_text = f"Generated by REVORA  ·  {datetime.utcnow().strftime('%d %b %Y')}"
    elements.append(Paragraph(footer_text, style(fontSize=7, textColor=SLATE_500, alignment=TA_CENTER)))

    doc.build(elements)
    return buf.getvalue()
