# Cashbox

This app owns the minimal backend cashbox foundation for INV-015.

Implemented scope:
- open a cashbox session for one authorized user;
- close an open cashbox session with durable attribution;
- record positive cash movements with `cash_in` / `cash_out` direction;
- optionally link a movement to a `Payment`, `BillingInvoice`, or
  `BillingRefundObligation`;
- reject new movements on a closed session;
- keep all critical writes inside explicit services with transaction handling and
  audit events.

Still out of scope:
- accounting export;
- legal numbering;
- fiscal rules;
- inventory or logistics coupling;
- frontend activation.

