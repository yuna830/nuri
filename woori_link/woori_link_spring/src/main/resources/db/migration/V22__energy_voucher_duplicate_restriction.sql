ALTER TABLE wl_energy_voucher_details
    ADD COLUMN IF NOT EXISTS duplicate_support_disqualifying BOOLEAN;
