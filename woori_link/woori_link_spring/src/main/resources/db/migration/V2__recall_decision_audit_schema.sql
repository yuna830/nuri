CREATE TABLE IF NOT EXISTS wl_recall_notices (
    id BIGSERIAL PRIMARY KEY, recall_uid VARCHAR(120) NOT NULL UNIQUE,
    product_name VARCHAR(500), brand_name VARCHAR(500), manufacturer_name VARCHAR(500),
    recall_company_name VARCHAR(500), model_names JSONB NOT NULL DEFAULT '[]'::jsonb,
    barcode_numbers JSONB NOT NULL DEFAULT '[]'::jsonb, cert_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
    product_category VARCHAR(500), publish_date DATE, recall_start_date DATE, recall_end_date DATE,
    defect_description TEXT, hazard_description TEXT, consumer_action TEXT, inquiry_tel VARCHAR(500),
    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb, additional_condition_text TEXT,
    has_unstructured_scope_condition BOOLEAN NOT NULL DEFAULT FALSE,
    source_name VARCHAR(300) NOT NULL DEFAULT '국가기술표준원 제품안전정보센터', source_url VARCHAR(1000),
    list_raw_response JSONB, detail_raw_response JSONB, content_hash VARCHAR(64),
    first_synced_at TIMESTAMP NOT NULL, last_synced_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS recall_decision_status VARCHAR(40);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS recall_check_status VARCHAR(40) NOT NULL DEFAULT 'NOT_CHECKED';
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS matched_recall_notice_id BIGINT REFERENCES wl_recall_notices(id);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS recall_decision_reason TEXT;
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS recall_matched_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS recall_missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS barcode VARCHAR(120);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS certification_number VARCHAR(200);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS manufacturing_date DATE;
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS serial_number VARCHAR(200);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS lot_number VARCHAR(200);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS last_successful_checked_at TIMESTAMP;
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS last_check_failed_at TIMESTAMP;
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS last_check_error_code VARCHAR(100);
ALTER TABLE wl_registered_products ADD COLUMN IF NOT EXISTS last_check_error_message TEXT;

CREATE TABLE IF NOT EXISTS wl_product_recall_check_history (
    id BIGSERIAL PRIMARY KEY, registered_product_id BIGINT NOT NULL REFERENCES wl_registered_products(id) ON DELETE CASCADE,
    recall_notice_id BIGINT REFERENCES wl_recall_notices(id), decision_status VARCHAR(40), check_status VARCHAR(40) NOT NULL,
    query_type VARCHAR(40), query_value VARCHAR(500), matched_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    mismatched_fields JSONB NOT NULL DEFAULT '[]'::jsonb, missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    product_snapshot JSONB NOT NULL, candidate_recall_uids JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_reason TEXT, external_result_code VARCHAR(40), external_result_message TEXT,
    error_code VARCHAR(100), error_message TEXT, checked_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wl_product_recall_alerts (
    id BIGSERIAL PRIMARY KEY, registered_product_id BIGINT NOT NULL REFERENCES wl_registered_products(id) ON DELETE CASCADE,
    recall_notice_id BIGINT NOT NULL REFERENCES wl_recall_notices(id), alert_type VARCHAR(80) NOT NULL,
    dry_run BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_product_recall_alert UNIQUE(registered_product_id, recall_notice_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_recall_history_product_checked
    ON wl_product_recall_check_history(registered_product_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_recall_notices_active ON wl_recall_notices(is_active);
