CREATE TABLE IF NOT EXISTS wl_electricity_discount_details (
    id BIGSERIAL PRIMARY KEY,
    senior_id BIGINT NOT NULL,
    uses_electricity BOOLEAN,
    electricity_provider VARCHAR(100),
    customer_number VARCHAR(100),
    contractor_name VARCHAR(100),
    address_same BOOLEAN,
    service_address VARCHAR(255),
    recent_bill_checked BOOLEAN,
    welfare_eligible BOOLEAN,
    note VARCHAR(1000),
    updated_by_role VARCHAR(30),
    updated_by_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_electricity_discount_detail_senior UNIQUE (senior_id)
);
