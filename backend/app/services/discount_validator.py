"""
REVORA – Discount Validation Engine.

Validates a discount code against a customer, purchase amount, products/plans,
and currency. Returns a typed ValidationResult.

Rules enforced (in order):
1. Code exists.
2. Status is ACTIVE.
3. Not before start_date.
4. Not after end_date (expired).
5. Global usage_limit not exceeded.
6. Per-customer usage_limit_per_customer not exceeded.
7. Currency compatibility (fixed discounts).
8. Minimum purchase amount.
9. Applicability: if applicable_to = PRODUCTS, at least one product_id must match.
   If applicable_to = SUBSCRIPTION_PLANS, at least one plan_id must match.
10. Calculate discount amount using Decimal arithmetic.
11. Apply maximum_discount_amount cap.
12. Final discount must never exceed eligible subtotal.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List

from app.models.discount import Discount, DiscountType, DiscountApplicableTo, DiscountStatus
from app.repositories.discount_repository import DiscountRepository
from app.schemas.discount import DiscountValidateRequest, DiscountValidateResponse


class ValidationResult:
    def __init__(
        self,
        valid: bool,
        reason: str,
        discount_amount: Decimal = Decimal("0"),
        discount: Optional[Discount] = None,
        rules: Optional[List[str]] = None,
    ) -> None:
        self.valid            = valid
        self.reason           = reason
        self.discount_amount  = discount_amount
        self.discount         = discount
        self.rules            = rules or []

    def to_response(self, purchase_amount: Decimal, discount_code: Optional[str] = None) -> DiscountValidateResponse:
        return DiscountValidateResponse(
            valid=self.valid,
            reason=self.reason,
            discount_code=discount_code,
            discount_amount=self.discount_amount,
            final_amount=max(purchase_amount - self.discount_amount, Decimal("0")),
            applicable_rules=self.rules,
            discount_id=self.discount.id if self.discount else None,
        )


class DiscountValidator:

    def __init__(self, repo: DiscountRepository) -> None:
        self.repo = repo

    def validate(self, req: DiscountValidateRequest) -> ValidationResult:
        now  = datetime.now(timezone.utc)
        amount = Decimal(str(req.purchase_amount))
        rules: List[str] = []

        # 1. Code exists
        discount = self.repo.get_by_code(req.discount_code)
        if not discount:
            return ValidationResult(False, "Invalid discount code.")

        # 2. Status must be ACTIVE
        if discount.status != DiscountStatus.ACTIVE:
            return ValidationResult(False, f"Discount is {discount.status.value}.")

        # 3. Not before start_date
        start = discount.start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if now < start:
            return ValidationResult(False, "Discount is not yet valid.")

        # 4. Not expired
        if discount.end_date:
            end = discount.end_date
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            if now > end:
                return ValidationResult(False, "Discount has expired.")
        rules.append("Date validity ✓")

        # 5. Global usage limit
        if discount.usage_limit is not None and discount.usage_count >= discount.usage_limit:
            return ValidationResult(False, "Global usage limit reached.")
        rules.append("Global usage ✓")

        # 6. Per-customer usage limit
        if discount.usage_limit_per_customer is not None:
            customer_count = self.repo.get_customer_redemption_count(discount.id, req.customer_id)
            if customer_count >= discount.usage_limit_per_customer:
                return ValidationResult(False, "Customer usage limit reached.")
        rules.append("Per-customer usage ✓")

        # 7. Currency compatibility (fixed discounts)
        if discount.discount_type == DiscountType.FIXED_AMOUNT:
            if discount.currency.upper() != req.currency.upper():
                return ValidationResult(False, f"Discount is for {discount.currency}, not {req.currency}.")
        rules.append("Currency ✓")

        # 8. Minimum purchase amount
        if discount.minimum_purchase_amount is not None:
            min_amt = Decimal(str(discount.minimum_purchase_amount))
            if amount < min_amt:
                return ValidationResult(
                    False,
                    f"Minimum purchase amount is {min_amt}. Provided: {amount}.",
                )
        rules.append("Minimum purchase ✓")

        # 9. Applicability
        if discount.applicable_to == DiscountApplicableTo.PRODUCTS:
            allowed_ids = set(discount.applicable_product_ids or [])
            provided_ids = set(req.product_ids or [])
            if allowed_ids and not (provided_ids & allowed_ids):
                return ValidationResult(False, "Discount is not applicable to the selected products.")
            rules.append("Product applicability ✓")
        elif discount.applicable_to == DiscountApplicableTo.SUBSCRIPTION_PLANS:
            allowed_ids = set(discount.applicable_plan_ids or [])
            provided_ids = set(req.plan_ids or [])
            if allowed_ids and not (provided_ids & allowed_ids):
                return ValidationResult(False, "Discount is not applicable to the selected subscription plans.")
            rules.append("Plan applicability ✓")
        else:
            rules.append("Applies to all ✓")

        # 10. Calculate discount amount (all Decimal)
        value = Decimal(str(discount.discount_value))
        if discount.discount_type == DiscountType.PERCENTAGE:
            disc_amt = amount * (value / Decimal("100"))
        else:
            disc_amt = value

        # 11. Apply maximum_discount_amount cap
        if discount.maximum_discount_amount is not None:
            max_disc = Decimal(str(discount.maximum_discount_amount))
            if disc_amt > max_disc:
                disc_amt = max_disc
                rules.append(f"Maximum discount cap applied ({max_disc}) ✓")

        # 12. Discount must not exceed eligible subtotal
        disc_amt = min(disc_amt, amount)

        return ValidationResult(
            valid=True,
            reason="Discount is valid.",
            discount_amount=disc_amt,
            discount=discount,
            rules=rules,
        )
