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



alter table seniors
    add column if not exists active boolean default true;

alter table seniors
    add column if not exists welfare_worker_id bigint;

alter table guardians
    add column if not exists active boolean default true;

alter table welfare_workers
    add column if not exists active boolean default true;
