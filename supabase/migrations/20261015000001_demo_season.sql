-- The season from the whiteboard. Remove this migration before going live.

insert into survey_template_master (id, name, az_id, survey_details) values
  ('Registration_india', 'Registration', 'ERW', '[{"key":"name","label":"Name","type":"text"},{"key":"mobile","label":"Mobile No","type":"text"}]'),
  ('Enrollment_india',   'Enrollment',   'ERW', '[{"key":"land_acres","label":"Land (acres)","type":"number"},{"key":"eligible","label":"Eligible","type":"select","options":["yes","no"]}]'),
  ('Deployment_india',   'Deployment',   'ERW', '[{"key":"tons","label":"Deployment tons","type":"number"},{"key":"date","label":"Deployment date","type":"date"}]'),
  ('Engagement1_india',  'Engagement 1', 'ERW', '[{"key":"visit_date","label":"Visit date","type":"date"},{"key":"notes","label":"Notes","type":"text"}]'),
  ('Sample1_india',      'Sample 1',     'ERW', '[{"key":"sample_id","label":"Sample ID","type":"text"},{"key":"depth_cm","label":"Depth (cm)","type":"number"}]'),
  ('Engagement2_india',  'Engagement 2', 'ERW', '[{"key":"visit_date","label":"Visit date","type":"date"},{"key":"notes","label":"Notes","type":"text"}]'),
  ('Sample2_india',      'Sample 2',     'ERW', '[{"key":"sample_id","label":"Sample ID","type":"text"},{"key":"depth_cm","label":"Depth (cm)","type":"number"}]');

insert into season (id, name, country, az_id, start_date, end_date)
values ('11111111-1111-1111-1111-111111111111', 'Kharif_ERW_GPM_012025_11_2030', 'India, Asia', 'ERW', '2026-06-01', '2026-12-31');

-- The arrows. Status = status of the "from" task that fires it.
insert into season_flow (season_id, position, from_template, to_template, on_status, trigger, trigger_date, validity, valid_from, valid_to) values
  ('11111111-1111-1111-1111-111111111111', 1, null,                 'Registration_india', 'planned',              'immediately', null,         'indefinite', null,         null),
  ('11111111-1111-1111-1111-111111111111', 2, 'Registration_india', 'Enrollment_india',   'pending verification', 'immediately', null,         'indefinite', null,         null),
  ('11111111-1111-1111-1111-111111111111', 3, 'Enrollment_india',   null,                 'discarded',            'immediately', null,         'indefinite', null,         null),
  ('11111111-1111-1111-1111-111111111111', 4, 'Enrollment_india',   'Deployment_india',   'verified',             'date',        '2026-07-01', 'range',      '2026-07-01', '2026-12-31'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Deployment_india',   'Engagement1_india',  'verified',             'date',        '2026-08-01', 'range',      '2026-08-01', '2026-12-31'),
  ('11111111-1111-1111-1111-111111111111', 6, 'Deployment_india',   'Sample1_india',      'verified',             'date',        '2026-08-15', 'range',      '2026-08-15', '2026-12-31'),
  ('11111111-1111-1111-1111-111111111111', 7, 'Engagement1_india',  'Engagement2_india',  'verified',             'date',        '2026-10-01', 'range',      '2026-10-01', '2026-12-31'),
  ('11111111-1111-1111-1111-111111111111', 8, 'Sample1_india',      'Sample2_india',      'verified',             'date',        '2026-10-15', 'range',      '2026-10-15', '2026-12-31');

insert into farmer (name, mobile, village, az_id) values
  ('Srinivas', '9800000001', 'Achalpur', 'ERW'),
  ('Ramesh',   '9800000002', 'Achalpur', 'ERW'),
  ('Lakshmi',  '9800000003', 'Paratwada', 'ERW');

update season set status = 'active' where id = '11111111-1111-1111-1111-111111111111';
