-- YouTube live feed channels
-- handle       : primary key, URL-safe identifier (e.g. "aljazeera-english")
-- active        : whether the channel appears in the dropdown
-- display_name  : label shown in the dropdown (e.g. "Al Jazeera")
-- language      : "english" | "arabic" | "french"
-- video_id      : YouTube live stream video ID (11-char string)

create table if not exists youtube_channels (
  handle        text primary key,
  active        boolean not null default true,
  display_name  text not null,
  language      text not null check (language in ('english', 'arabic', 'french')),
  video_id      text not null
);

-- Seed with initial channels
insert into youtube_channels (handle, active, display_name, language, video_id) values
  ('aljazeera-english',   true, 'Al Jazeera',      'english', 'coYw-eVU0Ks'),
  ('aljazeera-arabic',    true, 'Al Jazeera',      'arabic',  'XWq5kBlakcQ'),
  ('aljadeed-arabic',     true, 'Al Jadeed',       'arabic',  'bwZCCbMuFcs'),
  ('lbc-arabic',          true, 'LBC',             'arabic',  'lFhKnNmBmSU'),
  ('skynews-arabic',      true, 'Sky News Arabia', 'arabic',  'lZ1n4lFLWOE'),
  ('france24-english',    true, 'France 24',       'english', 'h3MuIUNCCzI'),
  ('france24-arabic',     true, 'France 24',       'arabic',  'hEzL2Ytxix0'),
  ('france24-french',     true, 'France 24',       'french',  'gn-x7GeBkgs')
on conflict (handle) do nothing;
