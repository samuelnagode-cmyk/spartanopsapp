export type Review = {
  name: string;
  country_sl: string;
  country_en: string;
  score: number;
  date_sl: string;
  date_en: string;
  original_language?: string;
  text_sl?: string;
  text_en?: string;
  score_only?: boolean;
};

export const reviews: Review[] = [
  {
    name: "Nina",
    country_sl: "Slovenija",
    country_en: "Slovenia",
    score: 10,
    date_sl: "junij 2025",
    date_en: "June 2025",
    original_language: "sl",
    text_sl:
      "Všeč mi je bil sprejem, predstavitev, ogled, hiška, jutranji sonček, mir, družba drugih popotnikov, zajtrk, skrb za moje dobro počutje in prijeten spanec.",
    text_en:
      "I loved the welcome, the introduction, the tour, the cabin, the morning sun, the peace, the company of fellow travelers, breakfast, the care for my wellbeing, and a wonderful sleep.",
  },
  {
    name: "Susannah",
    country_sl: "Francija",
    country_en: "France",
    score: 10,
    date_sl: "maj 2026",
    date_en: "May 2026",
    original_language: "en",
    text_sl:
      "Čudovit kraj, super čist, tih. Zelo prijazno in ustrežljivo osebje. Imela sem se čudovito.",
    text_en:
      "A beautiful spot, super clean, quiet. Very friendly and accommodating staff. I had a lovely time.",
  },
  {
    name: "Chris",
    country_sl: "Nova Zelandija",
    country_en: "New Zealand",
    score: 10,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    original_language: "en",
    text_sl:
      "Zelo lepa avtentična kmečka nastanitev, kopalnica je bila lepa in bolj razkošna od pričakovanj. Hiška je bila majhna a prijetna, kamin pa pravi dotik — občutek hiške v gozdu. Skupni prostor s kuhinjo, pikadom in vsem potrebnim je bil točno to, kar smo potrebovali. Gostitelj je bil izjemno pozoren, postregel je z zajtrkom in informacijami. Neverjeten kraj — močno priporočam.",
    text_en:
      "Very nice authentic farm stay property, the bathroom was very nice and a lot more luxurious compared to what we were expecting from other farmsteads. The cabin was small but cozy and the fireplace was such a nice touch, it gave a very cabin in the woods vibe which was perfect. The common space which had a full kitchen, basic supplies, dart board, and more was all we needed. The host was incredibly attentive, and helpful supplying breakfast, information about local things to do and more. An incredible place to stay I could not recommend it enough.",
  },
  {
    name: "Thomas",
    country_sl: "Avstralija",
    country_en: "Australia",
    score: 10,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    original_language: "en",
    text_sl:
      "Hiška je nova in dobro izolirana. Z udobno posteljo in električnim kaminom. Gostitelj Samuel je bil izjemno prijazen — pobral nas je z železniške postaje in odpeljal nazaj.",
    text_en:
      "The cabin itself was new, and well insulated. The cabin also included a comfortable bed and an electric fireplace. The host, Samuel, was extremely helpful as he picked us up from the train station and dropped us back.",
  },
  {
    name: "Orpaz",
    country_sl: "Izrael",
    country_en: "Israel",
    score: 10,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    original_language: "en",
    text_sl:
      "Lastnik Samuel je neverjeten gostitelj, izjemno prijazen in radodaren. Hiške so nove, preproste in zemeljske, narejene v celoti iz lesa. Skupni prostor ima opremljeno kuhinjo, jedilno mizo, kavč, boksarsko vrečo in pikado s pogledom na kmetijo. Zajtrk Samuel pripravi iz svojega vrta. Veliko prijetnih kotičkov in 10 minut sprehoda do lokalnega bara, polnega karakterja.",
    text_en:
      "The owner, Samuel, is an amazing host, extremely helpful and generous. The huts are new, simple and earthy, as they are made fully of timber. Everything that you need is there, within the common area is a great kitchen with all the utensils, large dining table, couch, boxing bag and dart board with a view of the farm. Breakfast is supplied by Samuel from his personal veggie garden. There are a lot of great hanging out spots on the farm as well as a 10 minute walk from the local pub which has loads of character.",
  },
  {
    name: "Vincent",
    country_sl: "Francija",
    country_en: "France",
    score: 10,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    original_language: "fr",
    text_sl:
      "Super glamping izkušnja! Noč v gozdu, dobro opremljena in lepo dekorirana hiška! Bonus za zajtrk z lokalnimi izdelki (celo domačim kruhom!) Hvala Samuelu za sprejem in odzivnost! Toplo priporočamo za odklop in uživanje v naravi.",
    text_en:
      "A super glamping experience! A night in the forest, a cabin very well equipped and beautifully decorated! Bonus for the breakfast with local products (even homemade bread!). Thanks to Samuel for his welcome and responsiveness! We warmly recommend this place to disconnect and enjoy nature.",
  },
  {
    name: "Julie",
    country_sl: "Francija",
    country_en: "France",
    score: 10,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    original_language: "fr",
    text_sl: "Narava naokoli, prijaznost sprejema, izvirnost kraja.",
    text_en: "The nature around, the kindness of the welcome, the originality of the place.",
  },
  {
    name: "Andrada",
    country_sl: "Velika Britanija",
    country_en: "United Kingdom",
    score: 9,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    original_language: "en",
    text_sl:
      "Soba je bila prijetna in udobna. Gostitelj zelo prijazen in ustrežljiv. Zajtrka nismo poskusili, ampak je izgledal odlično. Skoraj nič za pritožiti.",
    text_en:
      "The room was really nice and cozy. The host was very helpful and friendly. We didn't try the breakfast provided, but it looked really nice. Not much to complain about.",
  },
  {
    name: "Krammer",
    country_sl: "Madžarska",
    country_en: "Hungary",
    score: 10,
    date_sl: "september 2025",
    date_en: "September 2025",
    original_language: "hu",
    text_sl:
      "Zelo čisto namestilo, sredi gozda. Gostitelj zelo prijazen, zajtrk obilen. Kopalnica lepa, parkiranje preprosto. Skupna kuhinja dobro opremljena, ves kraj čarobno edinstven in prijeten. Obožavali smo — gotovo se vrnemo!",
    text_en:
      "Very clean accommodation, beautifully located in the middle of the forest. The host was very kind and the breakfast was plentiful. The bathroom was also lovely, parking was easy. The shared kitchen was very well equipped and the whole place is magically unique and atmospheric. We loved it — we will definitely come back!",
  },
  {
    name: "Serena",
    country_sl: "Italija",
    country_en: "Italy",
    score: 9,
    date_sl: "maj 2026",
    date_en: "May 2026",
    original_language: "it",
    text_sl: "Popolni mir in čudovita hiška. Prostor in tišina.",
    text_en: "Total peace and a wonderful cabin. Space and tranquility.",
  },
  {
    name: "Jerome",
    country_sl: "Kanada",
    country_en: "Canada",
    score: 10,
    date_sl: "junij 2025",
    date_en: "June 2025",
    original_language: "fr",
    text_sl:
      "Čudovit kraj. Bil sem tu s svojo punco za prvo noč najinega skupnega potovanja in imela sva polno intime.",
    text_en:
      "A wonderful place. I was here with my girlfriend for the first night of our trip together and we had complete privacy.",
  },
  {
    name: "Pavel",
    country_sl: "Češka",
    country_en: "Czech Republic",
    score: 10,
    date_sl: "junij 2025",
    date_en: "June 2025",
    original_language: "cs",
    text_sl: "Čudovit kraj.",
    text_en: "A wonderful place.",
  },
  {
    name: "Olaf",
    country_sl: "Švica",
    country_en: "Switzerland",
    score: 10,
    date_sl: "julij 2025",
    date_en: "July 2025",
    score_only: true,
  },
  {
    name: "Adam",
    country_sl: "Avstrija",
    country_en: "Austria",
    score: 9,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    score_only: true,
  },
  {
    name: "Emma",
    country_sl: "Italija",
    country_en: "Italy",
    score: 10,
    date_sl: "avgust 2025",
    date_en: "August 2025",
    score_only: true,
  },
];

export const aggregateScore =
  reviews.reduce((s, r) => s + r.score, 0) / reviews.length;

export const featuredReviewIndices = [0, 2, 4]; // Nina, Chris, Orpaz

// Display order for grid: Nina, Susannah, Chris, Krammer, Orpaz, Vincent, Thomas, Andrada, Julie, Jerome, Serena, Pavel, Olaf, Adam, Emma
export const gridOrder = [0, 1, 2, 8, 4, 5, 3, 7, 6, 10, 9, 11, 12, 13, 14];
