CREATE TABLE IF NOT EXISTS wl_energy_support_profiles (
    id BIGSERIAL PRIMARY KEY,
    senior_id BIGINT NOT NULL,
    basic_livelihood_recipient BOOLEAN,
    near_poverty BOOLEAN,
    disabled_household BOOLEAN,
    national_merit_household BOOLEAN,
    senior_household BOOLEAN,
    infant_household BOOLEAN,
    pregnant_household BOOLEAN,
    single_parent_household BOOLEAN,
    multi_child_household BOOLEAN,
    household_size INTEGER,
    energy_voucher_recipient BOOLEAN,
    heating_energy_type VARCHAR(50),
    updated_by_role VARCHAR(30),
    updated_by_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_energy_support_profile_senior UNIQUE (senior_id),
    CONSTRAINT ck_energy_support_profile_household_size
        CHECK (household_size IS NULL OR household_size >= 1)
);
