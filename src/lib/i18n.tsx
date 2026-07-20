import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "sl" | "en";

type Dict = Record<string, { sl: string; en: string }>;

export const dict: Dict = {
  // Nav
  "nav.glamping": { sl: "Glamping", en: "Glamping" },
  "nav.aktivnosti": { sl: "Aktivnosti", en: "Activities" },
  "nav.zajtrk": { sl: "Zajtrk", en: "Breakfast" },
  "nav.okolica": { sl: "Okolica", en: "Surroundings" },
  "nav.airsoft": { sl: "Airsoft", en: "Airsoft" },
  "nav.dogodki": { sl: "Dogodki", en: "Events" },
  "nav.rezervacije": { sl: "Rezervacije", en: "Reservations" },
  "nav.zemljevid": { sl: "Doživetja v okolici", en: "Map of Vače" },
  "nav.lokacija": { sl: "Lokacija", en: "Location" },
  "nav.galerija": { sl: "Galerija", en: "Gallery" },
  "nav.ocene": { sl: "Ocene", en: "Reviews" },
  "nav.openMenu": { sl: "Odpri meni", en: "Open menu" },
  "nav.home": { sl: "Domov", en: "Home" },
  "nav.back": { sl: "Nazaj", en: "Back" },
  "nav.language": { sl: "Jezik", en: "Language" },
  "nav.pogostaVprasanja": { sl: "Pogosta vprašanja", en: "FAQ" },
  "nav.poligon": { sl: "Poligon Zeleni raj", en: "Zeleni raj field" },
  "nav.zemljevidPoligona": { sl: "Zemljevid poligona", en: "Field map" },
  "nav.aktualniDogodki": { sl: "Aktualni dogodki", en: "Upcoming events" },
  "nav.arhiv": { sl: "Arhiv", en: "Archive" },
  "loc.kicker": { sl: "Lokacija", en: "Location" },
  "loc.title": {
    sl: "Naša lokacija",
    en: "Our location",
  },
  "loc.subtitle": {
    sl: "Le nekaj minut od geometrijskega središča Slovenije (GEOSS).",
    en: "Just a few minutes from the geometric centre of Slovenia (GEOSS).",
  },
  "loc.desc": {
    sl: "V mali vasi polni karakterja — Vače.",
    en: "In a small village full of character — Vače.",
  },
  "home.loc.subtitle": {
    sl: "Skrivamo se na zelenem hribu med Litijo in Moravčami. Naša vrata so na široko odprta za vse – ne glede na to, ali nas obiščete z avtom, motorjem, kolesom ali s pohodniškimi čevlji.",
    en: "We are tucked away on a green hill between Litija and Moravče. Our doors are wide open to everyone — whether you come by car, motorbike, bicycle or in hiking boots.",
  },
  "home.loc.cta": {
    sl: "Navodila za pot",
    en: "Directions",
  },
  "nav.spartanops": { sl: "SpartanOps", en: "SpartanOps" },
  "home.story.kicker": { sl: "NAŠA ZGODBA", en: "OUR STORY" },
  "home.story.p1": {
    sl: "Glamping Zeleni raj je nastal iz želje po prostoru sredi narave, kjer se človek lahko za trenutek ustavi, umiri in odmakne od hitrega ritma vsakdana. Skrit med gozdovi Vač, le nekaj minut od geometrijskega središča Slovenije, ponuja mirno zatočišče z dovolj svobode za sprehode, raziskovanje in počasnejše dneve.",
    en: "Glamping Zeleni raj was born from the wish for a place in nature where one can pause, settle and step away from the fast pace of everyday life. Hidden among the forests of Vače, just minutes from the geometric centre of Slovenia, it offers a quiet retreat with plenty of freedom for walks, exploring and slower days.",
  },
  "home.story.p2": {
    sl: "Okolica ponuja pravo ravnovesje med tišino in pustolovščino — od gozdnih poti in razgledov do skritih kotičkov za počitek. Za zajtrk lahko ob prostovoljnih prispevkih pripravimo izbor domačih in lokalnih dobrot, dober obrok pa najdete tudi v bližnjem bistroju. Pri nas ne gre za luksuz, temveč za iskreno bivanje.",
    en: "The surroundings offer the right balance between quiet and adventure — from forest paths and viewpoints to hidden corners for rest. For breakfast we can prepare a selection of homemade and local treats on a voluntary contribution basis, and a good meal is also waiting at a nearby bistro. With us it isn't about luxury, but about an honest stay.",
  },
  "home.story.more": { sl: "Preberi več", en: "Read more" },
  "home.story.less": { sl: "Manj", en: "Less" },

  // Galerija
  "gal.title": { sl: "Galerija", en: "Gallery" },
  "gal.kicker": { sl: "Utrinki", en: "Moments" },
  "gal.intro": {
    sl: "Utrinki počasnih dni med drevesi.",
    en: "Glimpses of slow days among the trees.",
  },
  "gal.viewAll": { sl: "Poglej galerijo", en: "View the gallery" },
  "gal.teaser.title": { sl: "Trenutki iz Zelenega Raja", en: "Moments from Zeleni Raj" },
  "gal.close": { sl: "Zapri", en: "Close" },
  "gal.prev": { sl: "Prejšnja", en: "Previous" },
  "gal.next": { sl: "Naslednja", en: "Next" },
  "gal.story.kicker": { sl: "Spomini", en: "Memories" },
  "gal.story.title": { sl: "Nastajanje Zelenega Raja", en: "How Zeleni Raj came to life" },
  "gal.story.intro": {
    sl: "Korak za korakom je med gozdom nastajal prostor za mir in oddih.",
    en: "Step by step, a place for stillness slowly took shape among the trees.",
  },
  "gal.story.reflection1": {
    sl: "Najprej zemlja, potem prostor za oddih.",
    en: "First the earth, then a place to rest.",
  },
  "gal.story.reflection2": {
    sl: "Počasi med drevesi.",
    en: "Slowly, among the trees.",
  },
  "gal.story.reflection3": {
    sl: "Veliko ur. Veliko idej.",
    en: "Many hours. Many ideas.",
  },
  "gal.film.kicker": { sl: "Trenutek", en: "A moment" },
  "gal.film.title": { sl: "Tiho povabilo med drevesa", en: "A quiet invitation among the trees" },
  "gal.film.desc": {
    sl: "Nekaj minut miru — kot bi za hip stopili k nam.",
    en: "A few quiet minutes — almost like stepping in for a moment.",
  },
  "gal.film.play": { sl: "Oglej si naš glamping", en: "Step inside our glamping" },
  "common.more": { sl: "Več", en: "More" },
  "common.reserve": { sl: "Rezerviraj", en: "Book now" },
  "common.bookNow": { sl: "Rezerviraj zdaj", en: "Book now" },
  "common.exploreGlamping": { sl: "Razišči glamping", en: "Explore glamping" },
  "common.bookStay": { sl: "Rezerviraj oddih", en: "Book your stay" },

  // Home
  "home.tagline": { sl: "Skrit med gozdovi Vač", en: "Hidden among the forests of Vače" },
  "home.intro": {
    sl: "V zavetju tihega gozda vas čaka pravljičen pobeg iz vsakdanjika.",
    en: "In the shelter of a quiet forest a fairy-tale escape from everyday life awaits you.",
  },
  "home.card.glamping": { sl: "Naši kotički za oddih v naravi", en: "Our little nooks for rest in nature" },
  "home.card.aktivnosti": { sl: "Od skirometov do pikada", en: "From axe-throwing to darts" },
  "home.card.zajtrk": { sl: "Jutra, ki dišijo po domačem", en: "Mornings that smell like home" },
  "home.card.zemljevid": { sl: "Zemljevid pustolovščin", en: "Adventure map" },
  "home.card.zemljevidDesc": {
    sl: "Tukaj si lahko ogledate dogodivščine, ki vam jih ponuja naša okolica.",
    en: "Here you can explore the adventures our surroundings offer.",
  },
  "home.card.dogodki": {
    sl: "Mirni večeri, prijetna družba in trenutki, ki povezujejo.",
    en: "Quiet evenings, good company and moments that bring people together.",
  },
  "home.testimonial": {
    sl: "Všeč mi je bil sprejem, mir, družba drugih popotnikov, zajtrk, skrb za moje dobro počutje in prijeten spanec.",
    en: "I loved the welcome, the peace, the company of other travellers, the breakfast, the care for my well-being and the lovely sleep.",
  },
  "home.testimonial.author": { sl: "— Nina, Slovenija", en: "— Nina, Slovenia" },
  "home.cta.title": { sl: "Rezervirajte svoj oddih", en: "Reserve your stay" },
  "home.cta.subtitle": {
    sl: "Za rezervacijo in dodatne informacije smo vam z veseljem na voljo — odgovorimo vam isti dan.",
    en: "I reply the same day. We're happy to help with bookings and any questions you may have.",
  },
  "testimonials.title": { sl: "Ocene", en: "Reviews" },
  "footer.follow": { sl: "SLEDITE ZGODBI", en: "FOLLOW THE STORY" },
  "footer.contact": { sl: "Kontakt", en: "Contact" },
  "footer.followUs": { sl: "Sledite nam", en: "Follow us" },
  "footer.rights": {
    sl: "© 2025 Glamping Zeleni raj. Vse pravice pridržane.",
    en: "© 2025 Glamping Zeleni raj. All rights reserved.",
  },
  "footer.slogan": { sl: "Skrit med gozdovi Vač", en: "Hidden among the forests of Vače" },
  "footer.reviews": { sl: "Ocene", en: "Reviews" },
  "footer.spartan.collab": { sl: "V sodelovanju s Spartan Airsoft", en: "Powered by Spartan Airsoft" },

  // Zemljevid
  "zemljevid.title": { sl: "Zemljevid pustolovščin", en: "Adventure map" },
  "zemljevid.subtitle": {
    sl: "Tukaj si lahko ogledate dogodivščine, ki vam jih ponuja naša okolica.",
    en: "Here you can explore the adventures our surroundings offer.",
  },
  "zemljevid.intro": {
    sl: "Okolica Vač skriva čudovite gozdne poti, razglede in zanimive zgodbe, ki jih lahko odkrijete med svojim oddihom.",
    en: "The Vače area hides wonderful forest paths, views and interesting stories to discover during your stay.",
  },
  "zemljevid.invite": {
    sl: "Kliknite na sliko za podroben ogled okolice Vač",
    en: "Click the image for a detailed view of the Vače area",
  },
  "zemljevid.tagline": {
    sl: "Oglejte si tudi razglede med krošnjami",
    en: "Take in the views among the treetops too",
  },
  "zemljevid.mapLabel": {
    sl: "Okolica Vač",
    en: "Around Vače",
  },
  "zemljevid.geoss.title": {
    sl: "Pustolovski park GEOSS",
    en: "GEOSS Adventure Park",
  },
  "zemljevid.geoss.desc": {
    sl: "Park GEOSS vam ponuja adrenalinsko doživetje med drevesnimi krošnjami, razgledi in plezalnimi izzivi, ki jih ne boste zlahka pozabili. Zip-line spusti, viseči mostovi in različne plezalne poti poskrbijo za aktivno izkušnjo v naravi za posameznike, pare in družine.\n\nGostom Glampinga Zeleni Raj je ob predložitvi rezervacijske številke na voljo 15 % popust pri nakupu vstopnic v parku GEOSS. Popust velja ob nakupu v parku.",
    en: "GEOSS Adventure Park offers an adrenaline-filled experience among the treetops, with views and climbing challenges you won't easily forget. Zip-line descents, hanging bridges and various climbing trails ensure an active nature experience for individuals, couples and families.\n\nGuests of Glamping Zeleni Raj receive a 15 % discount on ticket purchases at GEOSS Park when presenting their reservation number. The discount applies when purchasing at the park.",
  },
  "zemljevid.geoss.cta": {
    sl: "Obišči park",
    en: "Visit the park",
  },

  // Glamping
  "glamping.title": { sl: "Glamping", en: "Glamping" },
  "glamping.subtitle": { sl: "Vaš drugi dom med drevesi", en: "Your second home among the trees" },
  "glamping.intro": {
    sl: "Vsaka enota je zasnovana z mislijo na preprostost, udobje in stik z naravo — vsaka s svojim značajem, vse z istim namenom: da se ustavite.",
    en: "Each unit is designed with simplicity, comfort and a connection to nature in mind — each with its own character, all with the same purpose: for you to pause.",
  },
  "glamping.shared.title": { sl: "Piknik prostor & kuhinja", en: "Picnic area & kitchen" },
  "glamping.shared.desc": {
    sl: "Skupni prostor je srce glampinga. Opremljena kuhinja, jedilnica za lačne pohodnike, pikado, metanje sekire, in pogovori ob ognju.",
    en: "The shared space is the heart of the glamping. Equipped kitchen, dining for hungry hikers, darts, axe-throwing, and conversations by the fire.",
  },
  "glamping.rules": { sl: "Hišni red", en: "House rules" },
  "glamping.notifyMe": { sl: "Obvestite me o odprtju", en: "Notify me at opening" },
  "glamping.comingSoon": { sl: "Prihaja junij 2025", en: "Coming June 2025" },

  // Aktivnosti
  "akt.title": { sl: "Aktivnosti", en: "Activities" },
  "akt.subtitle": { sl: "Od jutra do mraka je tukaj veliko za doživeti", en: "From dawn to dusk there's plenty to experience" },
  "akt.intro": { sl: "Na glampingu ali v okolici — vi izberete tempo.", en: "At the glamping or nearby — you set the pace." },
  "akt.note": { sl: "Vse aktivnosti so na voljo po predhodnem dogovoru.", en: "All activities are available by prior arrangement." },
  "akt.digital.title": { sl: "Digitalna zgodovina okolice", en: "Digital history of the area" },
  "akt.digital.desc": {
    sl: "Podtodogodbe.si je avdio vodnik, ki vas popelje skozi zgodovino vasi Vače in okolice. Slušajte zgodbe o situlah, Ilirih in skritih zakladih — med hojo po gozdnih poteh.",
    en: "Podtodogodbe.si is an audio guide through the history of Vače village and its surroundings. Listen to stories of situlae, Illyrians and hidden treasures — while walking the forest trails.",
  },
  "akt.more.title": { sl: "Želite doživeti več?", en: "Want to experience more?" },
  "akt.more.desc": { sl: "Oglejte si tudi znamenitosti v okolici.", en: "Have a look at sights in the surroundings." },
  "akt.exploreOkolica": { sl: "Razišči okolico", en: "Explore the surroundings" },
  "akt.act.skiromet": { sl: "Skiromet", en: "Axe throwing" },
  "akt.act.skiromet.d": { sl: "Ciljajte na tarče sredi gozda", en: "Aim at targets in the forest" },
  "akt.act.airsoft": { sl: "Airsoft tarče", en: "Airsoft targets" },
  "akt.act.airsoft.d": { sl: "Streljanje v tarče (ne boji se, ne boli)", en: "Shooting at targets (don't worry, no pain)" },
  "akt.act.pikado": { sl: "Pikado", en: "Darts" },
  "akt.act.pikado.d": { sl: "Klasika za vse starosti", en: "A classic for all ages" },
  "akt.act.balincki": { sl: "Balinčkanje", en: "Pétanque" },
  "akt.act.balincki.d": { sl: "Sprostite se na zelenici", en: "Relax on the lawn" },
  "akt.act.board": { sl: "Board games", en: "Board games" },
  "akt.act.board.d": { sl: "Za deževne večere ali po želji", en: "For rainy evenings or whenever you like" },

  // Okolica
  "okolica.title": { sl: "Okolica", en: "Surroundings" },
  "okolica.subtitle": { sl: "Vse je na dosegu rok. Oziroma nog.", en: "Everything is within reach. Or a short walk away." },
  "okolica.sights": { sl: "Znamenitosti v bližini", en: "Nearby sights" },
  "okolica.outdoors.title": { sl: "Kolesarjenje, pohodništvo, opazovanje zvezd", en: "Cycling, hiking, stargazing" },
  "okolica.outdoors.desc": {
    sl: "Okolica ponuja neskončne možnosti za aktivno preživljanje časa v naravi.",
    en: "The area offers endless options for active time in nature.",
  },
  "okolica.reserve": { sl: "Rezerviraj pobeg", en: "Book your escape" },
  "okolica.distance.drive": { sl: "min vožnje", en: "min drive" },
  "okolica.distance.walk": { sl: "min hoje", en: "min walk" },
  "okolica.distance.village": { sl: "V vasi", en: "In the village" },

  // Airsoft
  "airsoft.title": { sl: "Taktični scenariji med gozdovi Vač", en: "Tactical scenarios in the forests of Vače" },
  "airsoft.subtitle": {
    sl: "Organizirani scenariji za posameznike in klube.",
    en: "Organised scenarios for individuals and clubs.",
  },
  "airsoft.poligon.p1": {
    sl: "Airsoft poligon Zeleni raj leži pri vasi Vače — v geografskem središču Slovenije, približno 45 minut iz Ljubljane. Dogodke in scenarije redno organizira klub SPARTAN, ki skrbi tudi za urejenost terena. Poligon je namenjen vsem klubom, ekipam in posameznikom z lastno opremo, ki uživajo v tem adrenalinskem športu.",
    en: "The Zeleni raj airsoft field lies near the village of Vače — in the geographic centre of Slovenia, about 45 minutes from Ljubljana. Events and scenarios are regularly organised by the SPARTAN club, which also maintains the terrain. The field is open to all clubs, teams and individuals with their own gear who enjoy this adrenaline sport.",
  },
  "airsoft.poligon.p2": {
    sl: "Zbori potekajo na piknik prostoru glampinga Zeleni raj — ob toplih pijačah in prijetni družbi. Po pripravi se odpravimo navzgor, kjer se nad travnikom razteza naš gozdno-travniški teren. SPARTAN poskrbi, da je poligon vedno pripravljen na dobro bitko: z barikadami, bunkerji in skrivališči, ki igralcem prinašajo svobodo in zabavo. Igro vodi eden ali več izkušenih maršalov, ki skrbijo za pošteno in uravnoteženo dinamiko.",
    en: "Gatherings take place at the picnic area of Glamping Zeleni raj — with hot drinks and good company. After briefing we head uphill, where our forest-meadow terrain stretches above the field. SPARTAN ensures the field is always ready for a good battle: with barricades, bunkers and hiding spots that give players freedom and fun. The game is led by one or more experienced marshals who keep the dynamic fair and balanced.",
  },
  "airsoft.poligon.p3": {
    sl: "Po spopadu vedno pride premirje. Na piknik prostoru zapečemo na žaru ali v peči za pico, spijemo kaj mrzlega in podoživimo akcijo. Vsako leto pripravimo tudi nekaj večjih dogodkov — o njih te predčasno obvestimo preko e-maila. Če iščeš družbo za scenarije, se nam lahko pridružiš preko obrazca spodaj.",
    en: "After the battle comes the truce. At the picnic area we fire up the grill or pizza oven, share a cold drink and relive the action. Each year we also host several larger events — we'll let you know about them by email in advance. If you're looking for a crew for scenarios, you can join us via the form below.",
  },
  "airsoft.poligon.readMore": { sl: "PREBERI VEČ", en: "READ MORE" },
  "airsoft.poligon.readLess": { sl: "PREBERI MANJ", en: "READ LESS" },
  "airsoft.about": {
    sl: "Poligon Zeleni raj je dom airsoft dogodkov v osrčju slovenskega gozda. Gostimo organizirane igre, team buildinge in tematske scenarije.",
    en: "Zeleni raj range is home to airsoft events in the heart of the Slovenian forest. We host organized games, team buildings and themed scenarios.",
  },
  "airsoft.rental": { sl: "Oprema na izposojo po dogovoru.", en: "Equipment available for rent upon arrangement." },
  "airsoft.spartan": { sl: "Klub SPARTAN", en: "SPARTAN Club" },
  "airsoft.spartanDesc": { sl: "Poligon redno gostimo dogodke kluba SPARTAN.", en: "The range regularly hosts events of the SPARTAN club." },
  "airsoft.spartan.line": {
    sl: "Dogodke in scenarije na poligonu redno organizira tudi klub SPARTAN.",
    en: "Events and scenarios at the field are also regularly organized by the SPARTAN club.",
  },
  "airsoft.join.kicker": { sl: "Skupnost", en: "Community" },
  "airsoft.join.title": { sl: "Iščeš ekipo?", en: "Looking for a team?" },
  "airsoft.join.body": {
    sl: "Če iščeš ekipo ali te zanima sodelovanje pri organiziranih scenarijih, nam lahko pišeš tukaj.",
    en: "If you're looking for a team or interested in joining organized scenarios, you can write to us here.",
  },
  "airsoft.food.title": { sl: "Po spopadih — čas za hrano", en: "After the battle — time to eat" },
  "airsoft.food.desc": { sl: "Ko se dim usede, se vžge žar. Ali pa peč za pico. Igralci izbirate.", en: "When the smoke settles, the grill fires up. Or the pizza oven. Players choose." },
  "airsoft.cta.title": {
    sl: "Organizirajte svoj airsoft dan na poligonu Zeleni raj",
    en: "Organize your airsoft day at Zeleni raj range",
  },
  "airsoft.cta.body": {
    sl: "Poligon je namenjen airsoft ekipam, klubom in posameznikom. Poleg rednih dogodkov je možen tudi najem poligona ali organizacija dogodka po dogovoru.",
    en: "The range is intended for airsoft teams, clubs and individuals. Besides regular events, field rental and event organization are available by arrangement.",
  },
  "airsoft.events.title": { sl: "Prihajajoči dogodki", en: "Upcoming events" },
  "airsoft.events.body": {
    sl: "Redni woodland scenariji, organizirane igre in dogodki na poligonu.",
    en: "Regular woodland scenarios, organised games and events on the field.",
  },
  "airsoft.events.cta": { sl: "Odpri koledar dogodkov", en: "Open events calendar" },

  // Airsoft gallery
  "airsoft.gallery.kicker": { sl: "Iz terena", en: "From the field" },
  "airsoft.gallery.title": { sl: "Med drevesi, ekipami in tišino pred kontaktom", en: "Among trees, teams and the silence before contact" },
  "airsoft.gallery.intro": {
    sl: "Izbrani utrinki iz preteklih scenarijev — gozd, gibanje in atmosfera pravega terena.",
    en: "Selected moments from past scenarios — forest, movement and the atmosphere of real terrain.",
  },
  "airsoft.gallery.empty": { sl: "Fotografije bodo dodane kmalu.", en: "Photos will be added soon." },
  "airsoft.archive.cta.note": {
    sl: "Celoten arhiv spopadov si lahko ogledate spodaj.",
    en: "The full archive of scenarios is available below.",
  },
  "airsoft.archive.cta.button": { sl: "Odpri arhiv spopadov", en: "Open scenario archive" },
  "airsoft.archive.kicker": { sl: "Dokumentacija", en: "Documentation" },
  "airsoft.archive.title": { sl: "Arhiv spopadov", en: "Scenario archive" },
  "airsoft.archive.intro": {
    sl: "Fotografije, scenariji in utrinki iz preteklih dogodkov na poligonu Zeleni Raj.",
    en: "Photographs, scenarios and moments from past events at the Zeleni Raj field.",
  },
  "airsoft.archive.empty": { sl: "Galerija še v pripravi", en: "Gallery in preparation" },
  "airsoft.archive.view": { sl: "Odpri arhiv", en: "Open archive" },
  "airsoft.archive.back": { sl: "Nazaj na Airsoft", en: "Back to Airsoft" },
  "airsoft.archive.highlights.title": { sl: "Izbrani utrinki", en: "Selected highlights" },
  "airsoft.archive.highlights.meta": { sl: "Iz različnih let", en: "Across the years" },
  "airsoft.archive.events.title": { sl: "Arhiv spopadov", en: "Scenario archive" },
  "airsoft.archive.list.title": { sl: "Arhiv spopadov", en: "Scenario archive" },
  "airsoft.archive.list.footnote": {
    sl: "Klikni dogodek za ogled galerije",
    en: "Tap an event to view its gallery",
  },
  "airsoft.archive.events.count": { sl: "vpisov", en: "entries" },

  // Dogodki
  "dogodki.title": { sl: "Koledar dogodkov", en: "Events calendar" },
  "dogodki.subtitle": { sl: "Pridružite se nam na enem od prihajajočih dogodkov.", en: "Join us at one of the upcoming events." },
  "dogodki.empty": { sl: "Trenutno ni dogodkov v tej kategoriji.", en: "No events in this category at the moment." },
  "dogodki.cat.all": { sl: "Vsi", en: "All" },
  "dogodki.cat.airsoft": { sl: "Airsoft", en: "Airsoft" },
  "dogodki.cat.glamping": { sl: "Glamping", en: "Glamping" },
  "dogodki.cat.local": { sl: "Lokalno", en: "Local" },

  // Zajtrk
  "zajtrk.title": { sl: "Zajtrk", en: "Breakfast" },
  "zajtrk.subtitle": { sl: "Počasna jutra, obdana z naravo", en: "Slow mornings surrounded by nature" },
  "zajtrk.p1": {
    sl: "Jutra v Glamping Zeleni Raj so počasna, mirna in obdana z naravo. Gostom nudimo preprost domač zajtrk na osnovi prostovoljnih prispevkov.",
    en: "Mornings at Glamping Zeleni Raj are slow, peaceful and surrounded by nature. We offer guests a simple homemade breakfast on a voluntary contribution basis.",
  },
  "zajtrk.p2": {
    sl: "V kuhinji vas pričakajo osnovne sestavine za pripravo zajtrka, kot so jajca, kruh, čebula in hrenovke, poleg tega pa tudi čaji, kava, med, začimbe in druge malenkosti za prijeten začetek dneva. Trudimo se uporabljati domače in lokalne sestavine, del ponudbe pa po potrebi dopolnimo z izdelki lokalnih ponudnikov.",
    en: "In the kitchen you'll find basic ingredients for breakfast such as eggs, bread, onions and sausages, plus teas, coffee, honey, spices and other small things for a pleasant start. We try to use homemade and local ingredients, supplemented by products from local providers when needed.",
  },
  "zajtrk.p3": {
    sl: "Zajtrk si lahko pripravite sami in ga ob jutranjem miru odnesete tudi na katerikoli kotiček glampinga — med drevesa, na razgledno točko ali pa ga pojeste kar v piknik prostoru.",
    en: "You can prepare your breakfast and take it to any corner of the glamping in the morning calm — among the trees, to a viewpoint, or eat it in the picnic area.",
  },
  "zajtrk.cta": { sl: "Rezerviraj svoje mirno jutro", en: "Book your peaceful morning" },

  // Rezervacije
  "rez.title": { sl: "Rezervirajte vaš pobeg", en: "Book your escape" },
  "rez.subtitle": { sl: "Izpolnite obrazec in odgovorimo vam isti dan.", en: "Fill in the form and we'll reply the same day." },
  "rez.thanks": { sl: "Hvala za vaše povpraševanje.", en: "Thank you for your inquiry." },
  "rez.thanksMsg": { sl: "Odgovorimo vam isti dan oziroma v najkrajšem možnem času.", en: "We'll get back to you the same day, or as soon as possible." },
  "rez.name": { sl: "Ime in priimek *", en: "Full name *" },
  "rez.email": { sl: "Email *", en: "Email *" },
  "rez.phone": { sl: "Telefon", en: "Phone" },
  "rez.arrival": { sl: "Datum prihoda", en: "Arrival date" },
  "rez.departure": { sl: "Datum odhoda", en: "Departure date" },
  "rez.adults": { sl: "Odrasli", en: "Adults" },
  "rez.children": { sl: "Otroci", en: "Children" },
  "rez.unit": { sl: "Nastanitev", en: "Accommodation" },
  "rez.unit.comfort": { sl: "Velika koča", en: "Large cottage" },
  "rez.unit.mala": { sl: "Mala koča", en: "Small cottage" },
  "rez.unit.luna": { sl: "Šotor Luna", en: "Luna tent" },
  "rez.extras": { sl: "Dodatne aktivnosti", en: "Extra activities" },
  "rez.message": { sl: "Sporočilo", en: "Message" },
  "rez.submit": { sl: "Pošlji povpraševanje", en: "Send inquiry" },
  "rez.booking": {
    sl: "Cene nastanitev si lahko ogledate tudi na Booking.com. Za direktne rezervacije preko obrazca ali telefona pa so cene praviloma približno 15 % nižje.",
    en: "You can also view accommodation prices on Booking.com. For direct reservations via the form or phone, prices are usually approximately 15 % lower.",
  },
};

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "sl",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("sl");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang") as Lang | null;
      if (saved === "sl" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useLang();
  return (key: string) => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang] ?? entry.sl ?? key;
  };
}
