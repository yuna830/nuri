ALTER TABLE wl_electricity_discount_details
    ADD COLUMN IF NOT EXISTS current_discount_status VARCHAR(30);

ALTER TABLE wl_electricity_discount_details
    DROP CONSTRAINT IF EXISTS ck_electricity_current_discount_status;

ALTER TABLE wl_electricity_discount_details
    ADD CONSTRAINT ck_electricity_current_discount_status
        CHECK (
            current_discount_status IS NULL
            OR current_discount_status IN (
                'UNKNOWN',
                'NOT_RECEIVING',
                'RECEIVING'
            )
        );
