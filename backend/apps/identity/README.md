# Identity

This app now hosts the first backend-only identity and permission foundation.

Implemented scope:
- a narrow application-role vocabulary for backend authorization;
- Django-group mapping for `reservation_sensitive_operator`;
- reusable helpers for explicit sensitive-write authorization;
- a DRF permission class for reservation-sensitive write endpoints.

Current authorization semantics remain intentionally small:
- authenticated active staff users are allowed;
- authenticated active users in the Django group
  `reservation_sensitive_operator` are allowed;
- anonymous, inactive, or otherwise unauthorized actors are denied.

Still out of scope:
- broad RBAC;
- identity models, migrations, or custom auth backends;
- JWT/token auth;
- admin or endpoint management for role assignment.
