/** Privacy notice and terms of use, both languages. Version 2026-10. */
export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: [string, string, string]; rows: [string, string, string][] }
  | { kind: "controller" };
export type LegalSection = { title: string; blocks: LegalBlock[] };
export type Lang = "sl" | "en";

export const LEGAL_UPDATED: Record<Lang, string> = {
  en: "Last updated 10 October 2026 · Version 2026-10",
  sl: "Zadnja posodobitev 10. oktobra 2026 · Različica 2026-10",
};

export const CONTROLLER_LINE: Record<Lang, (name: string, address: string) => string> = {
  en: (n, a) => (n && a ? `SpartanOps is operated by ${n}, ${a}.` : "SpartanOps."),
  sl: (n, a) => (n && a ? `SpartanOps upravlja ${n}, ${a}.` : "SpartanOps."),
};

export const PRIVACY: Record<Lang, { title: string; description: string; sections: LegalSection[] }> = {
  en: {
    title: "Privacy notice",
    description: "How SpartanOps handles player profile data: what we collect, who sees it, how long we keep it and your rights.",
    sections: [
      { title: "Who is responsible", blocks: [{ kind: "controller" }, { kind: "p", text: "For anything about your data, write to info@spartanopsapp.com." }] },
      { title: "What we collect and why", blocks: [{ kind: "table", head: ["Data", "Purpose", "Legal basis (GDPR)"], rows: [
        ["Email and password (the password is stored hashed by our sign-in provider)", "Create and secure your account", "Contract (Art. 6(1)(b))"],
        ["Callsign, first name", "Show who is going to an event", "Contract (Art. 6(1)(b))"],
        ["Age group (16–17 / 18+)", "Decide which features are available to you", "Legitimate interest: protecting minors (Art. 6(1)(f))"],
        ["Surname (optional)", "Helps organisers know who is coming; other players see it only if you allow", "Consent (Art. 6(1)(a))"],
        ["Phone number (optional)", "Contact for the organiser or other players going, only as you choose for each event", "Consent (Art. 6(1)(a))"],
        ["Car pool details (optional): role, town, seats, note", "Help players travel together", "Consent (Art. 6(1)(a))"],
        ["Club, experience, operator type, loadout text (optional)", "Introduce yourself to other players", "Consent (Art. 6(1)(a))"],
        ["Your answers to events (going / maybe, your choices)", "Run the events calendar", "Contract (Art. 6(1)(b))"],
        ["Technical logs (IP address, time)", "Security and abuse prevention", "Legitimate interest (Art. 6(1)(f))"],
      ] }] },
      { title: "Who can see what", blocks: [{ kind: "list", items: [
        "Visitors who are not signed in: only how many people are going.",
        "Signed-in players with a profile: callsign, first name and surname initial, club, experience, operator type and loadout of the players going to an event. A full surname only if that player allowed it. Phone and car pool details only if that player chose to share them with other players, and only for adults.",
        "The organiser of the event (the field): everything above, plus the full surname if entered, and the phone number if it was shared with the organiser or with players.",
        "Nobody else. We do not sell personal data and do not use it for advertising.",
      ] }] },
      { title: "How long we keep it", blocks: [{ kind: "p", text: "Your profile until you delete it. Your answers to events are kept as your attendance history until you delete your profile. Phone and car pool details are hidden 3 days after the event and deleted soon after." }] },
      { title: "Organisers", blocks: [{ kind: "p", text: "An organiser receives your data only to run the event you joined. Organisers are responsible for how they handle it and must not use it for anything else." }] },
      { title: "Your rights", blocks: [{ kind: "p", text: "You can ask for access, correction, deletion, restriction, a copy of your data (portability) and you can object. You can withdraw consent at any time, for example by changing your choice for an event or removing your phone number. Most of this you can do yourself on the Player profile page (edit, download, delete). You can complain to the Information Commissioner of the Republic of Slovenia (Informacijski pooblaščenec, www.ip-rs.si)." }] },
      { title: "Who processes data for us", blocks: [{ kind: "p", text: "Our hosting, database and email providers process data on our behalf. Where data leaves the European Economic Area, they rely on standard contractual clauses or equivalent safeguards." }] },
      { title: "Age", blocks: [{ kind: "p", text: "You can create a profile from age 16. Surname, phone number and car pool are available to adults only." }] },
      { title: "On your device", blocks: [{ kind: "p", text: "We store your sign-in session and language choice on your device. If you play a game, we also store your game session, your field access and your sound settings there, so you can rejoin without typing everything again. To display the site, fonts are loaded from Google Fonts and some images from Cloudinary; both receive your IP address. We do not use advertising or analytics cookies." }] },
      { title: "Changes", blocks: [{ kind: "p", text: "If we change this notice in a meaningful way, we ask you to confirm it again the next time you sign in." }] },
    ],
  },
  sl: {
    title: "Obvestilo o zasebnosti",
    description: "Kako SpartanOps ravna s podatki igralskega profila: kaj zbiramo, kdo jih vidi, kako dolgo jih hranimo in tvoje pravice.",
    sections: [
      { title: "Kdo je odgovoren", blocks: [{ kind: "controller" }, { kind: "p", text: "Za vsa vprašanja o tvojih podatkih piši na info@spartanopsapp.com." }] },
      { title: "Katere podatke zbiramo in zakaj", blocks: [{ kind: "table", head: ["Podatek", "Namen", "Pravna podlaga (GDPR)"], rows: [
        ["E-pošta in geslo (geslo ponudnik prijave shrani zgoščeno)", "Ustvarjanje in zaščita računa", "Izvajanje pogodbe (6(1)(b))"],
        ["Vzdevek, ime", "Prikaz, kdo pride na dogodek", "Izvajanje pogodbe (6(1)(b))"],
        ["Starostna skupina (16–17 / 18+)", "Določa, katere funkcije so ti na voljo", "Zakoniti interes: varstvo mladoletnikov (6(1)(f))"],
        ["Priimek (neobvezno)", "Organizatorju pomaga vedeti, kdo pride; drugim igralcem je viden le, če dovoliš", "Privolitev (6(1)(a))"],
        ["Telefonska številka (neobvezno)", "Stik z organizatorjem ali drugimi igralci, le kot izbereš pri vsakem dogodku", "Privolitev (6(1)(a))"],
        ["Podatki o skupnem prevozu (neobvezno): vloga, kraj, prosta mesta, opomba", "Pomoč igralcem pri skupnem prevozu", "Privolitev (6(1)(a))"],
        ["Klub, izkušnje, vrsta orožja, opis opreme (neobvezno)", "Predstavitev drugim igralcem", "Privolitev (6(1)(a))"],
        ["Tvoji odgovori na dogodke (pridem / morda, tvoje izbire)", "Delovanje koledarja dogodkov", "Izvajanje pogodbe (6(1)(b))"],
        ["Tehnični zapisi (IP-naslov, čas)", "Varnost in preprečevanje zlorab", "Zakoniti interes (6(1)(f))"],
      ] }] },
      { title: "Kdo kaj vidi", blocks: [{ kind: "list", items: [
        "Obiskovalci brez prijave: samo število prijavljenih.",
        "Prijavljeni igralci s profilom: vzdevek, ime in začetnico priimka, klub, izkušnje, vrsto orožja in opis opreme igralcev, ki pridejo na dogodek. Celoten priimek le, če ga je igralec dovolil. Telefon in podatke o prevozu le, če jih je igralec izbral za deljenje z drugimi igralci, in to le polnoletnim.",
        "Organizator dogodka (poligon): vse zgoraj, poleg tega celoten priimek, če je vnesen, in telefon, če je deljen z organizatorjem ali z igralci.",
        "Nihče drug. Osebnih podatkov ne prodajamo in jih ne uporabljamo za oglaševanje.",
      ] }] },
      { title: "Kako dolgo hranimo", blocks: [{ kind: "p", text: "Profil, dokler ga ne izbrišeš. Odgovori na dogodke se hranijo kot tvoja zgodovina udeležb, dokler ne izbrišeš profila. Telefon in podatki o prevozu so skriti 3 dni po dogodku in kmalu zatem izbrisani." }] },
      { title: "Organizatorji", blocks: [{ kind: "p", text: "Organizator prejme tvoje podatke samo za izvedbo dogodka, na katerega si se prijavil. Za ravnanje s podatki je odgovoren organizator in jih ne sme uporabiti za druge namene." }] },
      { title: "Tvoje pravice", blocks: [{ kind: "p", text: "Zahtevaš lahko dostop, popravek, izbris, omejitev obdelave in kopijo podatkov (prenosljivost), podaš pa lahko tudi ugovor. Privolitev lahko kadar koli prekličeš, na primer s spremembo izbire pri dogodku ali z odstranitvijo telefonske številke. Večino tega narediš sam na strani Igralski profil (urejanje, prenos, izbris). Pritožbo lahko vložiš pri Informacijskem pooblaščencu Republike Slovenije (www.ip-rs.si)." }] },
      { title: "Kdo obdeluje podatke za nas", blocks: [{ kind: "p", text: "Podatke v našem imenu obdelujejo ponudniki gostovanja, podatkovne baze in e-pošte. Če podatki zapustijo Evropski gospodarski prostor, ponudniki uporabljajo standardne pogodbene klavzule ali enakovredne zaščitne ukrepe." }] },
      { title: "Starost", blocks: [{ kind: "p", text: "Profil lahko ustvariš pri starosti 16 let ali več. Priimek, telefonska številka in skupni prevoz so na voljo samo polnoletnim." }] },
      { title: "V tvoji napravi", blocks: [{ kind: "p", text: "V napravi hranimo tvojo prijavo in izbiro jezika. Če igraš igro, tam hranimo tudi tvojo sejo igre, dostop do poligona in nastavitve zvoka, da se lahko vrneš brez ponovnega vnosa. Za prikaz strani se pisave nalagajo od Google Fonts, nekatere slike pa od Cloudinary; oba prejmeta tvoj IP-naslov. Oglaševalskih ali analitičnih piškotkov ne uporabljamo." }] },
      { title: "Spremembe", blocks: [{ kind: "p", text: "Če obvestilo bistveno spremenimo, te ob naslednji prijavi prosimo, da ga ponovno potrdiš." }] },
    ],
  },
};

export const TERMS: Record<Lang, { title: string; description: string; sections: LegalSection[] }> = {
  en: {
    title: "Terms of use",
    description: "The rules for using SpartanOps: organisers, player profiles, car pool and what is not allowed.",
    sections: [
      { title: "What SpartanOps is", blocks: [{ kind: "p", text: "SpartanOps is a platform where airsoft fields run games and publish events, and players find them. We do not organise the games listed here." }] },
      { title: "Organisers", blocks: [{ kind: "p", text: "The organiser is responsible for the accuracy of the listing, safety, insurance, age rules and compliance with local law. Players take part at their own risk and follow the organiser's rules." }] },
      { title: "Your profile", blocks: [{ kind: "p", text: "Give true information. One person, one profile. Do not pretend to be someone else." }] },
      { title: "Not allowed", blocks: [{ kind: "p", text: "Buying or selling weapons, hate speech and harassment, publishing other people's personal data, spam, and anything illegal." }] },
      { title: "Car pool", blocks: [{ kind: "p", text: "SpartanOps only helps players find each other. Rides are arranged between players, at their own responsibility. Share costs only; do not offer paid transport as a business. SpartanOps is not a party to any ride." }] },
      { title: "Removal", blocks: [{ kind: "p", text: "We may remove content or accounts that break these rules." }] },
      { title: "The service", blocks: [{ kind: "p", text: "SpartanOps is in beta and may change." }] },
      { title: "Contact", blocks: [{ kind: "p", text: "info@spartanopsapp.com" }] },
    ],
  },
  sl: {
    title: "Pogoji uporabe",
    description: "Pravila uporabe SpartanOps: organizatorji, igralski profili, skupni prevoz in kaj ni dovoljeno.",
    sections: [
      { title: "Kaj je SpartanOps", blocks: [{ kind: "p", text: "SpartanOps je platforma, na kateri poligoni vodijo igre in objavljajo dogodke, igralci pa jih najdejo. Iger, objavljenih tukaj, ne organiziramo mi." }] },
      { title: "Organizatorji", blocks: [{ kind: "p", text: "Organizator odgovarja za točnost objave, varnost, zavarovanje, starostna pravila in skladnost z lokalno zakonodajo. Igralci se udeležijo na lastno odgovornost in upoštevajo pravila organizatorja." }] },
      { title: "Tvoj profil", blocks: [{ kind: "p", text: "Vnašaj resnične podatke. En človek, en profil. Ne predstavljaj se kot nekdo drug." }] },
      { title: "Ni dovoljeno", blocks: [{ kind: "p", text: "Kupovanje ali prodajanje orožja, sovražni govor in nadlegovanje, objava tujih osebnih podatkov, neželena sporočila in vse, kar je protizakonito." }] },
      { title: "Skupni prevoz", blocks: [{ kind: "p", text: "SpartanOps igralcem le pomaga, da se najdejo. Prevoze se dogovorite med seboj, na lastno odgovornost. Delite samo stroške; plačljivega prevoza ne ponujajte kot dejavnosti. SpartanOps ni stranka nobenega prevoza." }] },
      { title: "Odstranitev", blocks: [{ kind: "p", text: "Vsebine ali račune, ki kršijo ta pravila, lahko odstranimo." }] },
      { title: "Storitev", blocks: [{ kind: "p", text: "SpartanOps je v beta različici in se lahko spremeni." }] },
      { title: "Stik", blocks: [{ kind: "p", text: "info@spartanopsapp.com" }] },
    ],
  },
};
