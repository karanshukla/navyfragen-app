import assert from "node:assert";
import { describe, test } from "bun:test";

import { findProfanity } from "../lib/profanity";
import { ordinaryWordsToNeverFlag, profaneWordsByLanguage } from "../lib/profanity-wordlists";
import type { ProfanityLanguage } from "../lib/profanity-wordlists";

/**
 * Ordinary sentences in every language the filter screens. They are checked
 * against the whole union of wordlists, not just their own language's — one
 * language's profanity is another's everyday vocabulary, and a flagged message
 * is dropped without telling either party, so a collision here is invisible
 * censorship rather than a visible bug.
 */
const ORDINARY_SENTENCES: Record<ProfanityLanguage, readonly string[]> = {
  en: [
    "Please pass the classic bass guitar to the assembly.",
    "Don't bite off more than you can chew.",
    "The analysis of that passage was thorough.",
    "She grabbed a cocktail at the reception.",
    "He lives in Scunthorpe, north of the river.",
    "The assassin plot was fiction, of course.",
    "I need to book a title for the class.",
    "The dictionary defines it differently.",
  ],
  es: [
    "El níquel es un metal de transición muy común.",
    "Ven acá, mijo, que la cena ya está lista.",
    "El diputado revisó el computador de la oficina.",
    "Compramos un gato negro en el refugio.",
    "Un café con leche, por favor.",
    "La ampolla del pie me duele al caminar.",
    "Hay que calcular el resultado con cuidado.",
    "Es una situación ridícula pero sin importancia.",
    "La pila del reloj se agotó anoche.",
    "El cálculo diferencial es mi asignatura favorita.",
    "El cuadro es una orgía de colores y formas.",
    "La vacuna contra el tétano se pone cada diez años.",
    "El año pasado visitamos a mis abuelos.",
    "Trabajo como programador y arreglo computadoras todo el día.",
    "El diputado presentó su informe ante el Congreso esta mañana.",
    "Tuvieron una disputa larga sobre los términos del contrato.",
    "Compré una ampolla de vitamina C en la farmacia del barrio.",
    "El médico encontró un cálculo renal en la radiografía.",
    "Me parece ridículo que hayan cancelado el concierto sin avisar.",
    "El año pasado viajamos a la costa con toda la familia.",
    "Firmé el documento de forma anónima para proteger mi identidad.",
    "Voy a anotar la dirección nueva en mi agenda.",
    "Mi hijo reconoce que es bastante analfabeto en temas de informática.",
    "La empresa anunció una fuerte penetración de mercado este trimestre.",
    "Al testigo protegido lo apodaron 'Garganta Profunda' en los periódicos.",
    "Sus palabras fueron muy consoladoras después de la mala noticia.",
    "Encontramos una concha preciosa en la orilla del mar.",
    "Mi abuela ya está bastante chocha, pero sigue siendo muy cariñosa.",
    "El vuelo salió retrasado tres horas por el mal tiempo.",
    "Hubo una clara violación de las normas de seguridad en la obra.",
    "En el formulario debes indicar tu sexo y fecha de nacimiento.",
    "Vimos una zorra cruzar el sendero durante la excursión al bosque.",
    "Mi perra tuvo cinco cachorros la semana pasada.",
    "La mamada del bebé duró casi veinte minutos, según la pediatra.",
    "Compramos un paquete de pajitas de colores para la fiesta.",
    "El barco perdió la verga durante la tormenta en alta mar.",
    "En Argentina, a los niños pequeños a veces les dicen 'pendejo' con cariño.",
    "Tuvimos que hacer una corrida hasta la estación para no perder el tren.",
    "El festival de la corrida de toros atrae turistas cada verano.",
    "La ley reconoce los derechos de las personas transexuales en varios países.",
    "El granjero compró un cabrón nuevo para el rebaño de cabras.",
    "Nos reímos mucho viendo el documental sobre pandas gigantes.",
    "El profesor explicó el concepto de anonimato en internet a los alumnos.",
  ],
  pt: [
    "Ele levou uma porrada durante o treino de ontem.",
    "A semente germinou rápido na horta.",
    "Fizemos bicha durante meia hora para entrar no cinema.",
    "O níquel é usado em muitas moedas antigas.",
    "O herdeiro putativo entrou com um recurso.",
    "Comprei uma punheta de caranguejo no restaurante.",
    "O corno do touro estava quebrado.",
    "O trem chegou atrasado, o sinal estava retardado.",
    "Ela guardou as joias num broche de prata.",
    "Havia um boquete estreito na parede da caverna.",
    "Minha cadela adora passear no parque todos os dias.",
    "Compramos uma cabra nova para a fazenda esta semana.",
    "As crianças jogaram bola no jardim até escurecer, usando três bolas diferentes.",
    "Senti uma dor forte no peito depois da corrida.",
    "A mama é examinada anualmente durante o check-up.",
    "O cachorro abanava o rabo de tanta alegria ao ver o dono.",
    "Ela é chinesa e mora em Lisboa há dez anos.",
    "O sofá é feito de madeira e tem um acabamento na cor negro fosco.",
    "No formulário, marque o campo sexo como masculino ou feminino.",
    "O voo chegou retardado por causa da tempestade.",
    "Os jornalistas descreveram a bestialidade dos ataques com muita indignação.",
    "Tivemos de fazer bicha durante uma hora para entrar no museu.",
    "Vimos um veado atravessar a estrada durante a viagem ao campo.",
    "Ele adora gozar da vida e nunca leva nada a sério.",
    "O bebê engatinhava de quatro pela sala inteira.",
    "O touro tinha um corno quebrado depois da briga no curral.",
    "Ela vive pedindo dinheiro emprestado porque nunca tem uma pila no bolso.",
    "Encontramos um boquete estranho na parede do porão.",
    "Minha avó preparou uma punheta de caranguejo deliciosa no almoço de domingo.",
    "Ela usava um broche de prata muito elegante no casaco.",
    "O fazendeiro comprou um cabrão enorme para reproduzir com as cabras.",
    "Meu avô é judeu e celebra o Yom Kippur todos os anos.",
    "A prima dele é lésbica e mora com a namorada há cinco anos.",
    "Ela comprou um sapatão novo para combinar com o vestido.",
    "Havia uma dedada visível no vidro da janela recém-limpa.",
    "A porta ficou arrombada depois da tentativa de assalto.",
    "O contrato foi anulado por causa de uma violação das cláusulas acordadas.",
    "Ele fez um solo de scat impressionante durante o show de jazz.",
    "A criança fez cocô na fralda antes de dormir.",
    "Ela gosta de bater uma foto sempre que viaja para lugares novos.",
    "O artesão entalhou uma caixinha de madeira parecida com uma boceta antiga.",
    "Essa prova de matemática foi muito foda, ninguém terminou a tempo.",
    "Plantamos semente de girassol na horta no fim de semana.",
    "Ele é o filho putativo do antigo rei, segundo a lenda local.",
  ],
  de: [
    "Die Scheibe des Fensters ist gesprungen.",
    "Er studiert Grafik und Design in Berlin.",
    "Wir kaufen Pute zum Abendessen.",
    "Bitte schließ die Tür hinter dir.",
    "Im Dickicht des Waldes war es dunkel.",
    "Die ganze Klasse fährt morgen nach Hamburg.",
    "Auf der Straße war viel Verkehr.",
    "Sie hat den Kasse-Beleg verloren.",
    "Das Wasser floss aus dem Hahn.",
    "Der Anschluss war pünktlich.",
    "Der Film war eine Orgie der Gewalt, sagte die Kritik.",
    "Sie hat die Wichse für ihre Schuhe gekauft.",
    "Die Grafik auf der neuen Website sieht wirklich beeindruckend aus.",
    "Die neue Playstation hat eine beeindruckende Grafikkarte verbaut.",
    "Wir haben am Strand viele bunte Muscheln gesammelt.",
    "Der Marathonläufer musste über zahlreiche Hürden springen.",
    "Mein Nutzen aus dem neuen Kurs war leider gering.",
    "Die Kinder haben im Garten fröhlich im Schlamm gespielt.",
    "Die Kirche hat sich eine neue Orgel für den Gottesdienst angeschafft.",
    "Der Architekt hat die Pläne für das neue Rathaus vorgestellt.",
    "Ich habe mir gestern ein neues Zeitschriften-Abo bestellt.",
    "Bitte schick mir eine Nachricht, wenn du Zeit hast.",
    "Hast du meine E-Mail von letzter Woche schon gelesen?",
    "Der Hund wedelte fröhlich mit dem Schwanz, als er sein Herrchen sah.",
    "Sie trug ihre langen Haare zu einem hohen Pferdeschwanz gebunden.",
    "Nach dem Duschen hat sie sich die Haare geföhnt.",
    "Wir haben zum Frühstück Eier mit Speck gegessen.",
    "Der Tierarzt hat den Hund wegen Wurmbefalls behandelt.",
    "Er hat den ganzen Tag am Fingernagel gekaut, weil er nervös war.",
    "Die Bestialität der Verbrechen erschütterte die ganze Nation.",
    "Der Landwirt kämpfte gegen die Folgen der Inzestzucht in seiner Rinderherde.",
    "Der Kot des Hundes muss von den Gehwegen entfernt werden.",
    "Er hat sich für das Fach Biologie eingeschrieben, um mehr über Sperma und Eizellen zu lernen.",
    "Die Ärztin erklärte die Bedeutung des Anus praeter nach der Operation.",
    "Meine Schwester interessiert sich für die anale Phase nach Freud in ihrem Psychologiestudium.",
    "Wir sind heute Abend zum Essen bei meinen Eltern eingeladen.",
    "Bitte vergiss nicht, den Müll rauszubringen, bevor du gehst.",
    "Kannst du mir bitte helfen, das Regal zusammenzubauen?",
    "Die Katze schlief den ganzen Nachmittag auf dem Sofa.",
    "Die Bäckerei um die Ecke verkauft die besten Brötchen der Stadt.",
    "Ich freue mich schon auf die Sommerferien mit meiner Familie.",
    "Der Zahnarzt hat mir empfohlen, öfter Zahnseide zu benutzen.",
  ],
  fr: [
    "J'ai acheté une salopette pour jardiner ce week-end.",
    "Un pissenlit a poussé juste devant la porte.",
    "La chatte du voisin dort sur le mur toute la journée.",
    "Il faut cultiver sa culture générale.",
    "Elle a mis sa culotte à sécher sur le balcon.",
    "Assez de bruit, on essaie de travailler !",
    "Le violon de ma soeur est dans le grenier.",
    "Une traînée blanche d'avion traversait le ciel.",
    "Il y a une orgie de couleurs dans ce tableau.",
    "Le bordel de la ville a été transformé en musée.",
    "J'ai adopté une chatte noire au refuge la semaine dernière.",
    "Le plombier a changé la pipe sous l'évier ce matin.",
    "Mon grand-père fumait toujours sa pipe après le dîner.",
    "Le boulanger vend un excellent pain bâtard le matin.",
    "Ce chien est un bâtard adorable trouvé dans la rue.",
    "Quel est le sexe du bébé que vous attendez ?",
    "Cette place de parking est réservée aux personnes handicapées.",
    "Ma collègue trans a changé de prénom sur son badge cette année.",
    "Mon voisin juif organise une fête pour Hanouka chaque année.",
    "Elle porte une jolie robe noire pour la soirée.",
    "J'étudie la culture française à l'université depuis deux ans.",
    "Elle porte une culotte en coton blanc très confortable.",
    "Le jardinier doit cultiver ces tomates au printemps.",
    "Le violoniste a joué un solo magnifique lors du concert.",
    "Elle a offert un bouquet de violettes pour son anniversaire.",
    "Le peintre a rincé son pinceau dans le godet avant de continuer.",
    "Le designer a ajouté des godets à la jupe pour plus de fluidité.",
    "Le pianiste a un doigté impressionnant sur cette sonate difficile.",
    "J'ai mal à la gorge depuis hier soir.",
    "La pénétration du marché a augmenté de dix pour cent ce trimestre.",
    "On voyait une traînée de condensation blanche derrière l'avion.",
    "Quel bordel dans ta chambre, range un peu s'il te plaît !",
    "Le chef a préparé une orgie de saveurs pour ce dessert.",
    "Ma tante a acheté une levrette adorable au refuge canin.",
    "Le chaton a fait ses griffes sur le canapé du salon.",
    "Elle a une bonne connaissance de l'histoire de l'art.",
    "Le salaire minimum a augmenté cette année en France.",
    "Mon petit frère avait une drôle de crotte de nez sur son doigt.",
    "Coucou, comment vas-tu aujourd'hui ?",
    "Elle a trouvé une niche de marché intéressante pour sa startup.",
    "Il est tombé sur le cul en glissant sur le trottoir verglacé.",
    "Les randonneurs attardés ont rejoint le groupe une heure plus tard.",
    "L'écrivain a employé un nègre pour rédiger ses mémoires.",
  ],
};

describe("findProfanity", () => {
  test("returns null for empty text", () => {
    assert.strictEqual(findProfanity(""), null);
  });

  test("returns null for clean text", () => {
    assert.strictEqual(findProfanity("hello, how are you today?"), null);
  });

  test("reports the entry that fired, so a silent drop is traceable", () => {
    assert.deepStrictEqual(findProfanity("no me toques los cojones"), {
      word: "cojones",
      language: "es",
    });
  });
});

describe("no ordinary sentence is ever flagged", () => {
  for (const [language, sentences] of Object.entries(ORDINARY_SENTENCES)) {
    for (const sentence of sentences) {
      test(`${language}: ${sentence}`, () => {
        assert.strictEqual(findProfanity(sentence), null);
      });
    }
  }
});

describe("every shipped entry matches its own spelling", () => {
  for (const [language, words] of Object.entries(profaneWordsByLanguage)) {
    for (const { word } of words) {
      test(`${language}: ${word}`, () => {
        assert.notStrictEqual(findProfanity(word), null);
      });
    }
  }
});

describe("screens each language the app offers", () => {
  const flagged: [ProfanityLanguage, string][] = [
    ["en", "you are a fucking idiot"],
    ["es", "eres una mierda de persona"],
    ["pt", "vai tomar no caralho"],
    ["de", "du bist eine dumme fotze"],
    ["fr", "quel connard celui-la"],
  ];
  for (const [language, message] of flagged) {
    test(`${language}: flags "${message}"`, () => {
      assert.notStrictEqual(findProfanity(message), null);
    });
  }
});

describe("catches evasion-shaped input in every language", () => {
  const evasions: [string, string][] = [
    ["leetspeak", "you are a fvcking m0ron"],
    ["repeated characters", "eres una mierrrda"],
    ["leetspeak, Portuguese", "vai tomar no c4ralho"],
    ["mixed case and padding", "Du BiSt eine FoTzE"],
    ["leetspeak, French", "quel c0nnard"],
  ];
  for (const [evasion, message] of evasions) {
    test(evasion, () => {
      assert.notStrictEqual(findProfanity(message), null);
    });
  }
});

describe("cross-language collisions stay clean without opening a hole", () => {
  const pairs: [string, string, string][] = [
    ["fr 'con' cannot ship bare", "un cafe con leche por favor", "quel connard"],
    ["fr 'nique' is not es/pt 'niquel'", "el niquel es un metal comun", "je vais te niquer"],
    ["stems anchor left, not mid-word", "el diputado uso el computador", "esas mierdas otra vez"],
    ["a bounded stem trades reach for safety", "el padre putativo de la obra", "eres una puta"],
    ["trafficking is not profanity", "human trafficking is a serious crime", "fick dich doch"],
    ["the eszett fold is not 'Scheibe'", "die Scheibe ist gesprungen", "so eine Scheisse"],
    ["'fick' does not fire inside 'Grafik'", "er studiert Grafik und Design", "fick dich doch"],
    ["a whitelist entry is not a hole", "assez de bruit ici", "you are an ass"],
  ];
  for (const [rule, ordinary, profane] of pairs) {
    test(`${rule}: accepts the ordinary use`, () => {
      assert.strictEqual(findProfanity(ordinary), null);
    });
    test(`${rule}: still rejects the profane use`, () => {
      assert.notStrictEqual(findProfanity(profane), null);
    });
  }
});

describe("the whitelist only ever suppresses ordinary words", () => {
  for (const word of ordinaryWordsToNeverFlag) {
    test(`does not flag "${word}"`, () => {
      assert.strictEqual(findProfanity(word), null);
    });
  }
});
