
-- Add ON DELETE CASCADE to all tables referencing contracts
ALTER TABLE signature_audit_logs
  DROP CONSTRAINT IF EXISTS signature_audit_logs_contract_id_fkey;
ALTER TABLE signature_audit_logs
  ADD CONSTRAINT signature_audit_logs_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_contract_id_fkey;
ALTER TABLE documents
  ADD CONSTRAINT documents_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_contract_id_fkey;
ALTER TABLE payments
  ADD CONSTRAINT payments_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE contract_signatures
  DROP CONSTRAINT IF EXISTS contract_signatures_contract_id_fkey;
ALTER TABLE contract_signatures
  ADD CONSTRAINT contract_signatures_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE for contracts referencing clients
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_client_id_fkey;
ALTER TABLE contracts
  ADD CONSTRAINT contracts_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
