# Report Templates

Use these formats for consistent professional reporting.

## Weekly Expense Report Template

```markdown
# Weekly Expense Reconciliation

Period: {{period_start}} to {{period_end}}
Workspace: {{workspace_key}}
Currency: {{currency}}
Prepared at: {{prepared_at}}

## Executive Summary
- Total expenses: {{total_expenses}}
- Invoice count: {{invoice_count}}
- New vendors this week: {{new_vendor_count}}
- Variance vs previous week: {{variance_amount}} ({{variance_percent}}%)

## Vendor Breakdown
| Vendor | Invoice Count | Total Amount | Notes |
|---|---:|---:|---|
{{vendor_rows}}

## Exceptions and Data Quality
- Missing invoice date: {{missing_invoice_date_count}}
- Missing amount: {{missing_amount_count}}
- Low extraction confidence: {{low_confidence_count}}
- Duplicate candidates skipped: {{duplicate_skipped_count}}

## Recommendations
1. {{recommendation_1}}
2. {{recommendation_2}}
3. {{recommendation_3}}
```

## Monthly Income Report Template

```markdown
# Monthly Income Reconciliation

Period: {{period_start}} to {{period_end}}
Workspace: {{workspace_key}}
Currency: {{currency}}
Prepared at: {{prepared_at}}

## Executive Summary
- Gross income: {{gross_income}}
- Net income: {{net_income}}
- Tax collected: {{tax_collected}}
- Paid invoice count: {{paid_invoice_count}}

## Customer Concentration
| Customer | Invoice Count | Gross Amount | Net Amount |
|---|---:|---:|---:|
{{customer_rows}}

## Stripe Reconciliation Notes
- Records inserted: {{rows_inserted}}
- Records updated: {{rows_updated}}
- Records skipped: {{rows_skipped}}
- Unmatched records: {{unmatched_count}}

## Recommendations
1. {{recommendation_1}}
2. {{recommendation_2}}
3. {{recommendation_3}}
```

## Tax Report Template

```markdown
# Tax Report

Period: {{period_start}} to {{period_end}}
Workspace: {{workspace_key}}
Prepared at: {{prepared_at}}

## Tax Summary
- Output tax collected: {{output_tax}}
- Input tax from expenses: {{input_tax}}
- Net tax position: {{net_tax_position}}

## Source Breakdown
| Source | Tax Amount |
|---|---:|
{{tax_rows}}

## Supporting Notes
- Filing jurisdiction assumptions: {{jurisdiction_notes}}
- Data completeness caveats: {{completeness_notes}}
- Open obligations: {{open_obligation_count}}
- Review-required items: {{review_required_count}}
```

## Profitability Report Template

```markdown
# Profitability Report

Period: {{period_start}} to {{period_end}}
Workspace: {{workspace_key}}
Currency: {{currency}}
Prepared at: {{prepared_at}}

## Profitability Summary
- Total income: {{total_income}}
- Total expenses: {{total_expenses}}
- Net profit: {{net_profit}}
- Profit margin: {{profit_margin_percent}}%

## Trend Highlights
- Income trend: {{income_trend}}
- Expense trend: {{expense_trend}}
- Margin trend: {{margin_trend}}

## Key Drivers
1. {{driver_1}}
2. {{driver_2}}
3. {{driver_3}}
```

## Filing Pack Template

```markdown
# Filing Pack

Tax Year: {{tax_year}}
Workspace: {{workspace_key}}
Entity: {{entity_key}}
Jurisdiction: {{jurisdiction}}
Prepared at: {{prepared_at}}

## Readiness Summary
- Filing status: {{filing_status}}
- Open obligations: {{open_obligation_count}}
- Review-required items: {{review_required_count}}
- Missing evidence count: {{missing_evidence_count}}

## Financial Snapshot
- Total income: {{total_income}}
- Total expenses: {{total_expenses}}
- Net result: {{net_result}}
- Sales tax payable: {{sales_tax_payable}}

## Workpapers Included
| Workpaper | Status | Notes |
|---|---|---|
{{workpaper_rows}}

## Adjustments
| Adjustment Type | Amount | Reviewer Status | Notes |
|---|---:|---|---|
{{adjustment_rows}}

## Owner-Manager Items
- Salary paid: {{salary_total}}
- Dividends paid: {{dividend_total}}
- Reimbursements: {{reimbursement_total}}
- Shareholder loan balance movement: {{loan_balance_movement}}

## Filing Notes
1. {{filing_note_1}}
2. {{filing_note_2}}
3. {{filing_note_3}}
```

## Catch-Up Action Plan Template

```markdown
# Catch-Up Tax Action Plan

Coverage: {{period_start}} to {{period_end}}
Workspace: {{workspace_key}}
Entity: {{entity_key}}
Prepared at: {{prepared_at}}

## Executive Summary
- Years in backlog: {{backlog_year_count}}
- Years filing-ready: {{ready_year_count}}
- Years blocked: {{blocked_year_count}}
- Estimated balance due / exposure: {{estimated_exposure}}

## Year-by-Year Status
| Tax Year | Bookkeeping Status | Filing Status | Missing Evidence | Priority |
|---|---|---|---:|---|
{{year_rows}}

## Missing Inputs
1. {{missing_input_1}}
2. {{missing_input_2}}
3. {{missing_input_3}}

## Recommended Sequence
1. {{sequence_step_1}}
2. {{sequence_step_2}}
3. {{sequence_step_3}}

## Risks and Review Notes
- Home-office treatment risk: {{home_office_risk}}
- Owner compensation risk: {{owner_comp_risk}}
- Sales-tax risk: {{sales_tax_risk}}
- Cross-border or nexus risk: {{cross_border_risk}}
```

## Home Office Workpaper Template

```markdown
# Home Office Workpaper

Tax Year: {{tax_year}}
Workspace: {{workspace_key}}
Entity: {{entity_key}}
Prepared at: {{prepared_at}}

## Method Selection
- Selected treatment: {{home_office_treatment}}
- Reason: {{method_reason}}
- Review status: {{review_status}}

## Space Calculation
- Total home area: {{total_home_area}}
- Dedicated business area: {{business_area}}
- Business-use percent: {{business_use_percent}}%

## Expense Allocation
| Expense Category | Total Cost | Business Use % | Deductible Amount | Notes |
|---|---:|---:|---:|---|
{{expense_rows}}

## Cautions
1. {{caution_1}}
2. {{caution_2}}
3. {{caution_3}}
```
