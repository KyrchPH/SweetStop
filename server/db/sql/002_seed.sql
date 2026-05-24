-- Seed base roles and permissions

insert into public.access_roles (code, name, description)
values
  ('cashier', 'Cashier', 'Frontline POS operator'),
  ('manager', 'Manager', 'Branch manager with override permissions'),
  ('admin', 'Admin', 'System administrator with full access')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into public.permissions (permission_key, description)
values
  ('product.view', 'View products and variants'),
  ('product.create', 'Create products and variants'),
  ('product.update', 'Update product details'),
  ('product.branch_availability.update', 'Manage branch-level availability overrides'),
  ('inventory.view', 'View inventory levels'),
  ('inventory.adjust', 'Adjust inventory levels'),
  ('sale.create', 'Create sales receipts'),
  ('receipt.reprint', 'Reprint receipts'),
  ('receipt.void', 'Void receipts'),
  ('shift.open', 'Open cashier shift'),
  ('shift.close', 'Close cashier shift'),
  ('cash.in.create', 'Record incoming cash movement'),
  ('cash.out.create', 'Record outgoing cash movement'),
  ('cash.movement.void', 'Void a cash movement entry'),
  ('report.daily.generate', 'Generate daily summary reports'),
  ('report.daily.view', 'View daily summary reports'),
  ('account.manage', 'Manage users and accounts'),
  ('role.manage', 'Manage roles and permissions'),
  ('audit.view', 'View audit logs')
on conflict (permission_key) do update
set
  description = excluded.description,
  updated_at = now();

with matrix(role_code, permission_key) as (
  values
    ('cashier', 'product.view'),
    ('cashier', 'inventory.view'),
    ('cashier', 'sale.create'),
    ('cashier', 'receipt.reprint'),
    ('cashier', 'shift.open'),
    ('cashier', 'shift.close'),
    ('cashier', 'cash.in.create'),
    ('cashier', 'report.daily.view'),

    ('manager', 'product.view'),
    ('manager', 'product.branch_availability.update'),
    ('manager', 'inventory.view'),
    ('manager', 'inventory.adjust'),
    ('manager', 'sale.create'),
    ('manager', 'receipt.reprint'),
    ('manager', 'receipt.void'),
    ('manager', 'shift.open'),
    ('manager', 'shift.close'),
    ('manager', 'cash.in.create'),
    ('manager', 'cash.out.create'),
    ('manager', 'cash.movement.void'),
    ('manager', 'report.daily.generate'),
    ('manager', 'report.daily.view'),
    ('manager', 'audit.view'),

    ('admin', 'product.view'),
    ('admin', 'product.create'),
    ('admin', 'product.update'),
    ('admin', 'product.branch_availability.update'),
    ('admin', 'inventory.view'),
    ('admin', 'inventory.adjust'),
    ('admin', 'sale.create'),
    ('admin', 'receipt.reprint'),
    ('admin', 'receipt.void'),
    ('admin', 'shift.open'),
    ('admin', 'shift.close'),
    ('admin', 'cash.in.create'),
    ('admin', 'cash.out.create'),
    ('admin', 'cash.movement.void'),
    ('admin', 'report.daily.generate'),
    ('admin', 'report.daily.view'),
    ('admin', 'account.manage'),
    ('admin', 'role.manage'),
    ('admin', 'audit.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.access_roles r on r.code = m.role_code
join public.permissions p on p.permission_key = m.permission_key
on conflict (role_id, permission_id) do nothing;
