# Billing

This app now owns the first bounded billing foundation for Titan commercial
closeout flows.

Implemented scope:
- issue billing invoices for inventory damage/loss excess receivables;
- keep a durable billing invoice record linked to the generated document;
- settle an open billing invoice with one confirmed payment of the exact same amount;
- expose authenticated billing invoice read and settle endpoints.

Still out of scope:
- partial settlements;
- installment schedules or due-date workflows;
- refunds, tax logic, legal numbering, or accounting exports;
- frontend activation.
