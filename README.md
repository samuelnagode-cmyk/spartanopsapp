# SpartanOps app v2.0

# GLAMPING ZELENI RAJ — Popolni Lovable Prompt

> **Domena:** glampingzeleniraj.si  
> **Slogan:** Oddih. Narava. Domačnost.  
> **Jeziki:** Slovenščina (primarni) + Angleščina

---

## 1. KREATIVNI BRIEF

### 1.1 O projektu

Glamping Zeleni raj je butični glamping v Vačah (30 min iz Ljubljane), sredi gozda z razgledom na okoliške griče. Ponuja 2 leseni hiški + bell šotor "Luna" (prihaja junij 2025). Poleg glampinga lokacija gosti tudi airsoft poligon.

### 1.2 Ciljna publika

| Segment | Opis |
|---------|------|
| **Pari** | Romantični pobeg, mir, narava |
| **Družine** | Aktivnosti, raziskovanje okolice |
| **Skupine** | Team buildingi, rojstni dnevi, "službene zabave" |
| **Airsoft igralci** | Organizirani eventi na poligonu |
| **Lokalna skupnost** | Vaški dogodki, lokalni koledar |

### 1.3 Ton komunikacije

- **Vikanje** (spoštljivo, a toplo)
- **Sproščen, domač** — kot bi prišel k prijatelju na podeželje
- **Ne preveč formalen** — brez korporativnega jezika
- **Poetičen pri opisih narave**, praktičen pri informacijah

### 1.4 Občutek spletne strani

```
KLJUČNE BESEDE:
- Naraven
- Rustikalen (a ne pretiran)
- Domač
- Prijeten
- Sproščen
- Preprost / pregleden
- "Manj je več"
```

### 1.5 Barvna paleta (iz loga)

```css
:root {
  /* Primarne barve */
  --zelena-gozd: #4A7C59;       /* Temno zelena (smreke) */
  --zelena-svetla: #7BA882;     /* Svetlejša zelena */
  --zelena-mint: #A8C5B5;       /* Mint / megla */
  
  /* Akcenti */
  --oranžna-sonce: #E07A3D;     /* Topla oranžna (sonce v logu) */
  --zlata-luna: #E8D5A3;        /* Zlato-bež (luna, zvezde) */
  
  /* Ozadje */
  --krem: #F5F0E6;              /* Topla krem (papir) */
  --bež: #E8E0D0;               /* Svetla bež */
  
  /* Tekst */
  --rjava-temna: #3D3226;       /* Temno rjava za tekst */
  --rjava-srednja: #6B5D4D;     /* Srednja rjava za sekundarni tekst */
  
  /* Airsoft sekcija — rahlo temnejši/tactical */
  --airsoft-ozadje: #2C3E2D;    /* Temno gozdna */
  --airsoft-akcent: #8B9A6B;    /* Military zelena */
  --airsoft-tekst: #E8E0D0;     /* Svetel tekst */
}
```

### 1.6 Tipografija

```css
/* Naslovi — rustikalen, naraven karakter */
font-family: 'Playfair Display', 'Cormorant Garamond', serif;

/* Telo teksta — berljiv, topel */
font-family: 'Source Sans Pro', 'Lato', sans-serif;

/* Akcenti/gumbi — lahko rahlo bolj robusten */
font-family: 'Josefin Sans', 'Montserrat', sans-serif;
```

---

## 2. INFORMACIJSKA ARHITEKTURA

### 2.1 Navigacija (Header)

```
[LOGO]   Glamping | Aktivnosti | Kulinarika | Okolica | Airsoft | Dogodki | Rezervacije   [SL/EN]
```

### 2.2 Struktura strani

```
├── DOMOV (/)
│   ├── Hero sekcija (fullscreen slika + slogan + CTA)
│   ├── Kratka predstavitev (2-3 stavki)
│   ├── 3x kartica (Glamping / Aktivnosti / Kulinarika)
│   ├── Testimonial slider (iz Bookinga)
│   ├── CTA: Rezervacija
│   └── Footer
│
├── GLAMPING (/glamping)
│   ├── Intro tekst
│   ├── 3x Nastanitvena enota (kartica z galerijo)
│   │   ├── Comfort Hiška (12m²)
│   │   ├── Mala Hiška (7m²)
│   │   └── Šotor Luna (NOVO — junij 2025)
│   ├── Skupni prostori (kuhinja, kopalnica, piknik)
│   ├── Hišni red (accordion/expandable)
│   └── CTA: Rezervacija
│
├── AKTIVNOSTI (/aktivnosti)
│   ├── Intro
│   ├── Aktivnosti na lokaciji
│   │   ├── Skiromet
│   │   ├── Airsoft streljanje v tarče
│   │   ├── Pikado
│   │   ├── Balinčkanje
│   │   └── Board games
│   ├── Podtodogodbe.si sekcija
│   │   └── "Digitalna izkušnja z avdio zgodbami, ki vas popeljejo na zgodovinsko pot."
│   │   └── [Gumb: Razišči podtodogodbe.si]
│   └── Zemljevid doživetij (slika + legenda)
│
├── KULINARIKA (/kulinarika)
│   ├── Intro (domača hrana, lokalni izdelki)
│   ├── Zajtrk (vključen)
│   │   └── Jajca, čebula, paradižnik (sezonsko), svež domač kruh
│   ├── Po dogovoru
│   │   ├── Pica iz lesne peči (Cozze peč) — POUDAREK!
│   │   ├── Obare
│   │   ├── Palačinke
│   │   └── Shejki
│   └── CTA: Kontaktirajte za kulinarično ponudbo
│
├── OKOLICA (/okolica)
│   ├── Zemljevid doživetij (interaktivna slika)
│   ├── Seznam znamenitosti z razdaljami
│   │   ├── GEOSS — Geometrično središče Slovenije
│   │   ├── Gostilna Vrabec / Pri Situli
│   │   ├── Fosilna morska obala
│   │   ├── Grad Ljubek
│   │   ├── Vaška situla
│   │   ├── Zasavska Sveta gora
│   │   └── Adrenalinski park GEOSS
│   └── Kolesarjenje, pohodništvo, opazovanje zvezd
│
├── AIRSOFT POLIGON (/airsoft)
│   ├── Hero (temnejši, "tactical" stil)
│   ├── O poligonu
│   │   └── "Poligon Zeleni raj gosti airsoft dogodke sredi gozda."
│   ├── Povezava s klubom SPARTAN
│   │   └── Instagram: @spartan_airsoft_slovenija
│   ├── Oprema na izposojo (po dogovoru)
│   ├── Po spopadih — hrana!
│   │   └── "Po bitki vas čaka žar ali pica iz peči."
│   ├── Prihajajoči dogodki (dinamičen seznam)
│   └── CTA: Kontakt za organizacijo dogodka
│
├── DOGODKI (/dogodki)
│   ├── Koledar dogodkov
│   │   ├── Airsoft eventi
│   │   ├── Poker night
│   │   ├── Koktejl night
│   │   ├── Vaški dan
│   │   └── Lokalni dogodki
│   ├── Filtriranje po kategoriji
│   └── Admin panel za dodajanje (zaščiten z geslom)
│
├── GALERIJA (/galerija)
│   ├── Grid slik z lightbox prikazom
│   ├── Kategorije: Glamping / Narava / Aktivnosti / Airsoft / Hrana
│   └── Video embed (poletni posnetki)
│
├── REZERVACIJE (/rezervacije)
│   ├── Kontaktni obrazec
│   │   ├── Ime in priimek*
│   │   ├── Email*
│   │   ├── Telefon
│   │   ├── Datum prihoda — Datum odhoda
│   │   ├── Število oseb (odrasli + otroci)
│   │   ├── Izbira enote (dropdown: Comfort / Mala / Luna)
│   │   ├── Dodatne aktivnosti (checkboxi)
│   │   └── Sporočilo
│   ├── Kontaktni podatki
│   │   ├── Email: samuel.nagode@gmail.com
│   │   ├── Telefon/SMS/WhatsApp: 070 761 455
│   │   └── Naslov: Vače 49, 1252 Vače
│   ├── Info: "Odgovorim isti dan"
│   ├── Alternativa: "Cene si lahko ogledate tudi na Booking.com"
│   │   └── [Gumb: Booking.com] (sekundaren stil)
│   └── Google Maps embed
│
└── FOOTER (na vseh straneh)
    ├── Logo + slogan
    ├── Kontakt (email, telefon, naslov)
    ├── Socialna omrežja
    │   ├── Instagram: @glampingzeleniraj
    │   └── Facebook: Glamping Zeleni Raj
    ├── Povezave (Glamping, Aktivnosti, Rezervacije, Airsoft)
    ├── Booking.com ocena badge
    ├── Google Reviews badge
    └── © 2025 Glamping Zeleni raj
```

---

## 3. DIZAJNERSKE SMERNICE

### 3.1 Splošni principi

```
✓ MANJ JE VEČ — čisto, pregledno, veliko belega prostora
✓ Informacije na zahtevo — uporabi accordione, modalne okna, "Več" gumbe
✓ Fotografije so glavne zvezde — velik, kakovosten imagery
✓ Subtilne animacije — fade-in ob scrollu, hover efekti
✓ Naraven občutek — organske oblike, mehki robovi, teksture
```

### 3.2 Hero sekcija (Domov)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              [Fullscreen fotografija glampinga]             │
│                   z rahlim overlay gradientom               │
│                                                             │
│                         ─────────                           │
│                                                             │
│                      ZELENI RAJ                             │
│                                                             │
│              Oddih. Narava. Domačnost.                      │
│                                                             │
│                  [ Razišči glamping ]                       │
│                                                             │
│                         ↓ scroll                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Kartice nastanitev

```
┌──────────────────────────────────────┐
│  [Slika hiške — hover: galerija]    │
│                                      │
│  COMFORT HIŠKA                       │
│  ─────────────                       │
│  12 m² · 1 zakonska postelja        │
│  Veranda z razgledom na gozd        │
│                                      │
│  [Več o hiški →]                     │
└──────────────────────────────────────┘
```

### 3.4 Airsoft sekcija — vizualni odmik

Airsoft podstran uporablja **temnejšo paleto** za vizualni kontrast:

```css
.airsoft-section {
  background: var(--airsoft-ozadje);  /* Temno zelena */
  color: var(--airsoft-tekst);         /* Svetel tekst */
}

.airsoft-section .cta-button {
  background: var(--oranžna-sonce);
  color: var(--rjava-temna);
}
```

Stil: Bolj "tactical", a še vedno povezan z Zeleni raj identiteto. Uporablja iste fonte, le temnejše barve.

### 3.5 Teksture in ozadja

```css
/* Subtilna papir tekstura za razdelke */
.section-paper {
  background-image: url('paper-texture.png');
  background-blend-mode: multiply;
}

/* Zelena "gozdna" sekcija */
.section-forest {
  background: linear-gradient(
    180deg, 
    var(--zelena-gozd) 0%, 
    var(--zelena-svetla) 100%
  );
}
```

### 3.6 Animacije

```css
/* Fade-in ob scrollu */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease-out;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Hover na karticah */
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}
```

---

## 4. VSEBINA PO STRANEH

### 4.1 DOMOV

**Hero:**
```
ZELENI RAJ
Oddih. Narava. Domačnost.

[Razišči glamping]   [Rezerviraj]
```

**Intro (pod hero):**
```
V zavetju tihega gozda vas čaka pravljičen pobeg iz vsakdanjika.
Lesene hiške, jutranji ptičji koncert, in čas samo za vas.
```

**3 Kartice:**
```
[GLAMPING]          [AKTIVNOSTI]         [KULINARIKA]
Lesene hiške        Od skiromet          Domač zajtrk,
sredi gozda         do pikada            pica iz peči
[Več →]             [Več →]              [Več →]
```

**Testimonial:**
```
"Všeč mi je bil sprejem, mir, družba drugih popotnikov, 
zajtrk, skrb za moje dobro počutje in prijeten spanec."
— Nina, Slovenija

⭐ 9.8/10 na Booking.com · ⭐ 5.0 na Google
```

---

### 4.2 GLAMPING

**Intro:**
```
TRI ENOTE, EN GOZD, NESKONČEN MIR

Vsaka hiška je ročno zgrajena iz lokalnega lesa. 
Majhne, a premišljene — vse, kar potrebujete za popoln oddih.
```

**Nastanitve:**

```
COMFORT HIŠKA
─────────────
12 m² · Zakonska postelja 180x200 cm
Možnost dodatnega ležišča za otroka do 14 let

Prostorna glamping hiška z verando in pogledom na gozd. 
Električni kamin za hladnejše večere.

Skupna kopalnica · Skupna kuhinja · Brezplačno parkiranje

[Galerija] [Rezerviraj]
```

```
MALA HIŠKA
──────────
7 m² · Zakonska postelja 170x200 cm

Intimen kotiček za dva. Manjša, a nič manj prijetna.
Idealna za kratek pobeg v naravo.

Skupna kopalnica · Skupna kuhinja · Brezplačno parkiranje

[Galerija] [Rezerviraj]
```

```
🌙 ŠOTOR LUNA — PRIHAJA JUNIJ 2025
──────────────────────────────────
Bell šotor · Zakonska postelja + 2 enojni postelji

Novo poglavje Zelenega raja. Romantičen bell šotor 
pod zvezdami — za pare ali družine.

[Obvestite me o odprtju]
```

**Skupni prostori:**
```
PIKNIK PROSTOR & KUHINJA

Skupni prostor je srce glampinga. Opremljena kuhinja, 
jedilnica za lačne pohodnike, pikado, metanje sekire, 
in pogovori ob ognju.
```

**Hišni red (accordion):**
```
[+] Čistoča in red
[+] Uporaba skupnih prostorov
[+] Nočni mir (22:00 - 06:00)
[+] Varnost in ogenj
[+] Prihod in odhod
[+] Obroki in zajtrk
```

---

### 4.3 AKTIVNOSTI

**Intro:**
```
OD JUTRA DO MRAKA JE TUKAJ VELIKO ZA DOŽIVETI

Na glampingu ali v okolici — vi izberete tempo.
```

**Na lokaciji:**
```
🎯 SKIROMET         Ciljajte na tarče sredi gozda
🔫 AIRSOFT TARČE    Streljanje v tarče (ne boji se, ne boli)
🎯 PIKADO           Klasika za vse starosti
⚫ BALINČKANJE      Sprostite se na zelenici
🎲 BOARD GAMES      Za deževne večere ali po želji

Vse aktivnosti so na voljo po predhodnem dogovoru.
```

**Podtodogodbe.si:**
```
📱 DIGITALNA ZGODOVINA OKOLICE

Podtodogodbe.si je avdio vodnik, ki vas popelje 
skozi zgodovino vasi Vače in okolice. 

Slušajte zgodbe o situlah, Ilirih in skritih zakladih 
— med hojo po gozdnih poteh.

[Razišči podtodogodbe.si →]
```

**Zemljevid doživetij:**
```
[Interaktivna slika zemljevida]

Od fosilne morske obale do Geometričnega središča Slovenije — 
vse je na dosegu rok. Oziroma nog.

1. Glamping Zeleni raj — Vaše izhodišče
2. Fosilna morska obala — 15 min hoje
3. GEOSS — 20 min vožnje
4. Gostilna Vrabec — 10 min vožnje
... (ostale točke iz zemljevida)
```

---

### 4.4 KULINARIKA

**Intro:**
```
HRANA, KI DIŠI PO DOMAČEM

Začnite dan z jajci iz sosednje kmetije. 
Končajte ga s pico iz peči.
```

**Zajtrk (vključen):**
```
🍳 DOMAČI ZAJTRK

Vsako jutro vas v hladilniku čaka:
· Sveža jajca
· Domač kruh
· Čebula, paradižnik (sezonsko)
· Marmelada, sir, salama

Zajtrk je brezplačen. Če vam je všeč, 
vas vabimo k prostovoljnemu prispevku.
```

**Pica iz peči:**
```
🔥 PICA IZ COZZE PEČI — NAŠ PONOS

Letos nova pridobitev: profesionalna pica peč, 
ki speče pico v 90 sekundah.

Tanko, hrustljavo testo, lokalne sestavine, 
in nepozaben vonj po gozdu.

[Naročite pica večer →]
```

**Ostalo:**
```
Poleg pice pripravljamo tudi:
· Obare
· Palačinke
· Shejke

Vse po predhodnem dogovoru.
[Kontaktirajte za ponudbo]
```

---

### 4.5 AIRSOFT POLIGON

> ⚠️ Ta sekcija ima **temnejši, bolj tactical vizualni stil**

**Hero:**
```
[Temnejša fotografija poligona]

POLIGON ZELENI RAJ
─────────────────
Airsoft sredi gozda. Adrenalina in taktika.
```

**O poligonu:**
```
Poligon Zeleni raj je dom airsoft dogodkov v osrčju 
slovenskega gozda. Gostimo organizirane igre, 
team buildinge in tematske scenarije.

Oprema na izposojo po dogovoru.
```

**Klub SPARTAN:**
```
Poligon redno gostimo dogodke kluba SPARTAN.

[Instagram: @spartan_airsoft_slovenija]
```

**Po boju:**
```
🍖 PO SPOPADIH — ČAS ZA HRANO

Ko se dim usede, se vžge žar. 
Ali pa peč za pico. Igralci izbirate.
```

**Prihajajoči dogodki:**
```
[Dinamičen seznam dogodkov — admin lahko dodaja]

📅 15. JUN 2025 — Poletna operacija
📅 20. JUL 2025 — Nočna misija
📅 ... 

[Prijava na dogodek]
```

---

### 4.6 DOGODKI (Koledar)

```
KOLEDAR DOGODKOV
────────────────

[Filter: Vsi | Airsoft | Glamping | Lokalno]

┌─────────────────────────────────────────────────────┐
│ 📅 15. JUN 2025                                     │
│ POLETNA AIRSOFT OPERACIJA                           │
│ Poligon Zeleni raj · 09:00                          │
│ [Več info]                                          │
├─────────────────────────────────────────────────────┤
│ 📅 21. JUN 2025                                     │
│ POKER NIGHT                                         │
│ Piknik prostor · 20:00                              │
│ [Več info]                                          │
├─────────────────────────────────────────────────────┤
│ 📅 28. JUN 2025                                     │
│ VAŠKI DAN                                           │
│ Vače · Cel dan                                      │
│ [Več info]                                          │
└─────────────────────────────────────────────────────┘
```

**Admin panel:**
```
Za dodajanje dogodkov: /admin (zaščiteno z geslom)

Obrazec:
· Naslov dogodka
· Datum in ura
· Kategorija (Airsoft / Glamping / Lokalno)
· Lokacija
· Opis
· Slika (opcijsko)
```

---

### 4.7 REZERVACIJE

**Obrazec:**
```
REZERVIRAJTE VAŠ POBEG
──────────────────────

Izpolnite obrazec in odgovorim vam isti dan.

[Ime in priimek] *
[Email] *
[Telefon]

[Datum prihoda 📅] — [Datum odhoda 📅]

Število oseb:
[Odrasli ▼]  [Otroci ▼]

Nastanitev:
[▼ Comfort hiška / Mala hiška / Šotor Luna]

Dodatne aktivnosti:
☐ Skiromet
☐ Airsoft streljanje
☐ Pikado
☐ Balinčkanje
☐ Board games
☐ Pica večer
☐ Kulinarična izkušnja

[Sporočilo]
____________________________________

[POŠLJI POVPRAŠEVANJE]
```

**Kontakt:**
```
ALI PA ME KONTAKTIRAJTE DIREKTNO

📧 samuel.nagode@gmail.com
📱 070 761 455 (klic, SMS, WhatsApp)
📍 Vače 49, 1252 Vače

Odgovorim isti dan.
```

**Booking alternativa:**
```
Cene si lahko ogledate tudi na Booking.com — 
a za najboljšo ponudbo se obrnite direktno name.

[Booking.com] (sekundaren gumb)
```

**Zemljevid:**
```
[Google Maps embed — Vače 49, 1252 Vače]
```

---

## 5. TEHNIČNE ZAHTEVE

### 5.1 Responsive dizajn

```
Desktop: 1200px+
Tablet: 768px - 1199px
Mobilno: < 768px

Navigacija na mobilnem: hamburger meni
```

### 5.2 Dvojezičnost

```
Struktura URL:
- glampingzeleniraj.si/           (SL - privzeto)
- glampingzeleniraj.si/en/        (EN)

Preklopnik v headerju: [SL] / [EN]

Vse vsebine morajo biti prevedene.
```

### 5.3 Placeholder slike

```
Poimenovanje:
/images/glamping/glamping-1.jpg
/images/glamping/glamping-2.jpg
/images/aktivnosti/aktivnosti-1.jpg
/images/airsoft/airsoft-1.jpg
/images/kulinarika/kulinarika-1.jpg
/images/galerija/galerija-1.jpg
...

Placeholderji naj bodo v stilu:
- Dimenzije: 1200x800 (landscape), 800x1200 (portrait)
- Barva: var(--zelena-mint) z logom na sredini
- Tekst: "Glamping 1", "Airsoft 3" itd.
```

### 5.4 Obrazec za rezervacije

```
Pošiljanje na: samuel.nagode@gmail.com
Metoda: EmailJS / Formspree / Netlify Forms

Polja:
- ime* (text)
- email* (email)
- telefon (tel)
- datum_prihoda (date)
- datum_odhoda (date)
- odrasli (number)
- otroci (number)
- nastanitev (select)
- aktivnosti (checkbox array)
- sporocilo (textarea)

Potrditev: "Hvala! Odgovorim vam isti dan."
```

### 5.5 Admin panel za dogodke

```
URL: /admin
Zaščita: enostavno geslo (lahko hardcoded za začetek)

Funkcije:
- Dodaj dogodek
- Uredi dogodek
- Izbriši dogodek
- Naloži sliko

Shranjevanje: LocalStorage za MVP, kasneje lahko Firebase/Supabase
```

### 5.6 SEO osnove

```html
<title>Glamping Zeleni raj — Oddih. Narava. Domačnost. | Vače, Slovenija</title>

<meta name="description" content="Butični glamping sredi gozda, 30 minut iz Ljubljane. Lesene hiške, domača hrana, airsoft poligon. Rezervirajte vaš pobeg v naravo.">

<meta property="og:image" content="/images/og-image.jpg">
```

---

## 6. HIERARHIJA POMEMBNOSTI

```
1. ⭐⭐⭐⭐⭐ GLAMPING (jedro ponudbe)
2. ⭐⭐⭐⭐   REZERVACIJE (konverzija)
3. ⭐⭐⭐⭐   KULINARIKA (USP — pica peč!)
4. ⭐⭐⭐     AKTIVNOSTI + OKOLICA (dodana vrednost)
5. ⭐⭐⭐     AIRSOFT (sekundarna ponudba, ločen vizual)
6. ⭐⭐      DOGODKI (skupnost)
7. ⭐⭐      GALERIJA (podpora)
```

---

## 7. REFERENCE ZA DIZAJN

Vizualni stil naj se zgleduje po:
- Skandinavskih glamping straneh (čiste, naravne, veliko fotografij)
- Boutique hotelih (elegantno, a toplo)
- Ruralni turizem (avtentično, ne preveč polirano)

**NE:**
- Preveč korporativno
- Generični hotel booking stil
- Preveč "fancy" / luksuzno

**DA:**
- Toplo, domače
- Naravne teksture (les, papir, zemlja)
- Dih jemajoče fotografije
- Enostavna navigacija
- Občutek "pridi, kot bi prišel k prijatelju"

---

## 8. KONČNE OPOMBE

### Sezona
Glamping je odprt **maj — oktober**.

### Cene
Niso javno objavljene. Spodbujamo direkten kontakt.

### Hišni ljubljenčki
Niso dovoljeni.

### Nočni mir
22:00 — 06:00

### Check-in / Check-out
Prijava: 16:00 — 19:00
Odjava: do 11:00

---

## 9. KONTAKTNI PODATKI ZA FOOTER

```
GLAMPING ZELENI RAJ
Oddih. Narava. Domačnost.

📧 samuel.nagode@gmail.com
📱 070 761 455
📍 Vače 49, 1252 Vače

Instagram: @glampingzeleniraj
Facebook: Glamping Zeleni raj

⭐ 9.8/10 Booking.com
⭐ 5.0/5 Google Reviews

© 2025 Glamping Zeleni raj. Vse pravice pridržane.
```

---

**KONEC PROMPTA**

Ta dokument vsebuje vse potrebno za izgradnjo spletne strani v Lovable. 
Slike dodaj naknadno po strukturi, opisani v sekciji 5.3.

🌲 Srečno, Samuel!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://spartanopsapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f461bd7b-cf7c-4be2-a2d1-3b384efbe1d2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
