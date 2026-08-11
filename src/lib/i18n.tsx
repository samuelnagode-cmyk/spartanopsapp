import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "sl" | "en";

type Dict = Record<string, { sl: string; en: string }>;

export const dict: Dict = {
  // Match Pause
  "pauseButtonText": { sl: "PREKINI TEKMO", en: "PAUSE MATCH" },
  "resumeButtonText": { sl: "NADALJUJ TEKMO", en: "RESUME MATCH" },
  "startButtonText": { sl: "ZAČNI MISIJO", en: "START MATCH" },
  "pauseModalTitle": { sl: "// OPERACIJA PREKINJENA", en: "// OPERATION PAUSED" },
  "pauseModalDesc": {
    sl: "Maršal je začasno zamrznil igro. Aktivna telemetrija, števci in protokoli za skeniranje QR kod so do nadaljnjega onemogočeni. Ostanite na svojih trenutnih položajih.",
    en: "The Marshal has temporarily frozen the match. Active telemetry, timers, and QR scanning protocols are suspended until further notice. Remain at your current positions.",
  },

  // Team change forced by marshal
  "teamChangeTitle": {
    sl: "⚠️ POZOR: PRIŠLA JE NOVA KOMANDA",
    en: "⚠️ WARNING: NEW COMMAND RECEIVED",
  },
  "teamChangeAck": { sl: "RAZUMEM IN SE STRINJAM", en: "UNDERSTAND AND AGREE" },

  // Capture Success Popup
  "captureSuccessTitle": { sl: "ODOBRENO", en: "APPROVED" },
  "captureSuccessSubtitle": { sl: "", en: "" },
  "captureAckBtn": { sl: "POTRDI IN NAZAJ V HUD", en: "ACKNOWLEDGE & RETURN TO HUD" },
  "captureTelemetryNote": {
    sl: "// TA SEKTOR ZDAJ PRINAŠA TOČKE VAŠI EKIPI.",
    en: "// THIS SECTOR NOW BRINGS POINTS FOR YOUR TEAM.",
  },

  // GPS acquiring (iOS precise-location prompt)
  "gpsAcquiringNotice": {
    sl: "Pridobivanje natančne GPS lokacije... Prosimo omogočite 'Natančna lokacija' v nastavitvah naprave.",
    en: "Acquiring precise GPS location... Please ensure 'Precise Location' is enabled in your device settings.",
  },
  // HUD tactical notification feed
  "hudNotif.capture": {
    sl: "Igralec {player} je zavzel sektor {sector} za ekipo {team}.",
    en: "Player {player} has captured sector {sector} for {team} team.",
  },
  "hudNotif.captureTitle": { sl: "SEKTOR ZAVZET", en: "SECTOR CAPTURED" },
  "hudNotif.respawn": {
    sl: "Igralec {player} iz ekipe {team} čaka na oživitev.",
    en: "Player {player} from team {team} is waiting for respawn.",
  },
  "hudNotif.respawnTitle": { sl: "ČAKANJE NA OŽIVITEV", en: "AWAITING RESPAWN" },
  "hudNotif.dismiss": { sl: "Zapri obvestilo", en: "Dismiss notification" },

  // HUD tactical history log
  "hudLog.title": { sl: "ZGODOVINA DOGODKOV", en: "EVENT HISTORY" },
  "hudLog.all": { sl: "Vsi dogodki", en: "All events" },
  "hudLog.sectorsOnly": { sl: "Samo sektorji", en: "Sectors only" },
  "hudLog.empty": { sl: "Ni zabeleženih dogodkov.", en: "No events recorded." },
  "hudLog.totalDeaths": { sl: "SKUPAJ SMRTI", en: "TOTAL DEATHS" },

  // In-app QR Scanner (anti-cheat)
  "scanner.hudButton": { sl: "SKENIRAJ TOČKO", en: "SCAN CODE" },

  "scanner.title": { sl: "// TAKTIČNI SKENER", en: "// TACTICAL SCANNER" },
  "scanner.hint": {
    sl: "Poravnaj QR kodo znotraj okvirja.",
    en: "Align the QR code inside the frame.",
  },
  "scanner.close": { sl: "ZAPRI", en: "CLOSE" },
  "scanner.torch": { sl: "BAKLA", en: "TORCH" },
  "scanner.cameraDenied": {
    sl: "Dostop do kamere zavrnjen. Omogoči ga v nastavitvah brskalnika.",
    en: "Camera access denied. Enable it in your browser settings.",
  },
  "scanner.invalidCode": {
    sl: "Neveljavna QR koda za to misijo.",
    en: "Invalid QR code for this mission.",
  },
  "scanner.securityAlert": {
    sl: "VARNOSTNO OPOZORILO: Zajem točke je mogoč le preko vgrajenega skenerja v aplikaciji.",
    en: "SECURITY ALERT: Point capture is only valid via the In-App Scanner.",
  },
  "scanner.outOfRange": {
    sl: "NAPAKA: Niste v dometu točke (največ 15m)!",
    en: "ERROR: Out of range (max 15m)!",
  },
  "scanner.permsTitle": { sl: "DOVOLJENJA ZAVRNJENA", en: "PERMISSIONS DENIED" },
  "scanner.permsBody": {
    sl: "Za igranje moraš v nastavitvah brskalnika omogočiti dostop do GPS lokacije in Kamere. Osveži stran, ko odobriš.",
    en: "You must enable both GPS Location and Camera permissions in your browser settings to continue. Refresh the page once granted.",
  },
  "scanner.permsRetry": { sl: "PONOVI PREVERJANJE", en: "RETRY CHECK" },
  "scanner.cameraPermTitle": { sl: "DOSTOP DO KAMERE", en: "CAMERA ACCESS" },
  "scanner.cameraPermBody": {
    sl: "Za skeniranje QR točk je potreben dostop do kamere. Klikni za omogočitev.",
    en: "Camera access is required for scanning point QR codes. Tap to enable.",
  },
  "scanner.cameraPermGrant": { sl: "OMOGOČI KAMERO", en: "GRANT CAMERA" },
  "scanner.cameraPermOk": { sl: "✓ KAMERA POTRJENA", en: "✓ CAMERA GRANTED" },



  // Print Station
  "print.kicker": { sl: "// ENOTA ZA OSKRBO", en: "// FIELD SUPPLY POST" },
  "print.title": { sl: "TISKARSKA POSTAJA", en: "PRINT STATION" },
  "print.heroTitle": { sl: "Popolni taktični operativni paket in priročnik", en: "Complete Tactical Operation Pack and manual" },
  "print.heroDesc": {
    sl: "Dostopajte do naše uradne oblačne shrambe za prenos poenotenega paketa misijskih sredstev. Vsebuje univerzalne QR kode za vse igralne načine, pristopne kartice za igralski HUD, kartice za Marshal Command Center in univerzalne banerje za respawn ekip, vse v visokokakovostni PDF obliki.",
    en: "Access our official cloud repository to download the unified mission asset bundle. Contains universal QR codes for all game modes, Player HUD Access Cards, Marshal Command Center Cards, and Universal Team Respawn Banners, all provided in high-quality PDF format.",
  },
  "print.accessFiles": { sl: "DOSTOP DO DATOTEK", en: "ACCESS FILES" },
  "printNoticeText": {
    sl: "// OPERATIVNO OBVESTILO: V Google Drive mapi boste našli 2 možnosti za optimalni tisk in pripravo, prilagojeni posebej za vas, vaš klub in vaš poligon:",
    en: "// DEPLOYMENT NOTICE: Inside the Google Drive folder, you will find the 2 options for optimal print and preparation guide tailored specifically for you, your club, and your field:",
  },
  "optionATitle": { sl: "MOŽNOST A: OSNOVNO (Prijazno do proračuna)", en: "OPTION A: BASIC (Budget Friendly)" },
  "optionADesc": {
    sl: "Natisnite na standardni papir velikosti A4 s katerim koli pisarniškim tiskalnikom.",
    en: "Print on standard A4 paper using any office printer.",
  },
  "optionBTitle": { sl: "MOŽNOST B: PRO (Komercialni poligoni)", en: "OPTION B: PRO (Commercial Fields)" },
  "optionBDesc": {
    sl: "Te prenesene datoteke odnesite v lokalno tiskarno.",
    en: "Take these downloaded files to your local print shop.",
  },

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

  // Premium access framework
  "premium.enterKeyPlaceholder": { sl: "VNESI PREMIUM DOSTOPNI KLJUČ", en: "ENTER PREMIUM ACCESS KEY" },
  "premium.modalTitle": { sl: "// PREMIUM DOSTOP", en: "// TRANSMISSION: ENCRYPTED MODULE" },
  "premium.modalDesc": {
    sl: "Ta modul je zaklenjen. Nadgradi na Premium za odklep naprednih taktičnih operacij, poligonov po meri in scenarijev z več ekipami.",
    en: "This module is restricted. Upgrade to Premium to unlock advanced tactical gamemodes, custom functions, and multi-team scenarios.",
  },
  "premium.modalBtn": { sl: "Zahtevaj dostop", en: "Request Access via Command Network" },
  "premium.statusFree": { sl: "[ STATUS: OSNOVNI NIVO ]", en: "[ STATUS: CORE TIER ]" },
  "premium.statusPremium": { sl: "[ STATUS: OPERATIVNI PREMIUM ]", en: "[ STATUS: OPERATIONAL PREMIUM ]" },

  // Marshal actions on Spartacus alert
  "action.warning": { sl: "OPOZORI", en: "SEND WARNING" },
  "warning.modalTitle": { sl: "⚠ OPOZORILO MARŠALA", en: "⚠ MARSHAL WARNING" },
  "warning.modalDesc": {
    sl: "Maršal je zaznal sumljivo aktivnost pri tvojem zadnjem skenu. To je uradno opozorilo. Prosimo, upoštevaj pravila fair-playa in skeniraj kode le v določenem 10-metrskem območju cilja.",
    en: "The Marshal has flagged suspicious activity on your last scan. This is an official warning. Please respect fair-play rules and only scan codes within the 10-metre objective radius.",
  },
  "warning.acknowledge": { sl: "// POTRDI IN NADALJUJ", en: "// ACKNOWLEDGE & ALIGN" },

  // Core tier player cap
  "console.coreTierCap": { sl: "Core tier: največ 30 igralcev.", en: "Core tier: max 30 players." },

  // SpartanOps homepage / landing page
  "spartan.heroTag": { sl: "// TAKTIČNI AIRSOFT HUD SISTEM", en: "// TACTICAL AIRSOFT HUD SYSTEM" },
  "spartan.heroSubtext": { sl: "Spletna aplikacija za spremljanje airsoft spopadov v živo. Prenesite grafike za print za vaše airsoft misije in omogočite igralcem skeniranje QR kod ki jim bodo prinesle zmago.", en: "The ultimate web app for live-tracking airsoft games. Download tactical printouts for your field and let players scan QR codes to secure victory." },
  "spartan.btnCreateMission": { sl: "USTVARI MISIJO", en: "CREATE MISSION" },
  "spartan.btnJoinMission": { sl: "PRIDRUŽI SE MISIJI", en: "JOIN MISSION" },
  "spartan.tagSimplicity": { sl: "// TAKTIČNA PREPROSTOST", en: "// TACTICAL SIMPLICITY" },
  "spartan.titleRevolutionize": { sl: "REVOLUCIJA AIRSOFT MISIJ", en: "REVOLUTIONIZE YOUR AIRSOFT FIELD" },
  "spartan.descProblem": { sl: "Airsoft spopadi so izjemno zabavni, vendar je organizacija in spremljanje ciljev na terenu pogosto tehnično zapleteno. Tradicionalni elektronski rekviziti za sledenje sektorjem v realnem času predstavljajo ogromno finančno breme — še posebej za manjše klube in upravljavce polj.", en: "Airsoft games are incredibly fun, but organizing and tracking objectives on the field is often technically complicated. Traditional electronic props used for real-time sector tracking can be an immense financial burden — especially for smaller clubs and field operators." },
  "spartan.featureZeroElecTitle": { sl: "// BREZ ELEKTRONIKE", en: "// ZERO ELECTRONICS" },
  "spartan.featureZeroElecDesc": { sl: "Brez dragih rekvizitov, brez baterij, brez kablov in brez vzdrževanja. Preprosto natisnite, zaščitite pred vremenom in namestite.", en: "No expensive props, no batteries, no wiring, no maintenance. Just print, weatherproof, and deploy." },
  "spartan.featureLiveTrackingTitle": { sl: "// SLEDENJE V ŽIVO", en: "// LIVE TRACKING" },
  "spartan.featureLiveTrackingDesc": { sl: "Nadzor sektorjev v realnem času, točkovanje v živo in takojnji odziv ob zavzetju za vsakega igralca na terenu.", en: "Real-time sector control, live scoring and instant capture feedback for every player on the field." },
  "spartan.featurePureImmersionTitle": { sl: "// POPOLNA POTOPITEV", en: "// PURE IMMERSION" },
  "spartan.featurePureImmersionDesc": { sl: "Visoko vidne taktične QR tablice in na boj pripravljen HUD, zgrajen za zunanje bojne scenarije.", en: "High-visibility tactical QR plates and a battle-ready HUD built for outdoor combat scenarios." },
  "spartan.btnGetPrintFiles": { sl: "PRIDOBI TISKOVINE", en: "GET PRINT FILES" },
  "spartan.tagLiveOps": { sl: "// SLEDENJE OPERACIJAM V ŽIVO", en: "// LIVE OPS TRACKER" },
  "spartan.titleTelemetry": { sl: "OPERATIVNA TELEMETRIJA", en: "OPERATIONAL TELEMETRY" },
  "spartan.statOperators": { sl: "AKTIVIRANIH OPERATIVCEV", en: "OPERATORS DEPLOYED" },
  "spartan.statQRScanned": { sl: "SKENIRANIH QR KOD", en: "QR CODES SCANNED" },
  "spartan.statRespawns": { sl: "OBDELANIH OŽIVITEV", en: "RESPAWNS PROCESSED" },
  "spartan.statMissions": { sl: "ZAKLJUČENIH MISIJ", en: "MISSIONS COMPLETED" },
  "spartan.tagManual": { sl: "// TERENSKI PRIROČNIK", en: "// FIELD MANUAL" },
  "spartan.titleManual": { sl: "KAKO DELUJE / OPERATIVNI PRIROČNIK", en: "HOW IT WORKS / OPERATIONAL MANUAL" },
  "spartan.descManual": { sl: "Univerzalni QR potek, ki poganja vsako SpartanOps tekmo.", en: "The universal QR flow that powers every SpartanOps match." },
  "spartan.step1Tag": { sl: "KORAK 01 // ZAČETEK OPERACIJE", en: "STEP 01 // COMMENCE OPERATION" },
  "spartan.step1Title": { sl: "PRIDRUŽITE SE LOBBYU", en: "JOIN THE LOBBY" },
  "spartan.step1Desc": { sl: "Poskenirajte QR kodo na kartici igralca (ali se pridružite preko spletne strani), izberite svoj klicni znak (Nickname) in določite svojo frakcijo (RDEČI ali MODRI).", en: "Scan the Player HUD card QR (or join via website), claim your callsign, and pick your faction (RED or BLUE)." },
  "spartan.step2Tag": { sl: "KORAK 02 // AKTIVNA MISIJA", en: "STEP 02 // ACTIVE MISSION" },
  "spartan.step2Title": { sl: "ZAVZEMANJE", en: "ACTIVATE OBJECTIVES" },
  "spartan.step2Desc": { sl: "Premaknite se na spawn mesta. Ko maršal začne igro, je vaša misija poiskati fizične QR točke po terenu in jih poskenirati za sprožitev taktičnih funkcij aktivnega igralnega načina.", en: "Move to spawn points. After the marshal starts the game it is your mission to locate physical QR points across the field and scan them to trigger tactical functions for the active game mode." },
  "spartan.step3Tag": { sl: "KORAK 03 // SLEDENJE", en: "STEP 03 // TRACKING" },
  "spartan.step3Title": { sl: "IGRALNI HUD", en: "PLAYER HUD" },
  "spartan.step3Desc": { sl: "Spremljajte rezultate v živo na svojem HUD zaslonu (heads up display) ter sledite pravilom igre in misijam za dosego zmage.", en: "Track live scores on your Player HUD and follow in-game rules and missions to secure victory." },
  "spartan.tagLogistics": { sl: "// LOGISTIKA", en: "// LOGISTICS" },
  "spartan.titleSupply": { sl: "TERENSKA OSKRBOVALNA TOČKA", en: "FIELD SUPPLY POST" },
  "spartan.descSupply": { sl: "Prenesite grafike pripravljene na tist, oznake sektorjev in pravila igre.", en: "Download ready-to-print field assets, sector markers, and game rules." },
  "spartan.btnAccessPrint": { sl: "DOSTOP DO DATOTEK ZA PRINT", en: "ACCESS PRINT FILES" },
  "spartan.tagLicensing": { sl: "// LICENCE SISTEMA", en: "// SYSTEM LICENSING" },
  "spartan.titlePlans": { sl: "OPERATIVNI NAČRTI", en: "OPERATIONAL PLANS" },
  "spartan.tier1Tag": { sl: "RAZRED 01 // OSNOVNO", en: "TIER 01 // CORE" },
  "spartan.tier1Title": { sl: "BREZPLAČNI RAZRED", en: "FREE TIER" },
  "spartan.tier1Feature1": { sl: "Igralni način Domination (Popoln dostop)", en: "Domination Game Mode (Full Access)" },
  "spartan.tier1Feature2": { sl: "Omejitev igralcev: Do 30 aktivnih igralcev na preddverje", en: "Player Limit: Up to 30 active players per lobby" },
  "spartan.tier1Feature3": { sl: "Standardne frakcije (Klasična postavitev MODRI vs. RDEČI z lastnimi imeni)", en: "Standard Factions (Classic BLUE vs RED team setup with custom names)" },
  "spartan.tier1Feature4": { sl: "Integrirana taktična glasba in zvočni efekti", en: "Integrated Tactical Music & Audio Sound Effects" },
  "spartan.tier1Feature5": { sl: "Popoln nadzor nad tekmo (Premor, zaustavitev in nadzor žive seje)", en: "Full Match Control (Pause, Stop, and Live Session Oversight)" },
  "spartan.tier1Feature6": { sl: "Ročno uravnoteženje ekip in upravljanje postav", en: "Manual Team Balancing & Roster Management" },
  "spartan.tier1Feature7": { sl: "Namestljiva spletna aplikacija (PWA) s prilagoditvijo mobilnim napravam", en: "Downloadable Web App (PWA) with Mobile Responsiveness" },
  "spartan.tier1Feature8": { sl: "Cena: 0 € / Brezplačno za vedno", en: "Cost: €0 / Free Forever" },
  "spartan.btnStartFree": { sl: "ZAČNI BREZPLAČNO OPERACIJO", en: "START FREE OPERATION" },
  "spartan.tier2Tag": { sl: "RAZRED 02 // PREMIUIM", en: "TIER 02 // PREMIUM" },
  "spartan.tier2Title": { sl: "PREMIUM IN PRILAGOJENI MODULI", en: "PREMIUM & CUSTOM MODULES" },
  "spartan.tier2Badge": { sl: "// PRIPOROČENO ZA TERENE", en: "// RECOMMENDED FOR FIELDS" },
  "spartan.tier2Feature1": { sl: "Razširjena omejitev igralcev (30+ igralcev)", en: "Extended Player Limits (30+ players)" },
  "spartan.tier2Feature2": { sl: "Odklep igralnega načina Search & Destroy", en: "Search & Destroy Game Mode unlock" },
  "spartan.tier2Feature3": { sl: "Odklep več ekip (Hkrati aktivirajte 3-5 prilagojenih frakcij za večfrontne operacije)", en: "Multiple Teams unlock (Deploy 3-5 custom factions simultaneously for multi-front operations)" },
  "spartan.tier2Feature4": { sl: "Avtomatsko uravnoteženje ekip z klikom na gumb (Z enim klikom trenutno uravnotežite ekipi glede na izkušnje igralcev)", en: "On-Command Auto-Balancing (Instantly balance teams with one click based on registered player experience levels)" },
  "spartan.tier2Feature5": { sl: "Prilagojena postavitev terena in namenska podoba znamke", en: "Custom field setup & dedicated branding" },
  "spartan.btnRequestPremium": { sl: "ZAHTEVAJ PREMIUM DOSTOP", en: "REQUEST PREMIUM ACCESS" },
  "spartan.systemNotice": { sl: "SISTEMSKO OBVESTILO: Aplikacija SpartanOps je trenutno v aktivnem razvoju. Razvijalci si pridržujejo pravico do spremembe funkcij, razredov in cenovne strukture kadarkoli. Za premium nadgradnje, prilagojeno integracijo terena ali dogodke z veliko kapaciteto kontaktirajte poveljniško omrežje neposredno.", en: "SYSTEM NOTICE: SpartanOps Web App is currently under active development. The developers reserve the right to modify features, tiers, and pricing structures at any time. For premium upgrades, custom field integration, or high-capacity events, please contact command network directly." },
  "spartan.devlogTag": { sl: "// DNEVNIK RAZVOJA", en: "// DEVLOG" },
  "spartan.devlogTitle": { sl: "SISTEMSKE POSODOBITVE", en: "SYSTEM UPDATES" },
  "spartan.devlogSubtext": { sl: "Za najboljšo uporabniško izkušnjo spletno stran stalno testiramo in posodabljamo.", en: "For the best user experience we are constantly testing and updating this website." },
  "spartan.updateScannerDate": { sl: "26. JULIJ 2026", en: "JULY 26, 2026" },
  "spartan.updateScannerTitle": { sl: "NADZOR MISIJ IN INTEGRACIJA QR SKENERJA", en: "MISSION CONTROL AND QR SCANNER INTEGRATION" },
  "spartan.updateScannerDesc": { sl: "Vgrajen je bil neposreden bralnik QR kod za hitrejše delovanje na terenu med samim procesom zajema, dodana pa je bila tudi možnost takojšnje zaustavitve celotne igre z gumbom za premor ter unikatna neposredna povezava (URL) do posamezne misije.", en: "A built-in QR code reader was integrated for faster field operation during the capture process, alongside instant match suspension via a pause button and a unique direct link (URL) to each individual mission." },
  "spartan.updateSeoDate": { sl: "25. JULIJ 2026", en: "JULY 25, 2026" },
  "spartan.updateSeoTitle": { sl: "OPTIMIZACIJA SISTEMA IN NAPREDNI SEO", en: "SYSTEM OPTIMIZATION AND ADVANCED SEO" },
  "spartan.updateSeoDesc": { sl: "Celotna spletna aplikacija je prejela nadgradnjo stabilnosti in odzivnosti uporabniškega vmesnika na vseh mobilnih napravah, hkrati pa je bila izvedena celostna optimizacija za iskalnike za boljšo spletno vidljivost platforme.", en: "The entire web application received a stability and interface responsiveness upgrade across all mobile devices, together with a full search engine optimization pass for better platform visibility." },
  "spartan.updatePrestartDate": { sl: "24. JULIJ 2026", en: "JULY 24, 2026" },
  "spartan.updatePrestartTitle": { sl: "PREUREDITEV PRED-ŠTARTNEGA ZASLONA", en: "PRE-START SCREEN RESTRUCTURE" },
  "spartan.updatePrestartDesc": { sl: "Izvedena je bila popolna reorganizacija strukture informacij pod odštevalnikom časa na pred-štartnem zaslonu, ki igralcem pred začetkom misije sedaj taktično in pregledno prikaže postave ekip, opise nalog ter bojni zemljevid terena.", en: "The information structure below the countdown on the pre-start screen was fully reorganized, now presenting team rosters, mission briefings and the tactical field map clearly before deployment." },
  "spartan.updateBattlefieldDate": { sl: "23. JULIJ 2026", en: "JULY 23, 2026" },
  "spartan.updateBattlefieldTitle": { sl: "NADZOR NAD BOJIŠČEM V POVELJNIŠKEM CENTRU", en: "BATTLEFIELD OVERSIGHT IN THE COMMAND CENTER" },
  "spartan.updateBattlefieldDesc": { sl: "V Marshal poveljniški center je bil implementiran vizualni Spartacus radij delovanja za boljši nadzor nad sektorji, sam center pa je bil nadgrajen s takojšnjim prikazom imena ter telefonske številke trenutnega vodje igre.", en: "A visual Spartacus operating radius was implemented in the Marshal Command Center for tighter sector oversight, with the current marshal's name and phone number now displayed instantly." },
  "spartan.updateAmbientDate": { sl: "22. JULIJ 2026", en: "JULY 22, 2026" },
  "spartan.updateAmbientTitle": { sl: "NAMESTITEV IN INTEGRACIJA NEODVISNEGA ZVOKA", en: "INDEPENDENT AUDIO SYSTEM INTEGRATION" },
  "spartan.updateAmbientDesc": { sl: "Uspešno je bil integriran globalni zvočni sistem Ambient Audio, ki prinaša popolnoma neodvisne kontrolnike za vklop glasbene podlage v lobijih ter bojnih zvočnih efektov, ki se ne prekinjajo med menjavo zaslonov.", en: "The global Ambient Audio system was integrated, delivering fully independent controls for lobby music and combat sound effects that persist uninterrupted across screen changes." },
  "spartan.updateHardGraphicsDate": { sl: "19. JULIJ 2026", en: "JULY 19, 2026" },
  "spartan.updateHardGraphicsTitle": { sl: "ODPORNA GRAFIKA ZA SEKTORSKE TOČKE", en: "HARDENED SECTOR DISPLAY GRAPHICS" },
  "spartan.updateHardGraphicsDesc": { sl: "Uvedene prenovljene fizične tiskovine za nadzorne točke načina Domination z namenskimi stranskimi zaščitnimi paneli, zasnovanimi za zaščito telefonov igralcev pred neposrednimi zadetki BB kroglic med skeniranjem.", en: "Deployed redesigned physical graphics for Domination capture points, featuring dedicated side-panel protection layouts engineered to shield player devices from direct BB impacts during scanning." },
  "spartan.update1Date": { sl: "16. JULIJ 2026", en: "July 16, 2026" },
  "spartan.update1Title": { sl: "SPARTACUS GPS ANTI-CHEAT V1.0", en: "SPARTACUS GPS ANTI-CHEAT V1.0" },
  "spartan.update1Desc": { sl: "Aktiviran modul Spartacus proti goljufanju. Vsaka QR koda cilja se ob prvem legitimnem skenu tekme sidra na stvarne GPS koordinate. Vsak nadaljnji poskus zavzetja, izveden več kot 10 metrov od tega sidra, se takoj označi v Poveljniškem centru maršala — neveljavni skeni se ne štejejo do potrditve.", en: "Deployed the Spartacus anti-cheat module. When enabled by the marshal, every objective QR code is anchored to real-world GPS coordinates on its first legitimate scan of the match. Any subsequent capture attempted more than 10 meters from that anchor is instantly flagged in the Marshal Command Center — fraudulent scans do not count towards the score until manually approved. Physical integrity of the game, secured." },
  "spartan.update2Date": { sl: "12. JULIJ 2026", en: "July 12, 2026" },
  "spartan.update2Title": { sl: "URADNI ZAGON APLIKACIJE // VERZIJA 1.0", en: "OFFICIAL APP LAUNCH // VERSION 1.0" },
  "spartan.update2Desc": { sl: "Čakanja je konec. Po temeljitem terenskem testiranju je uradna aplikacija SpartanOps zaživela. Popolnoma optimizirana, nameščena na namenskem samostojnem omrežju in pripravljena na boj za igralce ter terene po vsem svetu.", en: "The wait is over. After rigorous field testing, the official SpartanOps application is live. Fully optimized, deployed on a dedicated standalone network, and battle-ready for players and fields worldwide." },
  "spartan.update3Date": { sl: "11. JULIJ 2026", en: "July 11, 2026" },
  "spartan.update3Title": { sl: "PRENOVA UPORABNIŠKEGA VMESNIKA NOVE GENERACIJE", en: "NEXT-GEN UI OVERHAUL" },
  "spartan.update3Desc": { sl: "Celoten uporabniški vmesnik je bil preoblikovan od začetka. Zasnovana je bila visoko kontrastna, premium taktična temna tema za največjo berljivost na zunanji svetlobi in v stresnih terenskih scenarijih.", en: "Redesigned the entire user interface from scratch. Engineered a high-contrast, premium tactical dark theme optimized for maximum readability under intense outdoor sunlight and high-stress field scenarios." },
  "spartan.updateAudioDate": { sl: "10. JULIJ 2026", en: "July 10, 2026" },
  "spartan.updateAudioTitle": { sl: "NAMESTITEV ZVOČNE POTOPITVE", en: "AUDIO IMMERSION DEPLOYMENT" },
  "spartan.updateAudioDesc": { sl: "Integrirani potopitveni, filmski glasbeni podlagi in taktični zvočni efekti. Odštevanja, zavzetja baz in dogodki na tekmi zdaj vključujejo popolne zvočne odzive za močno povečanje adrenalina na terenu. V prihodnje bo še nadgrajeno.", en: "Integrated immersive, cinematic soundtracks and tactical audio sound effects. The countdowns, base captures, and match events now feature full audio feedback to dramatically boost adrenaline on the field. Will be updated in the future." },
  "spartan.updateArchitectureDate": { sl: "1. JUNIJ 2026", en: "June 1, 2026" },
  "spartan.updateArchitectureTitle": { sl: "NAČRT SAMOSTOJNE ARHITEKTURE", en: "STANDALONE ARCHITECTURE BLUEPRINT" },
  "spartan.updateArchitectureDesc": { sl: "Presegli prvotne omejitve gostovanja. Zasnovali in izvedli celovit načrt strukturne migracije za preselitev SpartanOps na lasten namenski ekosistem, kar utira pot prihodnjemu masovnemu skaliranju za več igralcev.", en: "Outgrew initial hosting limits. Designed and executed a comprehensive structural migration plan to separate SpartanOps onto its own dedicated ecosystem, paving the way for future massive multiplayer scaling." },
  "spartan.updateQrDate": { sl: "29. MAJ 2026", en: "May 29, 2026" },
  "spartan.updateQrTitle": { sl: "OPTIMIZACIJA JEDRNEGA QR POGONA", en: "CORE QR ENGINE OPTIMIZATION" },
  "spartan.updateQrDesc": { sl: "Uspešno prenovili kodo in odpravili napake pri skeniranju. Temeljito prenovili odzivni krog za zagotovitev trenutne in nemotene obdelave QR kod tudi s slabo mobilno povezavo globoko v gozdnatem terenu.", en: "Successfully refactored and patched underlying scanning bugs. Overhauled the response loop to ensure instantaneous, seamless QR code processing even with poor mobile internet connections deep in forest terrain." },
  "spartan.updateMarshalDate": { sl: "25. MAJ 2026", en: "May 25, 2026" },
  "spartan.updateMarshalTitle": { sl: "POVELJNIŠKI CENTER MARŠALA v1", en: "MARSHAL COMMAND CENTER v1" },
  "spartan.updateMarshalDesc": { sl: "Izdelali glavna nadzorna plošča za vodje iger. Uvedli uravnoteženje ekip v realnem času, ročno pobudo preddverja, nadzor stanja tekme in napredne zmožnosti neposredne povezave.", en: "Engineered the master control board for game masters. Introduced real-time team balancing, manual lobby initialization, match state controls, and advanced direct-connect capabilities." },
  "spartan.updateDemoDate": { sl: "20. MAJ 2026", en: "May 20, 2026" },
  "spartan.updateDemoTitle": { sl: "ZAGON PRVE DEMO VERZIJE", en: "INITIAL DEMO VERSION LAUNCH" },
  "spartan.updateDemoDesc": { sl: "Lansirali prvo delujočo demo verzijo, gostovano neposredno na platformi Spartan Airsoft. Zbrali ključne podatke iz prve faze testiranja z našo primarno skupnostjo.", en: "Launched the very first operational demo version hosted directly on the Spartan Airsoft platform. Gathered vital real-world data from our initial core community testing phase." },
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

export function spartanDevlogEntries(t: (key: string) => string) {
  return [
    { date: t("spartan.updateScannerDate"), title: t("spartan.updateScannerTitle"), body: t("spartan.updateScannerDesc") },
    { date: t("spartan.updateSeoDate"), title: t("spartan.updateSeoTitle"), body: t("spartan.updateSeoDesc") },
    { date: t("spartan.updatePrestartDate"), title: t("spartan.updatePrestartTitle"), body: t("spartan.updatePrestartDesc") },
    { date: t("spartan.updateBattlefieldDate"), title: t("spartan.updateBattlefieldTitle"), body: t("spartan.updateBattlefieldDesc") },
    { date: t("spartan.updateAmbientDate"), title: t("spartan.updateAmbientTitle"), body: t("spartan.updateAmbientDesc") },
    { date: t("spartan.updateHardGraphicsDate"), title: t("spartan.updateHardGraphicsTitle"), body: t("spartan.updateHardGraphicsDesc") },
    { date: t("spartan.update1Date"), title: t("spartan.update1Title"), body: t("spartan.update1Desc") },
    { date: t("spartan.update2Date"), title: t("spartan.update2Title"), body: t("spartan.update2Desc") },
    { date: t("spartan.update3Date"), title: t("spartan.update3Title"), body: t("spartan.update3Desc") },
    { date: t("spartan.updateAudioDate"), title: t("spartan.updateAudioTitle"), body: t("spartan.updateAudioDesc") },
    { date: t("spartan.updateArchitectureDate"), title: t("spartan.updateArchitectureTitle"), body: t("spartan.updateArchitectureDesc") },
    { date: t("spartan.updateQrDate"), title: t("spartan.updateQrTitle"), body: t("spartan.updateQrDesc") },
    { date: t("spartan.updateMarshalDate"), title: t("spartan.updateMarshalTitle"), body: t("spartan.updateMarshalDesc") },
    { date: t("spartan.updateDemoDate"), title: t("spartan.updateDemoTitle"), body: t("spartan.updateDemoDesc") },
  ];
}
