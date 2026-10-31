# Discount Integration Contract

> **Module Owner**: Discount Management (Prompt 9)  
> **Consumers**: Quotations, Subscriptions, Invoices (parallel modules)  
> Version: 1.0 — 2026-10-31

---

## Overview

The Discount module exposes backend validation and redemption services that other modules can consume **without modifying existing logic**. All discount amounts are computed on the backend using `Decimal` arithmetic. No frontend-calculated discount value should ever be trusted.

---

## Integration Pattern (Reserve → Redeem → Reverse)

```
1. POST /api/v1/discounts/validate
   → Validate code before committing the transaction (no side effects)

2. POST /api/v1/discounts/{id}/reserve
   → Creates a DiscountRedemption in status=reserved
   → Does NOT increment usage_count yet

3. On transaction success (quotation accepted / subscription activated / invoice finalized):
   POST /api/v1/discounts/{id}/redeem/{redemption_id}
   → Sets status=redeemed, stamps redeemed_at, increments usage_count

4. On transaction failure / cancellation:
   POST /api/v1/discounts/{id}/reverse/{redemption_id}
   → Sets status=reversed, decrements usage_count if previously redeemed
```

---

## Validate Endpoint

**Request** `POST /api/v1/discounts/validate`

```json
{
  "discount_code":   "SAVE20",
  "customer_id":     42,
  "purchase_amount": "5000.00",
  "currency":        "INR",
  "product_ids":     [1, 3],
  "plan_ids":        [2],
  "context":         "quotation"
}
```

**Response**

```json
{
  "valid":            true,
  "reason":           "Discount is valid.",
  "discount_code":    "SAVE20",
  "discount_amount":  "1000.0000",
  "final_amount":     "4000.0000",
  "applicable_rules": ["Date validity ✓", "Global usage ✓", "Currency ✓", "Minimum purchase ✓"],
  "discount_id":      7
}
```

If `valid = false`, the `reason` field contains a human-readable error to display to the user.

---

## Reserve Endpoint

**Request** `POST /api/v1/discounts/{discount_id}/reserve`

```json
{
  "customer_id":      42,
  "purchase_amount":  "5000.00",
  "currency":         "INR",
  "quotation_id":     null,
  "subscription_id":  null,
  "invoice_id":       null
}
```

**Response**: `RedemptionResponse` with `status = "reserved"` and the actual `redemption_amount` computed by the server.

> Store the `redemption_id` from this response — needed for confirm/reverse.

---

## Redeem / Reverse Endpoints

| Endpoint | When to call |
|---|---|
| `POST /discounts/{id}/redeem/{redemption_id}` | Quotation accepted, subscription activated, invoice finalized |
| `POST /discounts/{id}/reverse/{redemption_id}` | Quotation rejected, subscription cancelled, invoice voided |

---

## Uniqueness Constraints (Duplicate Prevention)

The `discount_redemptions` table enforces:

| Constraint | Prevents |
|---|---|
| `uq_redemption_discount_invoice` | Same discount applied twice to the same invoice |
| `uq_redemption_discount_subscription` | Same discount applied twice to the same subscription |
| `uq_redemption_discount_quotation` | Same discount applied twice to the same quotation |

The service layer will return `HTTP 409` if a duplicate is attempted.

---

## Calculation Methodology

```python
# Percentage discount
discount_amount = purchase_amount × (discount_value / 100)

# Fixed discount
discount_amount = discount_value

# Apply maximum cap
if maximum_discount_amount:
    discount_amount = min(discount_amount, maximum_discount_amount)

# Safety: discount cannot exceed purchase
discount_amount = min(discount_amount, purchase_amount)

final_amount = purchase_amount - discount_amount
```

All calculations use Python `Decimal` with no floating-point arithmetic.  
The backend is the source of truth — never use frontend-computed discount amounts.

---

## Historical Preservation

- `DiscountRedemption` records are **never deleted**, only reversed.
- Once a quotation/invoice is finalized with a discount, the `redemption_amount` is a snapshot of the discount at that point in time.
- Changing the discount rule after finalization does **not** recalculate existing records.

---

## Permissions

| Role | Create/Edit Discount | Validate | Reserve/Redeem/Reverse | Delete (Archive) |
|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ |
| Staff | ✓ | ✓ | ✓ | ✗ |
| Customer | ✗ | ✗ | ✗ | ✗ |

---

## Error Codes

| HTTP | Scenario |
|---|---|
| 400 | Discount inactive/expired/limit reached/currency mismatch/min purchase unmet |
| 404 | Discount or redemption not found |
| 409 | Duplicate code on create; duplicate redemption on reserve |
