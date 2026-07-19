DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'wl_registered_products'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ~
              '(recall_status|current_use_status|model_match_status|guardian_contact_status|follow_up_progress_status|final_result|recall_decision_status|recall_check_status)'
    LOOP
        EXECUTE format(
            'ALTER TABLE wl_registered_products DROP CONSTRAINT %I',
            constraint_row.conname
        );
    END LOOP;
END $$;

ALTER TABLE wl_registered_products
    ADD CONSTRAINT wl_registered_products_recall_status_check
        CHECK (recall_status IS NULL OR recall_status IN ('UNKNOWN', 'SAFE', 'RECALLED')),
    ADD CONSTRAINT wl_registered_products_current_use_status_check
        CHECK (current_use_status IS NULL OR current_use_status IN ('UNKNOWN', 'IN_USE', 'NOT_IN_USE', 'STOPPED', 'DISPOSED', 'NOT_OWNED')),
    ADD CONSTRAINT wl_registered_products_model_match_status_check
        CHECK (model_match_status IS NULL OR model_match_status IN ('UNKNOWN', 'MATCHED', 'NEEDS_REVIEW', 'NOT_MATCHED')),
    ADD CONSTRAINT wl_registered_products_guardian_contact_status_check
        CHECK (guardian_contact_status IS NULL OR guardian_contact_status IN ('UNKNOWN', 'SCHEDULED', 'COMPLETED', 'UNREACHABLE')),
    ADD CONSTRAINT wl_registered_products_follow_up_progress_status_check
        CHECK (follow_up_progress_status IS NULL OR follow_up_progress_status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'UNREACHABLE', 'DECLINED')),
    ADD CONSTRAINT wl_registered_products_final_result_check
        CHECK (final_result IS NULL OR final_result IN ('USE_STOPPED', 'RECOVERED', 'EXCHANGED', 'REPAIRED', 'REFUNDED', 'NOT_OWNED', 'NOT_RECALLED', 'UNREACHABLE', 'DECLINED')),
    ADD CONSTRAINT wl_registered_products_recall_decision_status_check
        CHECK (recall_decision_status IS NULL OR recall_decision_status IN ('RECALL_CONFIRMED', 'NO_MATCH_FOUND', 'REVIEW_REQUIRED')),
    ADD CONSTRAINT wl_registered_products_recall_check_status_check
        CHECK (recall_check_status IS NULL OR recall_check_status IN ('SUCCESS', 'FAILED', 'NOT_CHECKED'));

ALTER TABLE wl_registered_products
    ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS registration_source VARCHAR(80);
