// Site content (all four languages) plus the decoration shape library and
// per-page layout config. Pure data — no DOM access, safe to import anywhere.

const LANGS = ["en", "es", "pt", "fr"];
const ORDER = ["gonorrhea", "chlamydia", "syphilis", "hiv", "herpes", "hpv"];
const STATUS = {
  gonorrhea: "curable",
  chlamydia: "curable",
  syphilis: "curable",
  hiv: "treat",
  herpes: "treat",
  hpv: "treat",
};
const CDC = "https://gettested.cdc.gov/";
const AUTONYM = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
};

const T = {
  en: {
    ui: {
      title: "STI Testing",
      tagline:
        "Find a place to get tested near you. Plus simple, clear info — no judgment.",
      othersLabel: "Got a result, or want to read about one?",
      ctaTitle: "Find free testing near you",
      ctaSub: "Opens a map of clinics close to you",
      freeBadge: "Free",
      mapsQuery: "free STI testing near me",
      official: "Or see the official CDC testing list",
      back: "Testing & other STIs",
      footer:
        "This is general info, not medical advice. A clinic or doctor can tell you what is right for you. Based on U.S. CDC guidance.",
      disclaimer:
        "Getting tested is quick, and many clinics are free or low-cost. If you test positive, treatment usually starts the same day.",
    },
    conditions: {
      gonorrhea: {
        name: "Gonorrhea",
        label: "Curable",
        intro:
          "A common infection you can get from sex. It can be in the throat, dick, pussy, or ass.",
        qa: [
          [
            "Would I know if I had it?",
            "Often there are no signs. Many people feel fine and still have it. A <b>test</b> is the only way to be sure.",
          ],
          [
            "Can it be cured?",
            "<b>Yes.</b> One shot of antibiotic medicine cures it.",
          ],
          [
            "What should I do?",
            "Get a test. If you have it, get the medicine. Tell people you had sex with lately, so they can get tested too.",
          ],
        ],
      },
      chlamydia: {
        name: "Chlamydia",
        label: "Curable",
        intro:
          "A very common infection from sex. It can be in the dick, pussy, ass, or throat.",
        qa: [
          [
            "Would I know if I had it?",
            "Most of the time, no. About half of people have no signs. Only a <b>test</b> can tell you.",
          ],
          [
            "Can it be cured?",
            "<b>Yes.</b> A short course of antibiotic pills cures it. Take all of them, even if you feel fine.",
          ],
          [
            "What should I do?",
            "Get a test — a quick swab or a pee test. Tell recent partners so they can get tested too.",
          ],
        ],
      },
      syphilis: {
        name: "Syphilis",
        label: "Curable",
        intro:
          "An infection from sex that gets worse over time if you do not treat it.",
        qa: [
          [
            "Would I know if I had it?",
            "The first sign is often one sore that does <b>not</b> hurt, so it is easy to miss. Then it can hide for a long time. A blood test finds it.",
          ],
          [
            "Can it be cured?",
            "<b>Yes.</b> A shot of penicillin cures it. The sooner you treat it, the better.",
          ],
          [
            "What should I do?",
            "Ask for a syphilis blood test. It is part of a full STI check. Tell recent partners too.",
          ],
        ],
      },
      hiv: {
        name: "HIV",
        label: "Treatable",
        intro: "A virus that weakens the body's defense against sickness.",
        qa: [
          [
            "Would I know if I had it?",
            "Most people feel fine at first. The only way to know is a <b>test</b>. Many tests are fast and free.",
          ],
          [
            "Can it be treated?",
            "There is no cure, but <b>daily medicine keeps you healthy</b> and lets you live a long, normal life. The medicine can lower the virus so much that you cannot pass it to anyone else.",
          ],
          [
            "Can it be prevented?",
            "Yes. A pill called <b>PrEP</b> stops HIV before it happens. If you think you were just exposed, a medicine called <b>PEP</b> can still help — but you must start it within 3 days.",
          ],
          [
            "What should I do?",
            "Get a test. If it is positive, start medicine soon. Tell recent partners so they can get tested too.",
          ],
        ],
      },
      herpes: {
        name: "Herpes",
        label: "Treatable",
        intro:
          "A very common virus. It can cause sores on the mouth, dick, or pussy. Most people who have it never know.",
        qa: [
          [
            "Is it serious?",
            "For most people, <b>no</b>. It is a minor skin problem that comes and goes. The worry around it is much bigger than the real harm.",
          ],
          [
            "Can it be treated?",
            "There is no cure, but medicine can stop or shorten outbreaks and lower the chance of passing it to someone else.",
          ],
          [
            "Good to know",
            "A normal STI test usually does <b>not</b> check for herpes unless you have a sore. If you want this test, ask for it.",
          ],
        ],
      },
      hpv: {
        name: "HPV",
        label: "Usually goes away",
        intro:
          "The most common infection from sex. Almost everyone gets it at some point. Most people never know.",
        qa: [
          [
            "Is it serious?",
            "Most of the time, no. It usually goes away on its own in a year or two. A few types can cause warts, or — rarely, over many years — cancer.",
          ],
          [
            "Can it be prevented?",
            "<b>Yes.</b> A vaccine (a shot) protects against the worst types. You can get it up to age 45.",
          ],
          [
            "What should I do?",
            "Get the vaccine if you have not had it. Ask a clinic which checks are right for you.",
          ],
        ],
      },
    },
  },
  es: {
    ui: {
      title: "Pruebas de ITS",
      tagline:
        "Encuentra dónde hacerte la prueba cerca de ti. Además, información clara y sencilla, sin juzgar.",
      othersLabel: "¿Recibiste un resultado o quieres leer sobre alguno?",
      ctaTitle: "Busca pruebas gratis cerca de ti",
      ctaSub: "Abre un mapa con clínicas cercanas",
      freeBadge: "Gratis",
      mapsQuery: "prueba de ITS gratis cerca de mí",
      official: "O consulta la lista oficial de los CDC",
      back: "Pruebas y otras ITS",
      footer:
        "Esta es información general, no consejo médico. Una clínica o un médico puede decirte qué es lo mejor para ti. Basado en las guías de los CDC de EE. UU.",
      disclaimer:
        "Hacerte la prueba es rápido, y muchas clínicas son gratis o de bajo costo. Si el resultado es positivo, el tratamiento suele empezar el mismo día.",
    },
    conditions: {
      gonorrhea: {
        name: "Gonorrea",
        label: "Tiene cura",
        intro:
          "Una infección común que se contagia al tener sexo. Puede estar en la garganta, la verga, el coño o el culo.",
        qa: [
          [
            "¿Lo notaría?",
            "Muchas veces no hay señales. Muchas personas se sienten bien y aun así la tienen. La <b>prueba</b> es la única forma de saberlo.",
          ],
          ["¿Tiene cura?", "<b>Sí.</b> Una inyección de antibiótico la cura."],
          [
            "¿Qué debo hacer?",
            "Hazte la prueba. Si la tienes, toma el medicamento. Avisa a las personas con las que tuviste sexo hace poco, para que también se hagan la prueba.",
          ],
        ],
      },
      chlamydia: {
        name: "Clamidia",
        label: "Tiene cura",
        intro:
          "Una infección muy común que se contagia al tener sexo. Puede estar en la verga, el coño, el culo o la garganta.",
        qa: [
          [
            "¿Lo notaría?",
            "La mayoría de las veces, no. Cerca de la mitad de las personas no tienen señales. Solo una <b>prueba</b> puede decírtelo.",
          ],
          [
            "¿Tiene cura?",
            "<b>Sí.</b> Un tratamiento corto de pastillas antibióticas la cura. Tómalas todas, aunque te sientas bien.",
          ],
          [
            "¿Qué debo hacer?",
            "Hazte la prueba: un hisopo rápido o una prueba de orina. Avisa a tus parejas recientes para que también se hagan la prueba.",
          ],
        ],
      },
      syphilis: {
        name: "Sífilis",
        label: "Tiene cura",
        intro:
          "Una infección que se contagia al tener sexo y que empeora con el tiempo si no la tratas.",
        qa: [
          [
            "¿Lo notaría?",
            "La primera señal suele ser una llaga que <b>no</b> duele, así que es fácil no notarla. Después puede esconderse por mucho tiempo. Un análisis de sangre la detecta.",
          ],
          [
            "¿Tiene cura?",
            "<b>Sí.</b> Una inyección de penicilina la cura. Cuanto antes la trates, mejor.",
          ],
          [
            "¿Qué debo hacer?",
            "Pide un análisis de sangre para sífilis. Es parte de un chequeo completo de ITS. Avisa también a tus parejas recientes.",
          ],
        ],
      },
      hiv: {
        name: "VIH",
        label: "Tiene tratamiento",
        intro:
          "Un virus que debilita las defensas del cuerpo contra las enfermedades.",
        qa: [
          [
            "¿Lo notaría?",
            "La mayoría de las personas se sienten bien al principio. La única forma de saberlo es una <b>prueba</b>. Muchas pruebas son rápidas y gratis.",
          ],
          [
            "¿Tiene tratamiento?",
            "No tiene cura, pero <b>un medicamento diario te mantiene sano</b> y te permite vivir una vida larga y normal. El medicamento puede bajar tanto el virus que ya no puedes contagiarlo a nadie.",
          ],
          [
            "¿Se puede prevenir?",
            "Sí. Una pastilla llamada <b>PrEP</b> evita el VIH antes de que ocurra. Si crees que te expusiste hace poco, un medicamento llamado <b>PEP</b> aún puede ayudar, pero debes empezarlo dentro de los 3 días.",
          ],
          [
            "¿Qué debo hacer?",
            "Hazte la prueba. Si es positiva, empieza el medicamento pronto. Avisa a tus parejas recientes para que también se hagan la prueba.",
          ],
        ],
      },
      herpes: {
        name: "Herpes",
        label: "Tiene tratamiento",
        intro:
          "Un virus muy común. Puede causar llagas en la boca, la verga o el coño. La mayoría de las personas que lo tienen nunca lo saben.",
        qa: [
          [
            "¿Es grave?",
            "Para la mayoría de las personas, <b>no</b>. Es un problema menor de la piel que aparece y desaparece. La preocupación que causa es mucho mayor que el daño real.",
          ],
          [
            "¿Tiene tratamiento?",
            "No tiene cura, pero el medicamento puede evitar o acortar los brotes y reducir la posibilidad de contagiarlo a otra persona.",
          ],
          [
            "Bueno saberlo",
            "Una prueba normal de ITS por lo general <b>no</b> incluye el herpes, a menos que tengas una llaga. Si quieres esta prueba, pídela.",
          ],
        ],
      },
      hpv: {
        name: "VPH",
        label: "Suele desaparecer",
        intro:
          "La infección más común que se contagia al tener sexo. Casi todas las personas la tienen en algún momento. La mayoría nunca lo sabe.",
        qa: [
          [
            "¿Es grave?",
            "La mayoría de las veces, no. Casi siempre desaparece sola en uno o dos años. Algunos tipos pueden causar verrugas o, en raros casos y tras muchos años, cáncer.",
          ],
          [
            "¿Se puede prevenir?",
            "<b>Sí.</b> Una vacuna (una inyección) protege contra los tipos más peligrosos. Puedes ponértela hasta los 45 años.",
          ],
          [
            "¿Qué debo hacer?",
            "Ponte la vacuna si no la tienes. Pregunta en una clínica qué chequeos son adecuados para ti.",
          ],
        ],
      },
    },
  },
  pt: {
    ui: {
      title: "Testagem de IST",
      tagline:
        "Encontre onde se testar perto de você. E mais: informação clara e simples, sem julgamento.",
      othersLabel: "Recebeu um resultado ou quer ler sobre algum?",
      ctaTitle: "Encontre testes gratuitos perto de você",
      ctaSub: "Abre um mapa com clínicas próximas",
      freeBadge: "Grátis",
      mapsQuery: "teste de IST gratuito perto de mim",
      official: "",
      back: "Testes e outras IST",
      footer:
        "Esta é uma informação geral, não um conselho médico. Uma clínica ou médico pode dizer o que é melhor para você. Baseado nas diretrizes do CDC dos EUA.",
      disclaimer:
        "Se testar é rápido, e muitas clínicas são gratuitas ou de baixo custo. Se o resultado for positivo, o tratamento costuma começar no mesmo dia.",
    },
    conditions: {
      gonorrhea: {
        name: "Gonorreia",
        label: "Tem cura",
        intro:
          "Uma infecção comum que se pega pelo sexo. Pode ficar na garganta, no pau, na buceta ou no cu.",
        qa: [
          [
            "Eu saberia se tivesse?",
            "Muitas vezes não há sinais. Muita gente se sente bem e mesmo assim está com a infecção. O <b>teste</b> é a única forma de saber.",
          ],
          ["Tem cura?", "<b>Sim.</b> Uma injeção de antibiótico cura."],
          [
            "O que eu devo fazer?",
            "Faça o teste. Se estiver com a infecção, tome o remédio. Avise as pessoas com quem você transou faz pouco tempo, para elas também se testarem.",
          ],
        ],
      },
      chlamydia: {
        name: "Clamídia",
        label: "Tem cura",
        intro:
          "Uma infecção muito comum que se pega pelo sexo. Pode ficar no pau, na buceta, no cu ou na garganta.",
        qa: [
          [
            "Eu saberia se tivesse?",
            "Na maioria das vezes, não. Quase metade das pessoas não tem sinais. Só um <b>teste</b> pode dizer.",
          ],
          [
            "Tem cura?",
            "<b>Sim.</b> Um tratamento curto de comprimidos antibióticos cura. Tome todos, mesmo que se sinta bem.",
          ],
          [
            "O que eu devo fazer?",
            "Faça o teste — um cotonete rápido ou um teste de urina. Avise seus parceiros recentes para eles também se testarem.",
          ],
        ],
      },
      syphilis: {
        name: "Sífilis",
        label: "Tem cura",
        intro:
          "Uma infecção que se pega pelo sexo e piora com o tempo se você não tratar.",
        qa: [
          [
            "Eu saberia se tivesse?",
            "O primeiro sinal costuma ser uma ferida que <b>não</b> dói, então é fácil não perceber. Depois ela pode ficar escondida por muito tempo. Um exame de sangue encontra.",
          ],
          [
            "Tem cura?",
            "<b>Sim.</b> Uma injeção de penicilina cura. Quanto antes tratar, melhor.",
          ],
          [
            "O que eu devo fazer?",
            "Peça um exame de sangue para sífilis. Faz parte de um check-up completo de IST. Avise também seus parceiros recentes.",
          ],
        ],
      },
      hiv: {
        name: "HIV",
        label: "Tem tratamento",
        intro: "Um vírus que enfraquece as defesas do corpo contra doenças.",
        qa: [
          [
            "Eu saberia se tivesse?",
            "A maioria das pessoas se sente bem no começo. A única forma de saber é o <b>teste</b>. Muitos testes são rápidos e gratuitos.",
          ],
          [
            "Tem tratamento?",
            "Não tem cura, mas <b>um remédio por dia te mantém saudável</b> e te deixa viver uma vida longa e normal. O remédio pode baixar tanto o vírus que você não passa para mais ninguém.",
          ],
          [
            "Dá para prevenir?",
            "Sim. Um comprimido chamado <b>PrEP</b> evita o HIV antes de acontecer. Se você acha que se expôs há pouco, um remédio chamado <b>PEP</b> ainda pode ajudar, mas precisa começar em até 3 dias.",
          ],
          [
            "O que eu devo fazer?",
            "Faça o teste. Se for positivo, comece o remédio logo. Avise seus parceiros recentes para eles também se testarem.",
          ],
        ],
      },
      herpes: {
        name: "Herpes",
        label: "Tem tratamento",
        intro:
          "Um vírus muito comum. Pode causar feridas na boca, no pau ou na buceta. A maioria das pessoas que tem nunca fica sabendo.",
        qa: [
          [
            "É grave?",
            "Para a maioria das pessoas, <b>não</b>. É um problema de pele leve que vai e volta. A preocupação em torno dele é bem maior que o dano real.",
          ],
          [
            "Tem tratamento?",
            "Não tem cura, mas o remédio pode evitar ou encurtar as crises e diminuir a chance de passar para outra pessoa.",
          ],
          [
            "Bom saber",
            "Um teste normal de IST geralmente <b>não</b> inclui herpes, a não ser que você tenha uma ferida. Se quiser esse teste, peça.",
          ],
        ],
      },
      hpv: {
        name: "HPV",
        label: "Costuma sumir",
        intro:
          "A infecção mais comum que se pega pelo sexo. Quase todo mundo tem em algum momento. A maioria nunca fica sabendo.",
        qa: [
          [
            "É grave?",
            "Na maioria das vezes, não. Quase sempre vai embora sozinho em um ou dois anos. Alguns tipos podem causar verrugas ou, raramente e depois de muitos anos, câncer.",
          ],
          [
            "Dá para prevenir?",
            "<b>Sim.</b> Uma vacina (uma injeção) protege contra os tipos mais perigosos. Você pode tomar até os 45 anos.",
          ],
          [
            "O que eu devo fazer?",
            "Tome a vacina se ainda não tomou. Pergunte numa clínica quais exames são certos para você.",
          ],
        ],
      },
    },
  },
  fr: {
    ui: {
      title: "Dépistage des IST",
      tagline:
        "Trouve où te faire dépister près de chez toi. Et des infos claires et simples, sans jugement.",
      othersLabel: "Tu as reçu un résultat, ou tu veux te renseigner ?",
      ctaTitle: "Trouve un dépistage gratuit près de toi",
      ctaSub: "Ouvre une carte des cliniques proches",
      freeBadge: "Gratuit",
      mapsQuery: "dépistage IST gratuit près de moi",
      official: "",
      back: "Dépistage et autres IST",
      footer:
        "Ce sont des infos générales, pas un avis médical. Une clinique ou un médecin peut te dire ce qui te convient. D'après les recommandations du CDC (États-Unis).",
      disclaimer:
        "Le dépistage est rapide, et beaucoup de cliniques sont gratuites ou peu coûteuses. Si le résultat est positif, le traitement commence souvent le jour même.",
    },
    conditions: {
      gonorrhea: {
        name: "Gonorrhée",
        label: "Ça se guérit",
        intro:
          "Une infection courante qui se transmet par le sexe. Elle peut toucher la gorge, la bite, la chatte ou le cul.",
        qa: [
          [
            "Est-ce que je le saurais ?",
            "Souvent il n'y a aucun signe. Beaucoup de gens se sentent bien et l'ont quand même. Seul un <b>test</b> permet d'en être sûr.",
          ],
          [
            "Est-ce que ça se guérit ?",
            "<b>Oui.</b> Une injection d'antibiotique la guérit.",
          ],
          [
            "Qu'est-ce que je dois faire ?",
            "Fais un test. Si tu l'as, prends le traitement. Préviens les personnes avec qui tu as couché récemment, pour qu'elles se fassent dépister aussi.",
          ],
        ],
      },
      chlamydia: {
        name: "Chlamydia",
        label: "Ça se guérit",
        intro:
          "Une infection très courante qui se transmet par le sexe. Elle peut toucher la bite, la chatte, le cul ou la gorge.",
        qa: [
          [
            "Est-ce que je le saurais ?",
            "La plupart du temps, non. Presque la moitié des gens n'ont aucun signe. Seul un <b>test</b> peut te le dire.",
          ],
          [
            "Est-ce que ça se guérit ?",
            "<b>Oui.</b> Un court traitement de comprimés antibiotiques la guérit. Prends-les tous, même si tu te sens bien.",
          ],
          [
            "Qu'est-ce que je dois faire ?",
            "Fais un test — un prélèvement rapide ou un test d'urine. Préviens tes partenaires récents pour qu'ils se fassent dépister aussi.",
          ],
        ],
      },
      syphilis: {
        name: "Syphilis",
        label: "Ça se guérit",
        intro:
          "Une infection qui se transmet par le sexe et qui s'aggrave avec le temps si tu ne la traites pas.",
        qa: [
          [
            "Est-ce que je le saurais ?",
            "Le premier signe est souvent une plaie qui ne fait <b>pas</b> mal, donc facile à rater. Ensuite, elle peut rester cachée longtemps. Une prise de sang la détecte.",
          ],
          [
            "Est-ce que ça se guérit ?",
            "<b>Oui.</b> Une injection de pénicilline la guérit. Plus tôt tu la traites, mieux c'est.",
          ],
          [
            "Qu'est-ce que je dois faire ?",
            "Demande une prise de sang pour la syphilis. Ça fait partie d'un dépistage complet des IST. Préviens aussi tes partenaires récents.",
          ],
        ],
      },
      hiv: {
        name: "VIH",
        label: "Ça se traite",
        intro:
          "Un virus qui affaiblit les défenses du corps contre les maladies.",
        qa: [
          [
            "Est-ce que je le saurais ?",
            "La plupart des gens se sentent bien au début. Le seul moyen de savoir, c'est un <b>test</b>. Beaucoup de tests sont rapides et gratuits.",
          ],
          [
            "Est-ce que ça se traite ?",
            "Il n'y a pas de remède, mais <b>un médicament par jour te garde en bonne santé</b> et te permet de vivre longtemps et normalement. Le médicament peut faire baisser le virus au point que tu ne peux plus le transmettre à personne.",
          ],
          [
            "Peut-on l'éviter ?",
            "Oui. Un comprimé appelé <b>PrEP</b> empêche le VIH avant qu'il arrive. Si tu penses avoir été exposé récemment, un traitement appelé <b>PEP (TPE)</b> peut encore aider — mais tu dois le commencer dans les 3 jours.",
          ],
          [
            "Qu'est-ce que je dois faire ?",
            "Fais un test. S'il est positif, commence le traitement vite. Préviens tes partenaires récents pour qu'ils se fassent dépister aussi.",
          ],
        ],
      },
      herpes: {
        name: "Herpès",
        label: "Ça se traite",
        intro:
          "Un virus très courant. Il peut provoquer des plaies sur la bouche, la bite ou la chatte. La plupart des gens qui l'ont ne le savent jamais.",
        qa: [
          [
            "Est-ce que c'est grave ?",
            "Pour la plupart des gens, <b>non</b>. C'est un petit problème de peau qui va et vient. L'inquiétude autour est bien plus grande que le mal réel.",
          ],
          [
            "Est-ce que ça se traite ?",
            "Il n'y a pas de remède, mais un traitement peut éviter ou raccourcir les poussées et réduire le risque de le transmettre.",
          ],
          [
            "Bon à savoir",
            "Un dépistage IST classique ne cherche en général <b>pas</b> l'herpès, sauf si tu as une plaie. Si tu veux ce test, demande-le.",
          ],
        ],
      },
      hpv: {
        name: "HPV",
        label: "Disparaît souvent",
        intro:
          "L'infection sexuelle la plus courante. Presque tout le monde l'attrape un jour. La plupart des gens ne le savent jamais.",
        qa: [
          [
            "Est-ce que c'est grave ?",
            "La plupart du temps, non. Elle disparaît souvent toute seule en un ou deux ans. Quelques types peuvent causer des verrues ou, rarement et après des années, un cancer.",
          ],
          [
            "Peut-on l'éviter ?",
            "<b>Oui.</b> Un vaccin (une injection) protège contre les types les plus dangereux. Tu peux le faire jusqu'à 45 ans.",
          ],
          [
            "Qu'est-ce que je dois faire ?",
            "Fais le vaccin si tu ne l'as pas eu. Demande à une clinique quels examens te conviennent.",
          ],
        ],
      },
    },
  },
};

const C = {
  pink: "#ff5d8f",
  cyan: "#37cfdb",
  yellow: "#ffce2e",
  lime: "#9ada3e",
  purple: "#9b6dff",
  orange: "#ff8a3d",
};
const SHAPES = {
  star: (c, w) =>
    `<svg width="${w}" viewBox="0 0 120 120" fill="none"><path d="M60 8l13 34 36 2-28 23 10 35-31-20-31 20 10-35-28-23 36-2z" fill="${c}" stroke="#181433" stroke-width="3" stroke-linejoin="round"/></svg>`,
  spark: (c, w) =>
    `<svg width="${w}" viewBox="0 0 80 80" fill="none"><path d="M40 6c3 20 14 31 34 34-20 3-31 14-34 34-3-20-14-31-34-34 20-3 31-14 34-34z" fill="${c}" stroke="#181433" stroke-width="3" stroke-linejoin="round"/></svg>`,
  wave: (c, w) =>
    `<svg width="${w}" viewBox="0 0 150 60" fill="none"><path d="M5 30c12-26 28-26 40 0s28 26 40 0 28-26 40 0" stroke="${c}" stroke-width="6" stroke-linecap="round"/></svg>`,
  zig: (c, w) =>
    `<svg width="${w}" viewBox="0 0 120 50" fill="none"><path d="M5 40L25 10l20 30 20-30 20 30 20-30" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ring: (c, w) =>
    `<svg width="${w}" viewBox="0 0 110 110" fill="none"><circle cx="55" cy="55" r="40" stroke="${c}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"/></svg>`,
  coil: (c, w) =>
    `<svg width="${w}" viewBox="0 0 130 60" fill="none"><path d="M8 38a14 14 0 1 1 28 0 14 14 0 1 0 28 0 14 14 0 1 1 28 0" stroke="${c}" stroke-width="6" stroke-linecap="round"/></svg>`,
  dots: (c, w) =>
    `<svg width="${w}" viewBox="0 0 80 80" fill="none"><circle cx="16" cy="20" r="6" fill="${c}"/><circle cx="44" cy="12" r="5" fill="${c}"/><circle cx="64" cy="32" r="7" fill="${c}"/><circle cx="30" cy="48" r="5" fill="${c}"/><circle cx="58" cy="60" r="6" fill="${c}"/></svg>`,
  plus: (c, w) =>
    `<svg width="${w}" viewBox="0 0 44 44" fill="none"><path d="M22 5v34M5 22h34" stroke="${c}" stroke-width="6" stroke-linecap="round"/></svg>`,
};

// Per-page placements. Keys: "home" + each condition. Each piece is
// {t:shape, c:color, w:width, top|bottom|left|right (px), r:rotate}.
// Pieces are anchored to the top/bottom margins and bled off the side edges
// so they frame the page without slicing through the text.
const DECO = {
  home: [
    { t: "star", c: C.yellow, w: 120, top: 46, right: -16, r: -4 },
    { t: "coil", c: C.purple, w: 140, top: 250, left: -46 },
    { t: "zig", c: C.pink, w: 120, bottom: 300, right: -30 },
    { t: "ring", c: C.cyan, w: 110, bottom: 150, left: -30 },
    { t: "spark", c: C.orange, w: 66, bottom: 34, right: -8 },
  ],
  gonorrhea: [
    { t: "spark", c: C.lime, w: 72, top: 42, right: -10 },
    { t: "wave", c: C.purple, w: 150, top: 310, left: -50, r: -6 },
    { t: "ring", c: C.orange, w: 104, bottom: 300, right: -24 },
    { t: "star", c: C.yellow, w: 92, bottom: 96, left: -24, r: 6 },
    { t: "dots", c: C.cyan, w: 74, bottom: 40, right: -4 },
  ],
  chlamydia: [
    { t: "ring", c: C.cyan, w: 120, top: 58, right: -22 },
    { t: "zig", c: C.pink, w: 110, top: 360, left: -30 },
    { t: "coil", c: C.purple, w: 140, bottom: 300, right: -44 },
    { t: "star", c: C.orange, w: 90, bottom: 100, left: -22, r: -6 },
    { t: "plus", c: C.yellow, w: 42, top: 150, left: -2 },
  ],
  syphilis: [
    { t: "star", c: C.pink, w: 100, top: 48, left: -22, r: -6 },
    { t: "coil", c: C.cyan, w: 140, top: 300, right: -48 },
    { t: "spark", c: C.yellow, w: 70, bottom: 300, left: -8 },
    { t: "ring", c: C.purple, w: 110, bottom: 110, right: -24 },
    { t: "dots", c: C.lime, w: 74, bottom: 44, left: -4 },
  ],
  hiv: [
    { t: "ring", c: C.orange, w: 110, top: 56, right: -18 },
    { t: "wave", c: C.lime, w: 150, top: 340, left: -50, r: 6 },
    { t: "zig", c: C.purple, w: 120, bottom: 420, right: -30 },
    { t: "star", c: C.cyan, w: 92, bottom: 200, left: -22, r: 6 },
    { t: "spark", c: C.pink, w: 70, bottom: 70, right: -8 },
    { t: "plus", c: C.yellow, w: 42, top: 150, left: -2 },
  ],
  herpes: [
    { t: "coil", c: C.pink, w: 140, top: 56, left: -46 },
    { t: "spark", c: C.cyan, w: 70, top: 330, right: -8 },
    { t: "ring", c: C.yellow, w: 110, bottom: 280, left: -24 },
    { t: "dots", c: C.purple, w: 74, bottom: 90, right: -4 },
    { t: "star", c: C.lime, w: 88, bottom: 36, left: -20, r: -6 },
  ],
  hpv: [
    { t: "star", c: C.orange, w: 110, top: 48, right: -18, r: -4 },
    { t: "ring", c: C.lime, w: 110, top: 330, left: -26 },
    { t: "zig", c: C.cyan, w: 120, bottom: 280, right: -28 },
    { t: "coil", c: C.yellow, w: 140, bottom: 90, left: -46 },
    { t: "spark", c: C.pink, w: 66, bottom: 36, right: -6 },
  ],
};

export { LANGS, ORDER, STATUS, CDC, AUTONYM, T, C, SHAPES, DECO };
