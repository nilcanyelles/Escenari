-- Factura adjuntada a mà pel gestor (PDF) al bolo, en comptes de generar-la
-- (simplificació del bloc "Client" de Despeses i facturació) — mateix patró
-- que el rebut d'una despesa (transactions.receipt_file_id).
alter table concerts add column if not exists client_invoice_file_id text;
