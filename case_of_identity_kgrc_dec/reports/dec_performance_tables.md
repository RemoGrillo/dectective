# Tabelle di prestazione (generate da `scripts/render_performance_tables.py`)

Tempi in millisecondi; mediane su 10 ripetizioni a JVM calda (dopo 1 warm-up) salvo 'cold' (media di 3 JVM nuove).
Conteggi dall'ultima ripetizione (deterministici). Definizioni in `dec_performance.md`.

## 1. DEC per query (slice)

| query | mondi | coppie | asserite | materializzate | permeate | inf. banali | inf. tassonomiche | inf. sostanziali | diagn. DEC | mediana ms | IQR | cold ms | 1ª query ms | overhead vs ctx | utilità |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T01a_identity_in_reality | 3 | 1 | 126 | 2998 | 878 | 1929 | 13 | 49 | 3 | 121.5 | 67.1 | 528.3 | 1.17 | 0.93 | 0.0003 |
| T01b_identity_in_holmes_world | 3 | 1 | 126 | 2998 | 878 | 1929 | 13 | 49 | 3 | 121.2 | 54.5 | 488.5 | 1.22 | 0.80 | 0.0000 |
| T01c_identity_consequence | 3 | 1 | 126 | 2998 | 878 | 1929 | 13 | 49 | 3 | 104.0 | 61.6 | 451.5 | 0.66 | 0.91 | 0.0003 |
| T02a_mary_identity | 4 | 3 | 154 | 4130 | 1844 | 2050 | 16 | 61 | 5 | 157.5 | 75.8 | 630.2 | 0.78 | 0.78 | 0.0000 |
| T02b_mary_opacity | 4 | 3 | 154 | 4130 | 1844 | 2050 | 16 | 61 | 5 | 158.7 | 84.2 | 657.0 | 0.84 | 0.77 | 0.0000 |
| T02c_mary_engaged_de_re_reality | 4 | 3 | 154 | 4130 | 1844 | 2050 | 16 | 61 | 5 | 168.5 | 65.4 | 655.6 | 0.71 | 0.80 | 0.0003 |
| T03a_weak_sight_not_fact | 4 | 3 | 157 | 4176 | 1860 | 2071 | 16 | 61 | 11 | 2 046.2 | 127.2 | 3 049.3 | 0.61 | 9.27 | 0.0000 |
| T03b_where_engaged_to_windibank | 4 | 3 | 157 | 4176 | 1860 | 2071 | 16 | 61 | 11 | 2 043.3 | 109.8 | 2 998.5 | 0.80 | 9.06 | 0.0000 |
| T03c_engaged_only_under_hypothesis | 4 | 3 | 96 | 3896 | 1898 | 1860 | 7 | 30 | 5 | 138.8 | 55.0 | 566.3 | 1.29 | 0.79 | 0.0003 |
| T04a_acts | 4 | 3 | 174 | 3769 | 1040 | 2175 | 105 | 270 | 5 | 238.6 | 31.5 | 841.5 | 1.16 | 0.97 | 0.0014 |
| T04b_said_vs_true | 4 | 3 | 144 | 3084 | 894 | 1978 | 13 | 50 | 5 | 137.9 | 85.7 | 518.7 | 1.15 | 0.80 | 0.0000 |
| T05a_content_vs_speaker_belief | 8 | 21 | 201 | 6277 | 3252 | 2389 | 98 | 294 | 43 | 15 432.5 | 228.6 | 16 189.9 | 1.00 | 25.74 | 0.0008 |
| T05b_sincere_but_false | 8 | 21 | 201 | 6277 | 3252 | 2389 | 98 | 294 | 43 | 15 571.6 | 224.2 | 16 129.7 | 1.58 | 26.63 | 0.0002 |
| T06a_belief_worlds_vs_reality | 5 | 6 | 175 | 5266 | 2838 | 2164 | 16 | 61 | 12 | 3 821.6 | 86.9 | 4 784.2 | 1.21 | 14.62 | 0.0002 |
| T06b_mary_delusional_label | 5 | 6 | 175 | 5266 | 2838 | 2164 | 16 | 61 | 12 | 3 811.4 | 56.0 | 4 696.9 | 0.63 | 14.56 | 0.0002 |
| T06c_ablation | 4 | 3 | 155 | 4158 | 1852 | 2071 | 16 | 55 | 9 | 2 111.9 | 62.0 | 3 881.5 | 1.23 | 9.63 | 0.0003 |
| T07a_C3 | 4 | 3 | 82 | 3898 | 1998 | 1784 | 4 | 25 | 5 | 1 399.7 | 68.8 | 2 264.7 | 1.21 | 9.97 | 0.0000 |
| T07b_C4 | 5 | 6 | 93 | 4985 | 2969 | 1866 | 10 | 33 | 14 | 3 636.9 | 89.0 | 4 710.0 | 1.25 | 17.29 | 0.0002 |
| T07c_watson | 4 | 3 | 130 | 4281 | 2078 | 2005 | 13 | 49 | 6 | 2 126.5 | 72.9 | 3 390.8 | 0.63 | 10.09 | 0.0000 |
| T08a_identity_C2 | 3 | 1 | 67 | 2720 | 938 | 1688 | 2 | 22 | 3 | 96.5 | 35.8 | 410.6 | 0.99 | 0.74 | 0.0000 |
| T08b_identity_C3 | 4 | 3 | 88 | 3993 | 2048 | 1819 | 4 | 30 | 4 | 127.0 | 56.1 | 569.6 | 0.76 | 0.81 | 0.0000 |
| T08c_identity_C4 | 4 | 3 | 105 | 3830 | 1768 | 1899 | 13 | 40 | 5 | 163.6 | 67.8 | 705.1 | 0.80 | 0.88 | 0.0003 |
| T08d_same_machine_C3 | 4 | 3 | 88 | 3993 | 2048 | 1819 | 4 | 30 | 4 | 139.3 | 49.0 | 545.9 | 0.92 | 0.93 | 0.0003 |
| T08e_mary_unchanged_C4 | 4 | 3 | 105 | 3830 | 1768 | 1899 | 13 | 40 | 5 | 166.5 | 78.3 | 598.8 | 0.90 | 0.88 | 0.0000 |
| T09a_typed_on_office_machine | 5 | 6 | 93 | 5059 | 3093 | 1848 | 3 | 9 | 13 | 2 522.9 | 68.0 | 3 599.7 | 0.93 | 19.36 | 0.0008 |
| T09b_same_machine_not_fact | 5 | 6 | 93 | 5059 | 3093 | 1848 | 3 | 9 | 13 | 2 526.9 | 71.6 | 3 558.4 | 0.63 | 20.43 | 0.0000 |
| T09c_authorship_alternatives | 5 | 6 | 93 | 5059 | 3093 | 1848 | 3 | 9 | 13 | 2 592.7 | 137.1 | 3 668.7 | 1.24 | 19.76 | 0.0008 |
| T10a_no_telling_event | 4 | 3 | 176 | 4727 | 2052 | 2193 | 97 | 205 | 4 | 170.3 | 92.8 | 764.4 | 0.89 | 0.96 | 0.0000 |
| T10b_rejection_only_predicted | 4 | 3 | 146 | 3890 | 1760 | 1963 | 8 | 9 | 4 | 123.5 | 77.0 | 450.5 | 1.50 | 0.98 | 0.0000 |
| T10c_mary_last_belief | 4 | 3 | 146 | 3890 | 1760 | 1963 | 8 | 9 | 4 | 116.4 | 68.1 | 417.5 | 1.02 | 0.82 | 0.0000 |

## 2. Confronto tra configurazioni per query (mediana ms di materializzazione / triple materializzate)

| query | asserted | flat | ctx | dec |
|---|---|---|---|---|
| T01a_identity_in_reality | 1.3 / 126 | 97.4 / 1140 | 130.1 / 2897 | 121.5 / 2998 |
| T01b_identity_in_holmes_world | 1.7 / 126 | 130.9 / 1140 | 151.4 / 2897 | 121.2 / 2998 |
| T01c_identity_consequence | 1.6 / 126 | 100.8 / 1140 | 114.0 / 2897 | 104.0 / 2998 |
| T02a_mary_identity | 1.5 / 154 | 131.0 / 1222 | 201.1 / 4000 | 157.5 / 4130 |
| T02b_mary_opacity | 1.8 / 154 | 172.9 / 1222 | 207.2 / 4000 | 158.7 / 4130 |
| T02c_mary_engaged_de_re_reality | 1.9 / 154 | 124.7 / 1222 | 209.7 / 4000 | 168.5 / 4130 |
| T03a_weak_sight_not_fact | 2.0 / 157 | 143.3 / 1239 | 220.8 / 4037 | 2 046.2 / 4176 |
| T03b_where_engaged_to_windibank | 1.7 / 157 | 131.9 / 1239 | 225.6 / 4037 | 2 043.3 / 4176 |
| T03c_engaged_only_under_hypothesis | 1.6 / 96 | 92.9 / 1060 | 176.1 / 3641 | 138.8 / 3896 |
| T04a_acts | 2.7 / 174 | 152.0 / 1496 | 245.2 / 4595 | 238.6 / 3769 |
| T04b_said_vs_true | 1.8 / 144 | 134.2 / 1195 | 173.0 / 3876 | 137.9 / 3084 |
| T05a_content_vs_speaker_belief | 3.1 / 201 | 154.4 / 1550 | 599.5 / 9160 | 15 432.5 / 6277 |
| T05b_sincere_but_false | 2.6 / 201 | 152.1 / 1550 | 584.7 / 9160 | 15 571.6 / 6277 |
| T06a_belief_worlds_vs_reality | 2.4 / 175 | 142.4 / 1294 | 261.3 / 5092 | 3 821.6 / 5266 |
| T06b_mary_delusional_label | 2.6 / 175 | 139.6 / 1294 | 261.8 / 5092 | 3 811.4 / 5266 |
| T06c_ablation | 2.0 / 155 | 151.6 / 1230 | 219.3 / 4021 | 2 111.9 / 4158 |
| T07a_C3 | 1.7 / 82 | 84.3 / 1012 | 140.4 / 3487 | 1 399.7 / 3898 |
| T07b_C4 | 1.9 / 93 | 94.9 / 1049 | 210.4 / 4476 | 3 636.9 / 4985 |
| T07c_watson | 1.9 / 130 | 111.5 / 1174 | 210.8 / 3853 | 2 126.5 / 4281 |
| T08a_identity_C2 | 1.6 / 67 | 75.2 / 945 | 130.7 / 2529 | 96.5 / 2720 |
| T08b_identity_C3 | 1.6 / 88 | 135.2 / 1037 | 156.1 / 3551 | 127.0 / 3993 |
| T08c_identity_C4 | 1.8 / 105 | 119.0 / 1085 | 185.3 / 3733 | 163.6 / 3830 |
| T08d_same_machine_C3 | 1.6 / 88 | 128.4 / 1037 | 149.5 / 3551 | 139.3 / 3993 |
| T08e_mary_unchanged_C4 | 2.0 / 105 | 115.2 / 1085 | 188.1 / 3733 | 166.5 / 3830 |
| T09a_typed_on_office_machine | 1.7 / 93 | 85.3 / 1037 | 130.3 / 4422 | 2 522.9 / 5059 |
| T09b_same_machine_not_fact | 1.9 / 93 | 86.6 / 1037 | 123.7 / 4422 | 2 526.9 / 5059 |
| T09c_authorship_alternatives | 1.8 / 93 | 86.0 / 1037 | 131.2 / 4422 | 2 592.7 / 5059 |
| T10a_no_telling_event | 2.9 / 176 | 84.5 / 1435 | 176.9 / 4538 | 170.3 / 4727 |
| T10b_rejection_only_predicted | 2.1 / 146 | 74.4 / 1150 | 126.3 / 3814 | 123.5 / 3890 |
| T10c_mary_last_belief | 2.0 / 146 | 60.8 / 1150 | 141.8 / 3814 | 116.4 / 3890 |

## 3. Aggregati sulle 30 query

| metrica | flat | ctx | dec |
|---|---|---|---|
| materializzazione ms (mediana delle mediane) | 121.8 | 181.1 | 169.4 |
| materializzazione a freddo ms (mediana) | 361.3 | 734.7 | 734.7 |
| triple materializzate (mediana) | 1 150.0 | 4 000.0 | 4 130.0 |
| inferenze sostanziali (mediana) | 34.0 | 8.0 | 49.0 |
| ridondanza tra mondi (mediana) | 1.0 | 3.4 | 3.4 |
| throughput triple/s (mediana) | 9 940.1 | 20 018.5 | 22 689.3 |
| materializzazione ms (media) | 116.4 | 206.1 | 2 069.8 |
| amplificazione (media geometrica) | 9.1 | 32.1 | 32.5 |
| conoscenza nuova sostanziale / asserite (media geometrica) | 0.250 | 0.069 | 0.339 |
| risposte conformi all'attesa (su 29) | 10 | 15 | 28 |
| overhead DEC vs ctx / vs flat (media geometrica) | | | 2.94 / 4.90 |

## 4. Fasi DEC (esecuzione strumentata, una per query; quota sul totale di `handlePermeation`)

| query | totale ms | permeazione+inferenza mondi % | verifyInconsistencies % | verifyClosedFor % | restore % |
|---|---|---|---|---|---|
| T01a_identity_in_reality | 400.9 | 69.6 | 0.0 | 0.0 | 29.3 |
| T01b_identity_in_holmes_world | 418.6 | 69.2 | 0.0 | 0.0 | 29.5 |
| T01c_identity_consequence | 465.3 | 72.1 | 0.0 | 0.0 | 26.8 |
| T02a_mary_identity | 625.9 | 60.9 | 0.0 | 0.0 | 38.1 |
| T02b_mary_opacity | 630.1 | 59.0 | 0.0 | 0.0 | 40.1 |
| T02c_mary_engaged_de_re_reality | 587.6 | 63.9 | 0.0 | 0.0 | 35.2 |
| T03a_weak_sight_not_fact | 3 026.1 | 10.8 | 89.0 | 0.0 | 0.1 |
| T03b_where_engaged_to_windibank | 3 013.6 | 12.4 | 87.4 | 0.0 | 0.1 |
| T03c_engaged_only_under_hypothesis | 241.2 | 96.0 | 0.0 | 0.0 | 1.7 |
| T04a_acts | 802.2 | 69.4 | 0.0 | 0.0 | 30.0 |
| T04b_said_vs_true | 472.0 | 66.4 | 0.0 | 0.0 | 32.5 |
| T05a_content_vs_speaker_belief | 15 930.1 | 4.1 | 95.5 | 0.3 | 0.0 |
| T05b_sincere_but_false | 16 083.4 | 3.6 | 95.8 | 0.5 | 0.0 |
| T06a_belief_worlds_vs_reality | 4 873.8 | 7.5 | 92.3 | 0.0 | 0.0 |
| T06b_mary_delusional_label | 4 948.6 | 8.7 | 91.1 | 0.0 | 0.0 |
| T06c_ablation | 3 162.1 | 13.2 | 86.5 | 0.0 | 0.1 |
| T07a_C3 | 3 165.0 | 7.5 | 92.3 | 0.0 | 0.1 |
| T07b_C4 | 4 885.4 | 10.5 | 89.4 | 0.0 | 0.0 |
| T07c_watson | 3 348.8 | 15.8 | 84.0 | 0.0 | 0.1 |
| T08a_identity_C2 | 223.1 | 95.1 | 0.0 | 0.0 | 2.2 |
| T08b_identity_C3 | 265.9 | 95.0 | 0.0 | 0.0 | 2.6 |
| T08c_identity_C4 | 579.0 | 67.4 | 0.0 | 0.0 | 31.4 |
| T08d_same_machine_C3 | 267.0 | 96.0 | 0.0 | 0.0 | 1.8 |
| T08e_mary_unchanged_C4 | 535.9 | 64.2 | 0.0 | 0.0 | 34.5 |
| T09a_typed_on_office_machine | 3 682.7 | 6.6 | 92.1 | 1.1 | 0.0 |
| T09b_same_machine_not_fact | 3 674.1 | 6.6 | 92.0 | 1.2 | 0.0 |
| T09c_authorship_alternatives | 3 594.3 | 7.5 | 90.8 | 1.5 | 0.0 |
| T10a_no_telling_event | 444.5 | 51.9 | 0.0 | 0.0 | 46.6 |
| T10b_rejection_only_predicted | 273.7 | 60.7 | 0.0 | 0.0 | 36.9 |
| T10c_mary_last_belief | 271.3 | 63.2 | 0.0 | 0.0 | 34.6 |

## 5. Dataset completi senza slicing (una esecuzione; query sonda)

| dataset | quadruple in input | mondi | coppie | dec s | ctx s | flat s | triple materializzate dec / ctx / flat |
|---|---|---|---|---|---|---|---|
| C1 | 359 | 7 | 15 | 55.2 | 3.0 | 1.0 | 12990 / 15586 / 2545 |
| C2 | 368 | 8 | 21 | 76.0 | 3.1 | 1.0 | 15968 / 17817 / 2609 |
| C3 | 392 | 12 | 55 | 213.7 | 3.7 | 1.3 | 25181 / 26670 / 2759 |
| C4 | 397 | 13 | 66 | 330.7 | 4.3 | 1.3 | 28166 / 28887 / 2778 |
| gold | 465 | 16 | 105 | 496.6 | 4.9 | 1.4 | 32326 / 35899 / 3132 |

Slice/completo (triple): mediana 0.302, min 0.188, max 0.445. Risposte preservate (ctx, slice vs completo): 30/30. Materializzazione strumentata equivalente (SHA-256): 30/30.

## 6. Serie di sensibilità (base: slice di T06a_belief_worlds_vs_reality; 3 ripetizioni, mediana)

| serie | valore | input | mondi | coppie | dec ms | ctx ms | dec/ctx |
|---|---|---|---|---|---|---|---|
| A: triple di sfondo | 0 | 179 | 5 | 6 | 4 376.0 | 467.3 | 9.4 |
| A: triple di sfondo | 250 | 429 | 5 | 6 | 3 843.9 | 539.9 | 7.1 |
| A: triple di sfondo | 500 | 679 | 5 | 6 | 3 999.7 | 527.3 | 7.6 |
| A: triple di sfondo | 1000 | 1179 | 5 | 6 | 3 971.3 | 458.8 | 8.7 |
| A: triple di sfondo | 2000 | 2179 | 5 | 6 | 4 244.8 | 566.8 | 7.5 |
| A: triple di sfondo | 4000 | 4179 | 5 | 6 | 4 061.0 | 624.5 | 6.5 |
| B: mondi in più | 2 | 187 | 7 | 15 | 8 944.5 | 583.8 | 15.3 |
| B: mondi in più | 4 | 195 | 9 | 28 | 15 865.9 | 736.3 | 21.5 |
| B: mondi in più | 8 | 211 | 13 | 66 | 35 159.9 | 747.7 | 47.0 |
| B: mondi in più | 16 | 243 | 21 | 190 | 102 560.2 | 927.6 | 110.6 |
