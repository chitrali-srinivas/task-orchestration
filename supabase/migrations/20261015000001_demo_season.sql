-- Demo data: the Kharif ERW season from the whiteboard. Drop this migration before going live.

insert into survey_templates (id, name, fields) values
  ('registration', 'Registration', '[
    {"key":"name","label":"Farmer name","type":"text"},
    {"key":"mobile","label":"Mobile no","type":"text"}]'),
  ('enrollment', 'Enrollment', '[
    {"key":"land_acres","label":"Land (acres)","type":"number"},
    {"key":"eligible","label":"Eligible for ERW?","type":"select","options":["yes","no"]},
    {"key":"consent","label":"Consent signed","type":"select","options":["yes","no"]}]'),
  ('deployment', 'Deployment', '[
    {"key":"tons","label":"Deployment tons","type":"number"},
    {"key":"date","label":"Deployment date","type":"date"}]'),
  ('engagement_1', 'Engagement 1', '[
    {"key":"visit_date","label":"Visit date","type":"date"},
    {"key":"notes","label":"Notes","type":"text"}]'),
  ('sample_1', 'Sample 1', '[
    {"key":"sample_id","label":"Sample ID","type":"text"},
    {"key":"depth_cm","label":"Depth (cm)","type":"number"}]'),
  ('engagement_2', 'Engagement 2', '[
    {"key":"visit_date","label":"Visit date","type":"date"},
    {"key":"notes","label":"Notes","type":"text"}]'),
  ('sample_2', 'Sample 2', '[
    {"key":"sample_id","label":"Sample ID","type":"text"},
    {"key":"depth_cm","label":"Depth (cm)","type":"number"}]');

insert into seasons (id, name, az_id, start_date, end_date)
values ('11111111-1111-1111-1111-111111111111', 'Kharif_ERW_GPM_012025_11_2030', 'ERW', '2026-06-01', '2026-12-31');

insert into season_rules
  (season_id, position, action, template_id, trigger_type, source_template_id, source_status,
   condition_field, condition_op, condition_value, open_type, open_days, open_date, close_type, close_days, close_date)
values
  ('11111111-1111-1111-1111-111111111111', 1, 'open', 'registration', 'season_start', null, null,
   null, null, null, 'immediately', null, null, 'none', null, null),
  ('11111111-1111-1111-1111-111111111111', 2, 'open', 'enrollment', 'form_status', 'registration', 'collected',
   null, null, null, 'immediately', null, null, 'on_date', null, '2026-12-31'),
  ('11111111-1111-1111-1111-111111111111', 3, 'end', null, 'form_status', 'enrollment', 'collected',
   'eligible', 'eq', 'no', 'immediately', null, null, 'none', null, null),
  ('11111111-1111-1111-1111-111111111111', 4, 'open', 'deployment', 'form_status', 'enrollment', 'approved',
   null, null, null, 'immediately', null, null, 'on_date', null, '2026-12-31'),
  ('11111111-1111-1111-1111-111111111111', 5, 'open', 'engagement_1', 'form_status', 'deployment', 'approved',
   null, null, null, 'after_days', 7, null, 'after_days', 30, null),
  ('11111111-1111-1111-1111-111111111111', 6, 'open', 'sample_1', 'form_status', 'deployment', 'approved',
   null, null, null, 'after_days', 14, null, 'after_days', 30, null),
  ('11111111-1111-1111-1111-111111111111', 7, 'open', 'engagement_2', 'form_status', 'engagement_1', 'approved',
   null, null, null, 'after_days', 30, null, 'after_days', 30, null),
  ('11111111-1111-1111-1111-111111111111', 8, 'open', 'sample_2', 'form_status', 'sample_1', 'approved',
   null, null, null, 'after_days', 30, null, 'after_days', 30, null);

insert into farmers (name, mobile, village, az_id) values
  ('Srinivas', '9800000001', 'Achalpur', 'ERW'),
  ('Ramesh',   '9800000002', 'Achalpur', 'ERW'),
  ('Lakshmi',  '9800000003', 'Paratwada', 'ERW');

-- Starting the season creates the Registration task for every farmer.
update seasons set status = 'active' where id = '11111111-1111-1111-1111-111111111111';
