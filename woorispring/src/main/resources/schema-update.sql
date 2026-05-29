alter table seniors
    add column if not exists profile_image_url varchar(255);

alter table seniors
    add column if not exists disability_type varchar(255);

create table if not exists climate_alerts (
    id bigserial primary key,
    senior_id bigint,
    event_id varchar(255),
    type varchar(255),
    level varchar(255),
    message varchar(1000),
    region varchar(255),
    source varchar(255),
    alert_date date,
    issued_at timestamp,
    created_at timestamp,
    constraint uk_climate_alert_senior_event unique (senior_id, event_id)
);

create index if not exists idx_climate_alerts_senior_date
    on climate_alerts (senior_id, alert_date, issued_at desc);

alter table health_info
    add column if not exists medications_json text;

alter table seniors
    add column if not exists last_login_at timestamp;


alter table location_status
    add column if not exists accuracy double precision;

alter table police_missing_alerts
    alter column photo_url type text;

alter table seniors
    add column if not exists birth_date date;

alter table health_info
    add column if not exists allergies varchar(255);

alter table health_info
    add column if not exists income_level varchar(255);

alter table health_info
    add column if not exists household_type varchar(255);

alter table health_info
    add column if not exists current_benefits text;

alter table health_info
    add column if not exists welfare_memo text;

alter table health_info
    add column if not exists rest_need varchar(255);

alter table health_info
    add column if not exists avoid_environment text;

alter table alerts
    add column if not exists image_url varchar(255);

create table if not exists job_matching_feedback (
    id bigserial primary key,
    senior_id bigint,
    label varchar(255),
    source varchar(255),
    job_id varchar(255),
    title varchar(255),
    organization varchar(255),
    job_type varchar(255),
    work_environment varchar(255),
    physical_intensity varchar(255),
    daily_hours varchar(255),
    commute_level varchar(255),
    closed boolean,
    task_tags text,
    work_days text,
    work_condition text,
    rule_score integer,
    rule_grade varchar(255),
    ml_prediction varchar(255),
    ml_score integer,
    ml_probabilities_json text,
    health_status varchar(255),
    medicine_count varchar(255),
    walking_aid varchar(255),
    recent_fall varchar(255),
    max_hours varchar(255),
    max_distance varchar(255),
    disabled_work text,
    disease_text text,
    hope_job_type text,
    hope_condition text,
    created_at timestamp
);

create index if not exists idx_job_matching_feedback_senior_created
    on job_matching_feedback (senior_id, created_at desc);


alter table seniors
    add column if not exists active boolean default true;

alter table seniors
    add column if not exists welfare_worker_id bigint;

alter table guardians
    add column if not exists active boolean default true;

alter table welfare_workers
    add column if not exists active boolean default true;

create table if not exists rag_documents (
    document_id varchar(64) primary key,
    filename varchar(500) not null,
    title varchar(500),
    source varchar(255),
    status varchar(50) not null,
    qdrant_collection varchar(255),
    text_length integer default 0,
    chunk_count integer default 0,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

create table if not exists rag_ingest_jobs (
    job_id varchar(64) primary key,
    document_id varchar(64) not null,
    filename varchar(500) not null,
    status varchar(50) not null,
    total_chunks integer default 0,
    processed_chunks integer default 0,
    saved_count integer default 0,
    cache_hit_count integer default 0,
    cache_miss_count integer default 0,
    error_message text,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

create index if not exists idx_rag_ingest_jobs_document_id
    on rag_ingest_jobs (document_id);

create table if not exists rag_public_welfare_jobs (
    job_id varchar(64) primary key,
    status varchar(50) not null,
    start_page integer not null,
    end_page integer not null,
    current_page integer not null,
    num_of_rows integer not null,
    delay_seconds integer default 0,
    processed_pages integer default 0,
    saved_documents integer default 0,
    saved_chunks integer default 0,
    error_message text,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);
