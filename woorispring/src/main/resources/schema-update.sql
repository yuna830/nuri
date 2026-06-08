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

create table if not exists assistant_conversations (
    id bigserial primary key,
    senior_id bigint not null,
    title varchar(100) not null default '새 대화',
    created_at timestamp not null default current_timestamp,
    last_message_at timestamp not null default current_timestamp
);

create index if not exists idx_assistant_conversations_senior_last_message
    on assistant_conversations (senior_id, last_message_at desc);

create table if not exists assistant_messages (
    id bigserial primary key,
    conversation_id bigint not null,
    role varchar(20) not null,
    content text not null,
    created_at timestamp not null default current_timestamp,
    constraint fk_assistant_messages_conversation
        foreign key (conversation_id)
        references assistant_conversations (id)
        on delete cascade,
    constraint assistant_messages_role_check
        check (role in ('USER', 'ASSISTANT'))
);

create index if not exists idx_assistant_messages_conversation_created
    on assistant_messages (conversation_id, created_at);



alter table seniors
    add column if not exists active boolean default true;

alter table seniors
    add column if not exists welfare_worker_id bigint;

alter table guardians
    add column if not exists active boolean default true;

alter table welfare_workers
    add column if not exists active boolean default true;

create table if not exists admins (
    admin_id bigserial primary key,
    name varchar(50) not null,
    phone varchar(20) not null,
    email varchar(255) not null unique,
    login_id varchar(20),
    password varchar(255) not null,
    status varchar(20) not null default 'PENDING',
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp,
    constraint admins_status_check
        check (status in ('PENDING', 'APPROVED', 'REJECTED'))
);

alter table admins
    add column if not exists login_id varchar(20);

create unique index if not exists uk_admins_login_id_lower
    on admins (lower(login_id))
    where login_id is not null;

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

create table if not exists missing_report_images (
                                                     id bigserial primary key,
                                                     missing_report_id bigint not null,
                                                     image_url varchar(500) not null,
    sort_order integer not null default 0,
    created_at timestamp not null default current_timestamp,
    constraint fk_missing_report_images_report
    foreign key (missing_report_id)
    references missing_reports (id)
    on delete cascade
    );

create index if not exists idx_missing_report_images_report
    on missing_report_images (missing_report_id, sort_order, id);

insert into missing_report_images (missing_report_id, image_url, sort_order)
select id, image_url, 0
from missing_reports
where image_url is not null
  and image_url <> ''
  and not exists (
    select 1
    from missing_report_images mri
    where mri.missing_report_id = missing_reports.id
      and mri.image_url = missing_reports.image_url
);