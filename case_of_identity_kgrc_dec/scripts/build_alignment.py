#!/usr/bin/env python3
"""Curated (manual) text <-> KGRC alignment for passages relevant to identity, deception,
beliefs, clues and reasoning in "A Case of Identity".

All judgements below were made by reading the normalised text (data/text/sentences.csv) and
the KGRC scenes (data/kgrc/scenes.csv). The script only (1) pulls excerpts by sentence ID,
(2) checks that every cited KGRC IRI exists as a scene in the source graph, (3) computes
coverage counts with explicit denominators, (4) measures agreement of the automatic
candidate alignment (data/kgrc/alignment_auto.csv) with the manual one.

level = "detailed" (central passage, verified scene by scene) | "survey" (whole-story survey)
info_status ∈ observed | reported | believed | hypothesized | reconstructed | admitted |
              predicted | commissive | documentary
coverage ∈ present | partial | absent | distorted | n.d.
Outputs: data/passage_inventory.csv, data/text_graph_alignment.csv, data/alignment_summary.json
Usage: python -I scripts/build_alignment.py <project_root>
"""
import collections
import csv
import json
import os
import sys

import rdflib

D = "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/"

# Fabula reference points (story time). No year or month is given in the text.
# E0 remarriage; E1 gasfitters' ball (W "in France"); E2 Hosmer's call + two walks; E3 W returns;
# E4 W to France "again in a week"; E5 daily letters; E6 H visits, proposal, oath; E7 letter to
# Bordeaux; E8 wedding morning (Friday "the fourteenth"); E9 disappearance; E10 aftermath at home;
# E11 advert (last Saturday); D1 consultation at Baker Street; D2 next day, six o'clock visit.

U = [
 # id, sents, theme, level, enunciator, perspective, content, time, status, iris, coverage, issue, correction
 ("U01", "P015.S01;P016.S01;P016.S02", "clue", "survey", "Holmes / Mary", "Holmes",
  "Holmes infers from appearance that Mary is short-sighted and typewrites; Mary confirms",
  "D1", "hypothesized", "039;040;041;042;043;044;045;047;048", "partial",
  "040 'Myopia is hard to type' rende la domanda inferenziale di Holmes come asserzione; manca la base osservativa (P087)",
  "Separare osservazione (I5 premesse) e conclusione; collegare alla spiegazione P087"),
 ("U02", "P013.S02;P013.S03;P013.S05;P013.S06", "reasoning", "survey", "Holmes", "Holmes",
  "Holmes abduces a love matter (affaire de coeur) from the visitor's oscillation",
  "D1", "hypothesized", "015;016;017;018;019;020;021;022;023;026;027;028;029", "distorted",
  "018/026 inglese illeggibile ('color love Saya'): traduzione automatica di 色恋沙汰; generalizzazione resa come fatti con infoSource Holmes",
  "Rileggere il testo; marcare come inferenza abduttiva generica"),
 ("U03", "P018.S03", "motive", "detailed", "Mary", "Mary",
  "Mary has a hundred a year in her own right besides her earnings and wants to know what became of Hosmer Angel",
  "D1 (stato)", "reported", "056;057;060", "distorted",
  "057 'earns one hundred dollars a year': valuta errata (dollars) e 'earns' invece di rendita propria; il desiderio di sapere diventa 060 'Holmes find Hosmer'",
  "Rendita come E97/attributo monetario con fonte Mary; desiderio come stato attribuito"),
 ("U04", "P020.S02;P020.S03", "deception", "detailed", "Mary", "Mary (su Windibank)",
  "Windibank took it all easily, would not go to the police or to Holmes, kept saying there was no harm done",
  "E10", "reported", "063;064;065;066;067;67a", "partial",
  "'kept on saying that there was no harm done' (atto comunicativo di Windibank) assente; 065 'Windibank is naive' interpreta 'easy way'",
  "Aggiungere atto comunicativo di Windibank riferito da Mary"),
 ("U05", "P022.S02", "identity", "survey", "Mary", "Mary",
  "The stepfather is only five years and two months older than Mary",
  "D1 (stato)", "reported", "069", "present", "", ""),
 ("U06", "P024.S02", "motive", "survey", "Mary", "Mary",
  "Mother remarried soon after father's death a man nearly fifteen years younger than herself",
  "E0", "reported", "072", "partial",
  "Differenza d'età (premessa del movente in P126.S01) assente", "Aggiungere differenza d'età come affermazione di Mary"),
 ("U07", "P024.S04", "motive", "survey", "Mary", "Mary",
  "The business was sold for £4700, less than father could have got if alive",
  "E0", "reported", "077;079;080;081;082", "distorted",
  "Il controfattuale di Mary diventa un pensiero del padre defunto (081 think → 082 Thought '4700 pounds is small') con infoSource d:Father_of_Sutherland (IRI diverso dalla Person d:father_of_Sutherland)",
  "Valutazione di Mary; nessuno stato mentale del padre"),
 ("U08", "P027.S02;P027.S03;P027.S04", "motive", "detailed", "Mary", "Mary",
  "Income left by uncle Ned in Auckland: New Zealand stock at 4½ per cent, £2500 principal, she can only touch the interest",
  "D1 (stato)", "reported", "087;088;089;090;091;092;093", "distorted",
  "091 'quarter and five o'clock' per 4½ per cent (errore di traduzione); 093 'Sutherland gives yield' inverte il senso",
  "Ricodificare importi e tasso"),
 ("U09", "P029.S01;P029.S02;P029.S03", "motive", "detailed", "Mary", "Mary",
  "While she lives at home the family has the use of her money; Windibank draws her interest every quarter and pays it to her mother",
  "D1 (stato)", "reported", "102;103;104;105;106", "partial",
  "105 'draws a quarter from the yield' ambiguo (quarter = trimestre); 'only just for the time' (temporaneità) assente",
  "Rappresentare il flusso economico come premessa del movente con fonte Mary"),
 ("U10", "P031.S04;P031.S05;P031.S06;P031.S08;P031.S09", "deception", "survey", "Mary", "Mary (su Windibank)",
  "Windibank opposed the ball: said the folk were not fit to know and that she had nothing fit to wear",
  "E1-", "reported", "117;118;119;120;121;122;123;124;125;127;128", "partial",
  "117 'Windibank does not know' (notAccept) traduzione incoerente; 127 'Windibank said' è Situation (fatto narrativo) dentro la testimonianza di Mary",
  "Atti comunicativi di Windibank riferiti da Mary"),
 ("U11", "P031.S10", "timeline", "detailed", "Mary", "Mary",
  "When nothing else would do, Windibank went off to France on the firm's business; Mary, mother and Hardy went to the ball, where Mary met Hosmer Angel",
  "E1", "reported", "130;132;133;134", "present",
  "Presente come affermazioni di Mary (infoSource Sutherland); manca il collegamento con la smentita P128.S07",
  "Collegare alla ricostruzione come credenza di Mary in disaccordo"),
 ("U12", "P033.S01;P033.S02", "deception", "survey", "Mary", "Mary (su Windibank)",
  "On returning, Windibank was very good about it, laughed and said there was no use denying anything to a woman",
  "E3", "reported", "138;139;140;141;142;143", "partial",
  "139 Thought 'Windibank is happy' con infoSource d:Sutherland_s_thoughts (nodo fittizio invece di Mary)", ""),
 ("U13", "P035.S02", "timeline", "detailed", "Mary", "Mary",
  "Hosmer called the next day, they met twice for walks, then father came back and Hosmer could not come to the house any more",
  "E2-E3", "reported", "144;145;146;147;148;149;150;151;152", "present",
  "Successione degli incontri preservata come affermazioni di Mary; l'alternanza Hosmer/Windibank resta implicita", ""),
 ("U14", "P039.S01", "deception", "detailed", "Mary (riferisce Hosmer)", "Hosmer (as reported by Mary)",
  "Father was going to France again in a week; Hosmer wrote it would be safer not to see each other until he had gone",
  "E4", "reported", "155;159;160;161", "partial",
  "161 senza hasPredicate (contenuto vuoto) e infoSource d:Hosmer_s_statement anziché Hosmer; il motivo dichiarato ('safer') assente",
  "Atto comunicativo di Hosmer (lettera) riferito da Mary; contenuto proposizionale esplicito"),
 ("U15", "P039.S02;P039.S03", "belief", "survey", "Mary", "Mary",
  "They wrote daily; Mary took the letters in the morning so father need not know",
  "E5", "reported", "163;164;165;166", "partial",
  "166 'Windibank does not know the letter' è una credenza di Mary (falsa nella ricostruzione) codificata come Statement non distinto da un fatto", ""),
 ("U16", "P041.S03", "deception", "detailed", "Mary (riferisce Hosmer)", "Hosmer (as reported by Mary)",
  "Hosmer Angel was a cashier in an office in Leadenhall Street",
  "E2-E6", "reported", "167;168;169;170", "distorted",
  "168 'teller of Redon Hall Street office' (Leadenhall tradotto male); l'autodescrizione di Hosmer (insincera nella ricostruzione) è resa come affermazione di Mary senza l'atto originario di Hosmer",
  "Due livelli: Hosmer afferma → Mary riferisce; valore di verità separato"),
 ("U17", "P049.S01;P049.S02", "deception", "detailed", "Mary (riferisce Hosmer)", "Hosmer (as reported by Mary)",
  "Letters went to Leadenhall Street Post Office; Hosmer said office letters would bring chaff from clerks and that typewritten letters felt as if the machine came between them",
  "E5", "reported", "171;172;173;174;176;178;179;179a;180;181", "partial",
  "Giustificazioni di Hosmer presenti (infoSource d:Hosmer_s_statement); 172 'address is on Redon Hall Street' contraddice P046/P047 (Mary non conosce l'indirizzo)",
  "Correggere 172; mantenere il livello Hosmer→Mary"),
 ("U18", "P051.S02;P051.S04;P051.S05;P051.S06", "identity", "detailed", "Mary (in parte riferisce Hosmer)", "Mary",
  "Hosmer walked in the evening, had a whispering voice from quinsy (he told her), weak eyes and tinted glasses",
  "E2-E6", "reported", "187;188;192;193;194;195;197;198;199;200;201", "partial",
  "'he told me' (causa della voce dichiarata da Hosmer) non distinta da ciò che Mary osserva; 195 'tonsillitis'",
  "Distinguere osservazione di Mary da dichiarazione di Hosmer"),
 ("U19", "P053.S01;P053.S02", "deception", "detailed", "Mary", "Mary / Hosmer",
  "Hosmer proposed marrying before father came back and made Mary swear on the Testament to be true to him whatever happened",
  "E6", "commissive", "202;203;203a;204;205;205a;206;207", "distorted",
  "Il giuramento (impegno di Mary) è codificato come credenza: 207 'Sutherland believes in Hosmer' (pred:believe); 203 Thought di Hosmer con infoSource d:Hosmer_s_thoughts",
  "Atto commissivo (E7 locale) distinto da I2 Belief"),
 ("U20", "P053.S03;P053.S04;P053.S05", "mother", "detailed", "Mary", "Mary (sulla madre)",
  "Mother said he was right to make her swear, was all in his favour and fonder of him than Mary; both said never to mind father",
  "E6", "reported", "208;209;212;213;214;215", "partial",
  "Presenti come affermazioni di Mary; 214 'Worries About Windibank' con predicato notWorry (etichetta e predicato discordi); 'mother said she would make it all right with him' → 215 'corresponds to Windibank'",
  "Mantenere come evidenza riferita, non come prova di complicità"),
 ("U21", "P053.S07;P055.S01", "timeline", "detailed", "Mary", "Mary",
  "Mary wrote to father at Bordeaux; the letter came back on the wedding morning because he had started for England just before it arrived",
  "E7-E8", "reported", "216;216a;217;218;219;220;221", "partial",
  "221 datato 1891-08-27, dopo 219 (1891-08-14): incoerenza temporale; la spiegazione del ritorno della lettera è di Mary (o di chi gliel'ha data), non un fatto",
  "Tempo relativo; spiegazione come credenza di Mary"),
 ("U22", "P057.S03;P057.S04;P057.S05", "deception", "detailed", "Mary (riferisce il cabman)", "Mary",
  "Hosmer put them in a hansom, took a four-wheeler, never stepped out at the church; the cabman had seen him get in",
  "E8-E9", "reported", "226;227;228;228a;229;230;231;232;233;234;235;236;237", "partial",
  "Sequenza presente; 228 'mother of Sutherland and Sutherland's mother' (traduzione); 237 infoSource d:The_speaker_s_statement invece del cabman",
  ""),
 ("U23", "P059.S02;P059.S03", "belief", "detailed", "Mary (riferisce Hosmer)", "Mary; Hosmer",
  "Mary: he was too good to leave her; Hosmer had said whatever happened she was to be true and that something unforeseen might separate them",
  "E8 / D1", "believed", "239;240;241;242;243;244;245;247;248", "distorted",
  "244 'Sutherland believes in Hosmer' sotto 243 (Hosmer said) e 245 (Sutherland swore): impegno e credenza confusi; l'allusione a 'something unforeseen' (strumento dell'inganno, P128.S09) assente",
  "Separare: credenza di Mary (D1), dichiarazione di Hosmer (E8), allusione ingannevole"),
 ("U24", "P061.S02;P061.S03", "belief", "detailed", "Mary", "Mary",
  "Mary believes Hosmer foresaw some danger and that what he foresaw happened",
  "D1", "believed", "249;250;252;253;254", "partial",
  "Credenza di Mary resa come Thought (250 'Hosmer knew about the danger') con infoSource d:Sutherland_s_thoughts; 'what he foresaw happened' assente",
  "I2 di Mary su contenuto annidato (Hosmer prevede)"),
 ("U25", "P065.S01", "mother", "detailed", "Mary", "Mary (sulla madre)",
  "Mother was angry and said Mary was never to speak of the matter again",
  "E10", "reported", "255;256;257;258", "partial",
  "257 'mother said to Sutherland' è Situation (fatto del narratore) benché noto solo dalla testimonianza di Mary; 258 infoSource d:mother_of_Sutherland&#39_s_remark (IRI malformato)",
  "Atto della madre riferito da Mary"),
 ("U26", "P067.S01;P067.S02", "deception", "detailed", "Mary (riferisce Windibank)", "Windibank (as reported by Mary)",
  "Windibank seemed to think, with Mary, that something had happened and that she would hear of Hosmer again; 'what interest could anyone have...'",
  "E10", "reported", "259;260", "distorted",
  "'seemed to think' (attribuzione cauta di Mary) diventa 259 Situation 'Windibank said' (fatto narrativo) + 260 'Hosmer will contact Sutherland' (infoSource Windibank); persa la domanda retorica che è il nucleo dell'inganno",
  "Atto di Windibank riferito da Mary; credenza di Windibank NON annotata; candidato a insincerità solo sotto la ricostruzione"),
 ("U27", "P067.S03", "motive", "survey", "Mary", "Mary",
  "Hosmer was very independent about money and never looked at a shilling of hers",
  "E2-E8", "believed", "261;262;263", "present", "", ""),
 ("U28", "P068.S03;P069.S01;P070.S01", "belief", "detailed", "Holmes", "Holmes",
  "Holmes advises Mary to let Hosmer vanish from her memory; asked if she will see him again: 'I fear not'",
  "D1", "predicted", "266;267;268;269;270", "partial",
  "Consiglio di Holmes reso come 269 'Sutherland forgets Hosmer' (fatto); 270 'Sutherland can not see Hosmer' perde il valore predittivo",
  "Previsione/consiglio di Holmes; segnala conoscenza parziale al checkpoint C1"),
 ("U29", "P073.S01;P073.S02", "clue", "survey", "Mary", "Mary",
  "Mary advertised in last Saturday's Chronicle and hands over the slip and four letters",
  "E11 / D1", "observed", "273;274;275;276", "present", "274 source 'Last Saturday' (contenuto quasi vuoto)", ""),
 ("U30", "P077.S01", "clue", "detailed", "Mary", "Mary",
  "Windibank travels for Westhouse & Marbank, claret importers of Fenchurch Street",
  "D1 (stato)", "reported", "277;280;281", "distorted",
  "280 ha subject d:Windibank ma source@en 'Hosmer is a foreign company in West House & Marbank': il letterale nomina Hosmer (fuga potenziale della soluzione in simulazione)",
  "Correggere il letterale; escluderlo dai checkpoint"),
 ("U31", "P079.S02;P079.S03", "belief", "detailed", "Mary", "Mary",
  "Mary will be true to Hosmer; he shall find her ready when he comes back",
  "D1", "commissive", "285;286;287", "distorted",
  "287 'Sutherland believes in Hosmer' (pred:believe) per un impegno; l'aspettativa del ritorno (credenza di Mary al termine della visita) assente",
  "Impegno + credenza che Hosmer tornerà (I2, D1)"),
 ("U32", "P093.S01;P093.S02;P093.S03;P093.S04", "identity", "detailed", "advertisement (Mary)", "Mary",
  "Printed description: missing on the fourteenth; 5 ft 7; strongly built; sallow; black hair, bald centre; bushy whiskers and moustache; tinted glasses; slight infirmity of speech; dress; employed in Leadenhall Street",
  "E9 / E11", "documentary", "353;354;355;356;357;358;359;360;361;362;363;364;365;366;367", "partial",
  "Descrizione presente come Statement con infoSource Watson (che legge), non come documento redatto da Mary; 360 'small boat on the top of Hosmer's head' (traduzione); 367 'In the past'",
  "Documento (E33/E31) con autore Mary; contenuto separato"),
 ("U33", "P094.S02;P096.S01;P096.S02;P096.S03;P096.S04", "typewriter", "detailed", "Holmes / Watson", "Holmes",
  "The letters are typewritten, including the signature; only 'Leadenhall Street' as superscription; Holmes calls the signature point conclusive",
  "D1", "observed", "368;369;370;371;372;373;374;375;376", "partial",
  "373 'Signature is Hosmer Aingel' (refuso); 'conclusive' (giudizio di Holmes) ridotto a 376 'Signature is important'",
  "Osservazione documentale + valutazione di Holmes come premessa"),
 ("U34", "P099.S01;P100.S01", "reasoning", "detailed", "Watson / Holmes", "Watson; Holmes",
  "Watson's hypothesis: typed signature to deny it in a breach-of-promise action; Holmes: 'that was not the point'",
  "D1", "hypothesized", "377;378;380;381;382", "partial",
  "Ipotesi di Watson presente (378, 380) e respinta da Holmes (382 'not important'); 380 'Hosma received an appeal' distorce il condizionale",
  "Ipotesi alternativa esplicita (conjecture) respinta"),
 ("U35", "P100.S02;P100.S03", "reasoning", "detailed", "Holmes", "Holmes",
  "Holmes will write two letters, to a firm in the City and to Windibank, asking him to come at six tomorrow",
  "D1", "reported", "383;385;386;387;388;389;389a", "present",
  "383 'disappearance resolves' if 385: condizionale presente", ""),
 ("U36", "P107.S03", "reasoning", "survey", "Holmes", "Holmes",
  "Before Windibank arrives Holmes says there is no law that can touch the scoundrel",
  "D2", "hypothesized", "395;396;397", "partial", "397 'Holmes can not catch the villain' altera 'no law can touch'", ""),
 ("U37", "P111.S01", "identity", "detailed", "Watson (narrator)", "Watson",
  "Windibank: sturdy, middle-sized, about thirty, clean-shaven, sallow, bland insinuating manner, sharp penetrating grey eyes",
  "D2", "observed", "401;402;403;404;405;406;407", "present",
  "Situation del narratore: corretta collocazione; contrasto con 200 'Hosmer's eyes are bad' non esplicitato", ""),
 ("U38", "P112.S01;P113.S03;P113.S04;P113.S06", "deception", "detailed", "Windibank", "Windibank",
  "Windibank: the typewritten letter is his; Mary came against his wishes; 'how could you possibly find this Hosmer Angel?'",
  "D2", "reported", "412;413;414;415;416;417;418;419;420;421;422;423;424;425;425a;426;427", "partial",
  "427 'Holmes can not find Hosmer' è Situation (fatto) sotto 426 'Windibank thinks': ma 426 non ha infoSource e 427 nemmeno; la domanda retorica diventa credenza",
  "Atto di Windibank; credenza non attribuita automaticamente"),
 ("U39", "P114.S01;P115.S01;P115.S02", "deception", "detailed", "Holmes / Windibank / narrator", "Watson; Windibank",
  "Holmes: he will succeed in discovering Hosmer Angel; Windibank starts violently, drops his gloves, says he is delighted",
  "D2", "observed", "428;429;430;431;432;433", "partial",
  "430/431 frammentati (430 senza predicato, 431 senza soggetto); 432 'Windibank was pleased' prende alla lettera l'enunciato 'delighted' (insincero nella ricostruzione)",
  "Reazione osservata (narratore) vs dichiarazione di Windibank"),
 ("U40", "P116.S01;P116.S02;P116.S04;P116.S05", "typewriter", "detailed", "Holmes", "Holmes",
  "Typewriters have individuality; Windibank's note shows slurred 'e', defective 'r' tail and fourteen other characteristics",
  "D2", "observed", "434;435;436;438;439", "present",
  "436/438 source 'In the Windibank letter' (contenuto ridotto)", ""),
 ("U41", "P117.S01", "typewriter", "detailed", "Windibank", "Windibank",
  "We do all our correspondence with this machine at the office, and no doubt it is a little worn",
  "D2", "admitted", "440;441;443", "distorted",
  "441 'workplace has one machine' perde 'all our correspondence' (macchina condivisa da più persone): premessa che lascia aperta l'alternativa di altri dattilografi",
  "Riportare l'uso condiviso: alternativa compatibile per T09"),
 ("U42", "P118.S04;P118.S05;P118.S06", "typewriter", "detailed", "Holmes", "Holmes",
  "The four letters purporting to come from the missing man are typewritten with the same 'e', 'r' and fourteen other characteristics",
  "D2", "observed", "444;445;446;447;448;449;450", "present",
  "Presente; 'purport to come from' (attribuzione d'autore sospesa) assente", ""),
 ("U43", "P120.S02;P121.S01;P123.S01;P123.S02", "deception", "detailed", "Holmes / Windibank / narrator", "Watson; Windibank",
  "'I have caught him!'; Windibank turns white, collapses, stammers 'It—it's not actionable'",
  "D2", "admitted", "458;459;460;461;462;463;464;465;466;467;468;469;470;471", "distorted",
  "471 'Holmes does not sue Windibank' per 'It's not actionable' (ammissione implicita persa); 462 'asked where Hosmer was' interpreta 'What! where?'",
  "Ammissione implicita come evidenza, non come confessione esplicita"),
 ("U44", "P126.S01;P126.S02;P126.S05;P126.S06", "motive", "detailed", "Holmes", "Holmes",
  "The man married an older woman for her money, enjoyed the daughter's money; her marriage would mean losing a hundred a year; he kept her at home",
  "E0-E1", "reconstructed", "472;475;476;478;479;480;484;486;488;490;491", "present",
  "Presente con infoSource Holmes; il movente 'for her money' è attribuzione di Holmes, non verificata altrove", ""),
 ("U45", "P126.S11", "identity", "detailed", "Holmes", "Holmes",
  "With the connivance and assistance of his wife he disguised himself (tinted glasses, moustache and whiskers, whisper) and appeared as Mr. Hosmer Angel",
  "E1-E9", "reconstructed", "496;497;498;499;500;501;503;504;505;507", "partial",
  "504 'Windibank is Hosmer' = d:Windibank kgc:hasProperty pred:Hosmer (pred:Hosmer ≠ d:Hosmer): identità non utilizzabile come owl:sameAs; 507 'Sutherland loves Windibank' sostituisce il referente dentro l'atteggiamento di Mary (opacità violata)",
  "Identità come conclusione di Holmes (I5→I2) con contesto; Mary ama Hosmer de dicto"),
 ("U46", "P127.S01;P127.S02", "mother", "detailed", "Windibank", "Windibank",
  "'It was only a joke at first'; 'We never thought that she would have been so carried away'",
  "D2", "admitted", "508;509", "distorted",
  "508 'Windibank did not think of' + 509 'Windibank robs Sutherland' (heart): persi 'joke' e il plurale 'We' (unico indizio verbale di complicità della madre da parte di Windibank)",
  "Ammissione parziale; 'we' come evidenza indiretta sul coinvolgimento della madre"),
 ("U47", "P128.S02;P128.S03", "belief", "detailed", "Holmes", "Holmes (su Mary)",
  "Having made up her mind that her stepfather was in France, Mary never suspected treachery; her mother's admiration increased the effect",
  "E1-E9", "reconstructed", "510;511;512;513;514", "partial",
  "Annidamento presente: 512 (Holmes: Sutherland thinks) → 513 Thought 'Windibank is in France' (infoSource d:Sutherland_s_thoughts); 'never suspected treachery' assente",
  "Holmes attribuisce a Mary una credenza (livello 2)"),
 ("U48", "P128.S07", "timeline", "detailed", "Holmes", "Holmes",
  "These pretended journeys to France were rather cumbrous",
  "E1-E7", "reconstructed", "", "absent",
  "Nessuna scena codifica che i viaggi in Francia fossero simulati: la divergenza con U11/U14/U21 non è esplicita nel grafo",
  "Aggiungere la proposizione nella ricostruzione di Holmes"),
 ("U49", "P128.S09;P128.S10;P128.S11", "deception", "detailed", "Holmes", "Holmes (su Windibank)",
  "Vows on a Testament and allusions to something happening were exacted so that she would be bound to Hosmer Angel for ten years; he vanished by the four-wheeler trick",
  "E6-E9", "reconstructed", "520;521;522;524;525;527;527a;528;529;530;531;532;534;535;537;538", "partial",
  "Intenzione ingannevole presente (530 want → 531); 524 'heart engrave Windibank' e 518 sostituiscono il referente",
  "Intenzione come stato attribuito da Holmes"),
 ("U50", "P130.S01;P130.S02", "deception", "detailed", "Windibank", "Windibank",
  "'It may be so, or it may not'; nothing actionable; Holmes is breaking the law by locking the door",
  "D2", "reported", "539;540;541;542;543;544;547", "distorted",
  "542 'Windibank does not know the facts' per 'It may be so, or it may not' (non-conferma resa come ignoranza)",
  "Non-conferma esplicita: la ricostruzione resta non confessata"),
 ("U51", "P134.S01;P134.S02;P134.S03;P134.S04", "reasoning", "detailed", "Holmes", "Holmes",
  "Reasoning: only the stepfather profited; the two men never together; spectacles, voice, whiskers hinted disguise; typed signature implied handwriting familiar to her",
  "D2", "reconstructed", "558;559;560;561;562;563;564;565;566;568", "partial",
  "Premesse presenti con infoSource Holmes ma senza struttura inferenziale (nessun because/therefore tra premesse e identità); 568 'Sutherland notices Windibank handwriting' rende categorico il controfattuale 'would recognise'",
  "I5 Inference Making con J1 premesse, J2 conclusione; modalità preservata"),
 ("U52", "P136.S03;P136.S04;P136.S05;P136.S06", "typewriter", "detailed", "Holmes (riferisce la ditta)", "Holmes",
  "Description stripped of disguise sent to the firm; Windibank's typed reply shows the same defects; the firm replies the description tallies with James Windibank",
  "D1-D2", "reconstructed", "569;570;571;572;573;574;575;576;577", "partial",
  "577 'The document is Windibank' (Personal_statement is Windibank, infoSource someone_of_Company): la corrispondenza descrizione→impiegato è distorta; 570 'removed eyebrows'",
  "Lettera della ditta come documento con contenuto proposizionale"),
 ("U53", "P138.S01", "ending", "detailed", "Holmes", "Holmes (su Mary)",
  "If I tell her she will not believe me",
  "D2 (futuro ipotetico)", "predicted", "578;579;580", "distorted",
  "578 'Sutherland does not believe in Holmes' è categorico; 579 Situation vuota con kgc:if 580; nessun legame 578↔579: il condizionale è perso; nessun evento in cui Mary riceve la spiegazione (corretto: non esiste nel testo)",
  "Previsione condizionale di Holmes in un contesto ipotetico; nessuna revisione delle credenze di Mary"),
 ("U54", "P080.S02", "belief", "survey", "Watson (narrator)", "Watson",
  "Mary leaves with a promise to come again whenever summoned (she is never summoned within the text)",
  "D1", "observed", "288;289;290;290a", "present", "", ""),
 ("U55", "P087.S07;P087.S08;P087.S10", "clue", "survey", "Holmes", "Holmes",
  "Holmes explains the plush marks and the pince-nez dints as evidence of typewriting and short sight",
  "D1", "reconstructed", "322;330;331;333;334;335;336;337;339", "partial", "Premesse e conclusioni appiattite in Statement", ""),
]


def main(root):
    sents = {r["sent_id"]: r for r in csv.DictReader(open(os.path.join(root, "data/text/sentences.csv"), encoding="utf-8"))}
    g = rdflib.Graph()
    g.parse(os.path.join(root, "sources/kgrc/ACaseOfIdentity.ttl"), format="turtle")
    subjects = set(g.subjects())
    auto = {r["scene"]: r for r in csv.DictReader(open(os.path.join(root, "data/kgrc/alignment_auto.csv"), encoding="utf-8"))}
    rows, missing = [], []
    for (uid, sids, theme, level, enun, persp, content, time, status, iris, cov, issue, corr) in U:
        sl = [s for s in sids.split(";") if s]
        for s in sl:
            if s not in sents:
                missing.append((uid, "sentence", s))
        excerpt = " ".join(sents[s]["text"] for s in sl if s in sents)
        il = [i for i in iris.split(";") if i]
        for i in il:
            if rdflib.URIRef(D + i) not in subjects:
                missing.append((uid, "iri", i))
        paras = sorted({sents[s]["para_id"] for s in sl if s in sents})
        # agreement of the automatic candidate alignment with this manual unit (paragraph level, ±1)
        pnums = {int(p[1:]) for p in paras}
        agree = sum(1 for i in il if ("d:" + i) in auto and any(abs(int(auto["d:" + i]["para_id"][1:]) - p) <= 1 for p in pnums))
        rows.append({"unit_id": uid, "level": level, "theme": theme, "sent_ids": ";".join(sl), "para_ids": ";".join(paras),
                     "printed_page": sents[sl[0]]["para_id"] and "", "excerpt": excerpt[:300] + ("…" if len(excerpt) > 300 else ""),
                     "enunciator": enun, "perspective": persp, "propositional_content": content, "story_time": time,
                     "info_status": status, "kgrc_iris": ";".join("d:" + i for i in il), "coverage": cov,
                     "issue": issue, "correction": corr, "verification": "manual",
                     "auto_alignment_agreement": f"{agree}/{len(il)}" if il else "n/a"})
    segs = {r["para_id"]: r for r in csv.DictReader(open(os.path.join(root, "data/text/segments.csv"), encoding="utf-8"))}
    for r in rows:
        r["printed_page"] = segs[r["para_ids"].split(";")[0]]["printed_page_start"] if r["para_ids"] else ""
    if missing:
        print("MISSING REFERENCES:", missing)
        sys.exit(1)
    fields = list(rows[0].keys())
    with open(os.path.join(root, "data/text_graph_alignment.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows([r for r in rows if r["level"] == "detailed"])
    with open(os.path.join(root, "data/passage_inventory.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["unit_id", "level", "theme", "sent_ids", "para_ids", "printed_page", "enunciator", "info_status", "coverage", "kgrc_iris", "propositional_content"])
        w.writeheader()
        w.writerows([{k: r[k] for k in w.fieldnames} for r in rows])
    summ = {}
    for name, sel in (("survey_all_units", rows), ("detailed_units", [r for r in rows if r["level"] == "detailed"])):
        c = collections.Counter(r["coverage"] for r in sel)
        summ[name] = {"denominator_units": len(sel), "coverage_counts": dict(c),
                      "by_theme": {t: dict(collections.Counter(r["coverage"] for r in sel if r["theme"] == t)) for t in sorted({r["theme"] for r in sel})},
                      "by_info_status": {t: dict(collections.Counter(r["coverage"] for r in sel if r["info_status"] == t)) for t in sorted({r["info_status"] for r in sel})}}
    tot_iris = sum(len(r["kgrc_iris"].split(";")) for r in rows if r["kgrc_iris"])
    agree_n = sum(int(r["auto_alignment_agreement"].split("/")[0]) for r in rows if r["auto_alignment_agreement"] != "n/a")
    summ["auto_vs_manual"] = {"scene_iris_in_manual_units": tot_iris, "auto_candidate_within_1_paragraph": agree_n,
                              "note": "agreement measured only on scenes cited in manual units; not a global accuracy"}
    summ["distinct_scenes_cited"] = len({i for r in rows for i in r["kgrc_iris"].split(";") if i})
    summ["text_units_denominator_note"] = "units are curated passage groups (1-6 sentences); story has 138 paragraphs / 391 sentences"
    summ["sentences_covered_by_units"] = len({s for r in rows for s in r["sent_ids"].split(";")})
    with open(os.path.join(root, "data/alignment_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summ, f, indent=2, ensure_ascii=False)
    print(json.dumps(summ, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
