-- Codi d'accés per enllaç del formulari de regidor: sense codi (null) es
-- comporta com fins ara (l'enllaç sol basta); amb codi, cal introduir-lo a
-- la pantalla d'avís abans de veure el formulari — vegeu
-- verifyShareLinkAccessCodeAction i ShareLinkGate.tsx.
alter table share_links add column if not exists access_code text;
alter table share_links add column if not exists code_expires_at timestamptz;
