-- YouTube live feed channels
-- handle       : primary key, URL-safe identifier (e.g. "aljazeera-english")
-- active        : whether the channel appears in the dropdown
-- display_name  : label shown in the dropdown (e.g. "Al Jazeera")
-- language      : "english" | "arabic" | "french"
-- video_id      : YouTube live stream video ID (11-char string)
-- channel_id    : YouTube channel ID (UCxxxxxx) for live-stream search fallback
-- country       : ISO 3166-1 alpha-2 country code

create table if not exists youtube_channels (
  handle        text primary key,
  active        boolean not null default true,
  display_name  text not null,
  language      text not null check (language in ('english', 'arabic', 'french')),
  video_id      text not null,
  channel_id    text,
  country       text not null default 'XX',
  is_live       boolean not null default false,
  live_video_id text,
  live_checked_at timestamptz
);

-- Seed with initial channels
-- channel_id values are YouTube UCxxxxxx IDs used for search.list fallback
insert into youtube_channels (handle, active, display_name, language, video_id, channel_id, country) values
  ('aljazeera-english',   true, 'Al Jazeera',      'english', 'coYw-eVU0Ks', 'UCNye-wNBqNL5ZzHSJj3l8Bg', 'QA'),
  ('aljazeera-arabic',    true, 'Al Jazeera',      'arabic',  'XWq5kBlakcQ', 'UCBvxne1gOCby3mkBVgOhfSA', 'QA'),
  ('aljadeed-arabic',     true, 'Al Jadeed',       'arabic',  'bwZCCbMuFcs', null,                        'LB'),
  ('lbc-arabic',          true, 'LBC',             'arabic',  'lFhKnNmBmSU', null,                        'LB'),
  ('skynews-arabic',      true, 'Sky News Arabia', 'arabic',  'lZ1n4lFLWOE', 'UCDbiiEGaG6JNeRGg2SVzVFg', 'AE'),
  ('france24-english',    true, 'France 24',       'english', 'h3MuIUNCCzI', 'UCQfwfsi5VrQ8yKZ-UWmAEFg', 'FR'),
  ('france24-arabic',     true, 'France 24',       'arabic',  'hEzL2Ytxix0', 'UCrsBIEC0bJKmFaFnXpV3Xhg', 'FR'),
  ('france24-french',     true, 'France 24',       'french',  'gn-x7GeBkgs', 'UCSMEa1bKXIXwEfEYNaANi9Q', 'FR')
on conflict (handle) do nothing;
