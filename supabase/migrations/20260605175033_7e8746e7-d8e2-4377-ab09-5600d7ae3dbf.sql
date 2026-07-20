
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  category text NOT NULL CHECK (category IN ('airsoft','glamping','local')),
  image_url text,
  title_sl text NOT NULL,
  title_en text NOT NULL,
  description_sl text NOT NULL,
  description_en text NOT NULL,
  details_sl text,
  details_en text,
  location text,
  registration_sl text,
  registration_en text,
  note_sl text,
  note_en text,
  icon text NOT NULL DEFAULT 'sparkle',
  tone text NOT NULL DEFAULT 'sage',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.events (date, category, image_url, title_sl, title_en, description_sl, description_en, details_sl, details_en, location, registration_sl, registration_en, note_sl, note_en, icon, tone) VALUES
('2026-05-30','local',NULL,
 'Turnir odbojke na mivki','Beach Volleyball Tournament',
 'Sproščena sobota na mivki — turnir, hrana, pijača in DJ glasba.',
 'A relaxed Saturday on the sand — tournament, food, drinks and DJ music.',
 'Ekipe po 3 osebe, v vsaki vsaj 1 ženska. Prijave do 28. maja 2026 oz. do zapolnitve mest.',
 'Teams of three, with at least one woman per team. Sign-ups close on 28 May 2026 or once spots fill.',
 'Slivna',
 'Prijavnina 20 EUR na ekipo · 031 837 960 · Facebook: Vaška mladina',
 'Entry 20 EUR per team · 031 837 960 · Facebook: Vaška mladina',
 NULL, NULL, 'volley','amber'),
('2026-07-04','local',NULL,
 'Gasilska veselica Vače','Vače Firefighters'' Festivity',
 'Tradicionalna gasilska veselica z glasbo, druženjem in toplim lokalnim vzdušjem.',
 'A traditional firefighters'' festivity with music, company and warm local atmosphere.',
 NULL,NULL,'Vače',NULL,NULL,NULL,NULL,'flame','clay'),
('2026-07-25','glamping',NULL,
 'Poker turnir','Poker Tournament',
 'Večer pokra, druženja in sproščenega vzdušja v naravi.',
 'An evening of poker, company and a relaxed atmosphere in nature.',
 NULL,NULL,'Glamping Zeleni Raj',
 'Prijave: 070 761 455 · možno do 7 dni pred dogodkom.',
 'Sign up at 070 761 455 · open until 7 days before the event.',
 'Stregle se bodo pice in koktejli.','Pizzas and cocktails will be served.','spade','fern'),
('2026-08-29','glamping',NULL,
 'Board Game Night','Board Game Night',
 'Prijeten večer družabnih iger, pic in koktejlov v toplem ambientu.',
 'A cosy evening of board games, pizzas and cocktails in a warm setting.',
 NULL,NULL,'Glamping Zeleni Raj',
 'Prijava je možna do 7 dni pred dogodkom.',
 'Open until 7 days before the event.',
 'Stregle se bodo pice in koktejli.','Pizzas and cocktails will be served.','dice','sand'),
('2026-09-05','glamping',NULL,
 'Piknik Savemo','Savemo Picnic',
 'Privatni dogodek v sproščenem ambientu Glamping Zeleni Raj.',
 'A private gathering in the relaxed atmosphere of Glamping Zeleni Raj.',
 NULL,NULL,'Glamping Zeleni Raj',NULL,NULL,
 'Dogodek je zaprt za zunanje obiskovalce.','This event is closed to outside visitors.','sparkle','sage');
