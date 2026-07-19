ALTER TABLE wl_recall_notices
    ADD COLUMN IF NOT EXISTS action_type VARCHAR(40);

UPDATE wl_recall_notices
SET action_type = CASE
    WHEN consumer_action ~* '즉시.{0,12}(사용.{0,4}(중지|중단)|회수)|사용.{0,4}(중지|중단|금지)' THEN 'IMMEDIATE_STOP'
    WHEN consumer_action ~* '수거|수선|수리' THEN 'REPAIR_OR_COLLECTION'
    WHEN consumer_action ~* '교환|환불' THEN 'EXCHANGE_OR_REFUND'
    WHEN consumer_action ~* '모델|제조.{0,6}(기간|일자|번호)|대상.{0,4}확인|제품.{0,4}확인' THEN 'PRODUCT_CHECK_REQUIRED'
    ELSE 'GENERAL_GUIDANCE'
END
WHERE action_type IS NULL;

ALTER TABLE wl_recall_notices
    DROP CONSTRAINT IF EXISTS wl_recall_notices_action_type_check;

ALTER TABLE wl_recall_notices
    ADD CONSTRAINT wl_recall_notices_action_type_check
        CHECK (action_type IS NULL OR action_type IN (
            'IMMEDIATE_STOP',
            'REPAIR_OR_COLLECTION',
            'EXCHANGE_OR_REFUND',
            'PRODUCT_CHECK_REQUIRED',
            'GENERAL_GUIDANCE'
        ));
