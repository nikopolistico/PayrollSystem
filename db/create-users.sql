-- Create login accounts. Edit the emails/passwords, then run:
--   npm run sql -- db/create-users.sql
-- Emails must be lowercase. Passwords are bcrypt-hashed by crypt().

-- Admin (safe to re-run: an account that already exists is left unchanged;
-- use "Reset a password" below to change a password)
INSERT INTO app_user (email, password_hash, role)
VALUES ('admin@example.com', crypt('PUT-YOUR-PASSWORD-HERE', gen_salt('bf', 10)), 'admin')
ON CONFLICT (email) DO NOTHING;

-- Employee: the employee row must exist first (link by employee_no)
-- INSERT INTO app_user (email, password_hash, role, employee_id)
-- SELECT 'juan@example.com', crypt('change-me-too', gen_salt('bf', 10)), 'employee', employee_id
--   FROM employee WHERE employee_no = 'EMP001';

-- Reset a password
-- UPDATE app_user SET password_hash = crypt('new-password', gen_salt('bf', 10))
--  WHERE email = 'admin@example.com';
