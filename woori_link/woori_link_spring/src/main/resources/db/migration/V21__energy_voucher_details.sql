CREATE TABLE IF NOT EXISTS wl_energy_voucher_details (
    id BIGSERIAL PRIMARY KEY,
    senior_id BIGINT NOT NULL,
    income_criteria_confirmed BOOLEAN,
    livelihood_benefit_types VARCHAR(500),
    household_characteristic_confirmed BOOLEAN,
    household_characteristics VARCHAR(1000),
    winter_other_energy_support_recipient BOOLEAN,
    other_energy_support_types VARCHAR(1000),
    existing_application_status VARCHAR(30),
    application_year INTEGER,
    application_result VARCHAR(30),
    confirmation_note VARCHAR(2000),
    updated_by_role VARCHAR(30),
    updated_by_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_energy_voucher_detail_senior UNIQUE (senior_id)
);
