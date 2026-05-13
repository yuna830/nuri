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


alter table location_status
    add column if not exists accuracy double precision;

alter table seniors
    add column if not exists last_login_at timestamp;

alter table seniors
    add column if not exists birth_date date;

alter table health_info
    add column if not exists allergies varchar(255);

