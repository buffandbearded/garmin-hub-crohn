"""Builds recipes.json (Croatian recipes with computed macros).

Edit INGREDIENTS / RECIPES below and run:  python recipes_build.py
Macros are per serving, computed from the ingredient table (approximate values per 100 g, raw weights).
Flags: gluten=1 if any ingredient contains gluten (oats are flagged conservatively because of cross-contamination),
lactose=1 if any ingredient contains lactose (lactose-free milk counts as lactose-free).
"""
import json
from pathlib import Path

# key: (naziv, kcal, protein, ugljikohidrati, masti, vlaknine, gluten, laktoza, g_po_komadu)   -- per 100 g
INGREDIENTS = {
    "pileca_prsa": ("pileća prsa (sirova)", 120, 22.5, 0, 2.6, 0, 0, 0, None),
    "pileci_zabatak": ("pileći zabatak bez kože i kosti (sirov)", 121, 19.7, 0, 4.1, 0, 0, 0, None),
    "pureca_prsa": ("pureća prsa (sirova)", 114, 24, 0, 1.5, 0, 0, 0, None),
    "mljevena_puretina": ("mljevena puretina (sirova)", 150, 19, 0, 8, 0, 0, 0, None),
    "mljevena_junetina": ("mljevena junetina, 10 % masti (sirova)", 176, 20, 0, 10, 0, 0, 0, None),
    "jaja": ("jaja", 143, 12.6, 0.7, 9.5, 0, 0, 0, 50),
    "sunka": ("pureća šunka", 110, 17, 1.5, 4, 0, 0, 0, None),
    "riza": ("riža (sirova)", 360, 7, 79, 0.6, 1.3, 0, 0, None),
    "tjestenina": ("tjestenina (sirova)", 360, 12.5, 72, 1.5, 3, 1, 0, None),
    "krumpir": ("krumpir", 77, 2, 17, 0.1, 2.2, 0, 0, None),
    "zob": ("zobene pahuljice", 380, 13, 66, 7, 10, 1, 0, None),
    "banana": ("banana", 89, 1.1, 23, 0.3, 2.6, 0, 0, 120),
    "kikiriki_maslac": ("maslac od kikirikija", 590, 25, 20, 50, 6, 0, 0, None),
    "mlijeko_bl": ("bezlaktozno mlijeko", 54, 3.4, 4.9, 2.8, 0, 0, 0, None),
    "med": ("med", 304, 0.3, 82, 0, 0, 0, 0, None),
    "ulje": ("maslinovo ulje", 884, 0, 0, 100, 0, 0, 0, None),
    "passata": ("pasirana rajčica", 32, 1.5, 6, 0.2, 1.5, 0, 0, None),
    "luk": ("luk", 40, 1.1, 9, 0.1, 1.7, 0, 0, None),
    "mrkva": ("mrkva", 41, 0.9, 10, 0.2, 2.8, 0, 0, None),
    "grasak": ("grašak (smrznuti)", 77, 5, 14, 0.4, 5, 0, 0, None),
    "tortilja": ("pšenična tortilja", 310, 8.5, 52, 7, 3, 1, 0, 65),
    "kruh": ("bijeli kruh / zemička", 265, 9, 49, 3.2, 2.7, 1, 0, None),
    "mrvice": ("krušne mrvice", 395, 13, 72, 5, 4, 1, 0, None),
    "sir": ("sir (edamer / gauda)", 356, 25, 2, 27, 0, 0, 1, None),
    "jogurt": ("grčki jogurt", 110, 9, 4, 5.9, 0, 0, 1, None),
    "paprika": ("crvena paprika", 31, 1, 6, 0.3, 2.1, 0, 0, None),
}

R = []

R.append(dict(
    id="piletina-riza-povrce", naziv="Piletina s rižom i povrćem (u kuhalu za rižu)",
    opis="Cijeli obrok u jednoj posudi. Idealno za batch: skuhate jednom, jedete 3 dana.",
    porcije=4, vrijeme=40, aktivno=15, batch=True,
    oprema=["štednjak (tava)", "Xiaomi kuhalo za rižu"],
    tagovi=["batch", "meal prep"],
    sastojci=[("riza", 400), ("pileci_zabatak", 800), ("ulje", 50), ("luk", 120), ("mrkva", 240), ("grasak", 160)],
    koraci=[
        "Zabatak narežite na kockice od oko 2 cm, posolite, popaprite i dodajte malo slatke mljevene paprike ili kurkume.",
        "Luk sitno nasjeckajte, a mrkvu naribajte ili narežite na tanke kolutiće.",
        "U tavi zagrijte ulje i 5 minuta pecite meso dok ne dobije boju, zatim dodajte luk i mrkvu i pirjajte još 3 minute.",
        "Rižu dobro isperite pod hladnom vodom i stavite u posudu kuhala. Dodajte sadržaj tave, grašak i 600 ml vode (oko 1,5 ml vode na 1 g riže).",
        "Posolite, promiješajte i pokrenite standardni program kuhanja riže. Kad završi, ostavite poklopljeno još 10 minuta.",
        "Provjerite da u piletini nema ružičastih dijelova. Podijelite na 4 posude; u hladnjaku do 3 dana, grijte dok ne postane vruće.",
    ],
    napomena="Bez glutena i bez laktoze. Mrkva i grašak su blagi na okus; ako grašak ne prija, zamijenite ga s još mrkve.",
))

R.append(dict(
    id="omlet-sunka-sir", naziv="Omlet s 4 jaja, šunkom i sirom",
    opis="Brzi, proteinski bogat doručak ili večera.",
    porcije=1, vrijeme=12, aktivno=12,
    oprema=["štednjak (tava)"],
    tagovi=["brzo"],
    sastojci=[("jaja", 200), ("sunka", 60), ("sir", 40), ("ulje", 10), ("kruh", 80)],
    koraci=[
        "Jaja razbijte u zdjelu, posolite, popaprite i lagano umutite vilicom.",
        "Šunku narežite na trakice, sir naribajte.",
        "U tavi zagrijte ulje na srednjoj vatri i ulijte jaja.",
        "Kad se rubovi stegnu (oko 2 min), na jednu polovicu stavite šunku i sir.",
        "Preklopite omlet i pecite još 1 do 2 minute. Poslužite s kruhom.",
    ],
    napomena="Bez glutena: izostavite kruh (ili jedite kuhani krumpir). Bez laktoze: izostavite sir. Izračun je s kruhom i sirom.",
))

R.append(dict(
    id="kajgana-riza-sunka", naziv="Kajgana s rižom i šunkom",
    opis="Dobar način za iskoristiti rižu iz batcha.",
    porcije=1, vrijeme=20, aktivno=10,
    oprema=["štednjak (tava)", "Xiaomi kuhalo za rižu"],
    tagovi=["brzo"],
    sastojci=[("riza", 90), ("jaja", 150), ("sunka", 50), ("grasak", 40), ("ulje", 10)],
    koraci=[
        "Rižu (90 g sirove) skuhajte u kuhalu s 135 ml vode. Ako već imate gotovu rižu, upotrijebite oko 270 g kuhane.",
        "Šunku narežite na kockice. Jaja umutite sa solju i paprom.",
        "U tavi zagrijte ulje, dodajte šunku i grašak i pržite 2 minute.",
        "Dodajte rižu i zagrijavajte 2 minute, zatim sve gurnite na stranu i u slobodni dio ulijte jaja.",
        "Miješajte jaja dok se ne stegnu, pa sve povežite i poslužite.",
    ],
    napomena="Bez glutena i bez laktoze.",
))

R.append(dict(
    id="krumpir-jaja-friteza", naziv="Krumpir iz zračne friteze s jajima i šunkom",
    opis="Hrskavi krumpir i kajgana. Brzo i jeftino.",
    porcije=1, vrijeme=30, aktivno=12,
    oprema=["zračna friteza", "štednjak (tava)"],
    tagovi=[],
    sastojci=[("krumpir", 400), ("jaja", 150), ("sunka", 40), ("luk", 40), ("paprika", 50), ("ulje", 15)],
    koraci=[
        "Krumpir ogulite i narežite na kockice od oko 2 cm. Promiješajte s 10 g ulja i solju.",
        "Stavite u zračnu fritezu na 200 °C i pecite 18 do 20 minuta, protresite košaru na pola vremena.",
        "U tavi na preostalih 5 g ulja pirjajte sitno narezan luk i papriku 4 minute, dodajte šunku.",
        "Dodajte umućena jaja i miješajte 2 minute dok se ne stegnu.",
        "Pomiješajte s krumpirom i poslužite odmah.",
    ],
    napomena="Bez glutena i bez laktoze.",
))

R.append(dict(
    id="zabatak-krumpir-friteza", naziv="Pileći zabatak i krumpir iz zračne friteze",
    opis="Gotovo bez rada: sve ide u friteza.",
    porcije=2, vrijeme=35, aktivno=10,
    oprema=["zračna friteza"],
    tagovi=[],
    sastojci=[("pileci_zabatak", 500), ("krumpir", 800), ("ulje", 30)],
    koraci=[
        "Meso začinite solju, paprom, slatkom paprikom, češnjakom u prahu i 15 g ulja.",
        "Krumpir ogulite, narežite na krupnije kockice i promiješajte s 15 g ulja i solju.",
        "Zračnu fritezu zagrijte na 200 °C. Najprije pecite krumpir 10 minuta.",
        "Dodajte meso i pecite još 15 do 18 minuta, protresite na pola vremena. Ako je košara mala, pecite u dvije serije.",
        "Meso mora biti potpuno pečeno (bistar sok, bez ružičaste boje; unutarnja temperatura 75 °C).",
    ],
    napomena="Bez glutena i bez laktoze.",
))

R.append(dict(
    id="okruglice-pire", naziv="Mesne okruglice u umaku od rajčice s pireom",
    opis="Klasik za batch. Pire s bezlaktoznim mlijekom.",
    porcije=4, vrijeme=60, aktivno=30, batch=True,
    oprema=["štednjak"],
    tagovi=["batch", "meal prep", "lako za jelo"],
    sastojci=[("mljevena_junetina", 600), ("mrvice", 60), ("jaja", 100), ("luk", 80), ("passata", 500),
              ("ulje", 80), ("krumpir", 1000), ("mlijeko_bl", 200)],
    koraci=[
        "Krumpir ogulite, narežite i kuhajte u slanoj vodi oko 20 minuta dok ne omekša.",
        "U zdjeli pomiješajte mljeveno meso, mrvice, jaja, sitno nasjeckan luk, sol i papar. Oblikujte kuglice veličine oraha (oko 24 komada).",
        "U velikoj tavi zagrijte 40 g ulja i pecite okruglice 6 do 8 minuta uz okretanje.",
        "Dodajte pasiranu rajčicu, malo soli i 100 ml vode, poklopite i kuhajte na tihoj vatri 15 minuta.",
        "Krumpir ocijedite i zgnječite, dodajte toplo bezlaktozno mlijeko i preostalih 40 g ulja pa miješajte do glatkog pirea.",
        "Podijelite na 4 porcije. Okruglice moraju biti potpuno pečene iznutra. U hladnjaku do 3 dana.",
    ],
    napomena="Mrvice sadrže gluten. Možete ih zamijeniti kuhanom rižom (oko 100 g), tada je jelo bez glutena.",
))

R.append(dict(
    id="tjestenina-puretina", naziv="Tjestenina s mljevenom puretinom i umakom od rajčice",
    opis="Jednostavan batch obrok.",
    porcije=4, vrijeme=35, aktivno=20, batch=True,
    oprema=["štednjak"],
    tagovi=["batch", "meal prep"],
    sastojci=[("tjestenina", 400), ("mljevena_puretina", 600), ("passata", 500), ("luk", 120), ("ulje", 40)],
    koraci=[
        "Luk sitno nasjeckajte i pirjajte na ulju 4 minute.",
        "Dodajte puretinu i pecite 8 minuta uz mrvljenje dok ne izgubi ružičastu boju.",
        "Dodajte pasiranu rajčicu, sol, papar i origano te kuhajte 15 minuta na tihoj vatri.",
        "Tjesteninu skuhajte u slanoj vodi prema uputi na pakiranju i ocijedite.",
        "Pomiješajte s umakom i podijelite na 4 porcije. U hladnjaku do 3 dana.",
    ],
    napomena="Sadrži gluten (tjestenina). Bez laktoze.",
))

R.append(dict(
    id="bowl-junetina-riza-jaja", naziv="Bowl s mljevenom junetinom, rižom i jajima",
    opis="Brz, sitan i sit obrok.",
    porcije=1, vrijeme=25, aktivno=12,
    oprema=["štednjak (tava)", "Xiaomi kuhalo za rižu"],
    tagovi=["brzo"],
    sastojci=[("mljevena_junetina", 150), ("riza", 100), ("jaja", 100), ("ulje", 10), ("paprika", 50)],
    koraci=[
        "Rižu (100 g) skuhajte u kuhalu s 150 ml vode.",
        "Papriku narežite na kockice. U tavi zagrijte pola ulja i pecite mljeveno meso 8 minuta uz mrvljenje, začinite solju i paprom.",
        "Dodajte papriku i pecite još 2 minute. Meso izvadite na tanjur.",
        "U istoj tavi na preostalom ulju ispecite dva jaja (oko 3 minute).",
        "Složite u zdjelu: riža, meso s paprikom i jaja na vrhu.",
    ],
    napomena="Bez glutena i bez laktoze.",
))

R.append(dict(
    id="purecna-prsa-friteza", naziv="Pureća prsa iz zračne friteze s rižom i mrkvom",
    opis="Čist, proteinski bogat obrok.",
    porcije=1, vrijeme=25, aktivno=10,
    oprema=["zračna friteza", "Xiaomi kuhalo za rižu"],
    tagovi=["brzo"],
    sastojci=[("pureca_prsa", 200), ("riza", 110), ("mrkva", 80), ("ulje", 20)],
    koraci=[
        "Rižu (110 g) skuhajte u kuhalu s 165 ml vode i prstohvatom soli.",
        "Prsa narežite na dvije debele šnicle (oko 2 cm), premažite s 10 g ulja, posolite i popaprite.",
        "Mrkvu narežite na štapiće i promiješajte s malo soli.",
        "Zračna friteza 200 °C: šnicle i mrkva zajedno 12 do 14 minuta, okrenite na pola vremena. Unutarnja temperatura mesa mora biti 74 °C.",
        "Rižu prelijte preostalih 10 g ulja i poslužite uz meso i mrkvu.",
    ],
    napomena="Bez glutena i bez laktoze.",
))

R.append(dict(
    id="krem-juha-krumpir-piletina", naziv="Krem juha od krumpira i piletine",
    opis="Tekuća i lagana za jelo, dobra kad nemate apetita. Kalorije u tekućem obliku.",
    porcije=3, vrijeme=40, aktivno=15, batch=True,
    oprema=["štednjak", "blender / štapni mikser"],
    tagovi=["batch", "lako za jelo", "gusto"],
    sastojci=[("krumpir", 700), ("pileca_prsa", 450), ("mrkva", 200), ("luk", 100), ("ulje", 45), ("riza", 90)],
    koraci=[
        "Luk i mrkvu narežite i pirjajte na ulju 4 minute.",
        "Dodajte oguljen narezan krumpir, ispranu rižu, piletinu u komadima, sol i 1,2 l vode.",
        "Kuhajte na tihoj vatri 25 minuta do mekoće.",
        "Izvadite piletinu, usitnite je vilicom ili nožem i ostavite sa strane.",
        "Ostatak izmiksajte do glatkoće u blenderu (u manjim obrocima, ostavite otvor za paru jer je vruće).",
        "Vratite piletinu u juhu, zagrijte i podijelite na 3 porcije (oko 500 ml). U hladnjaku do 3 dana.",
    ],
    napomena="Bez glutena i bez laktoze. Za više kalorija dodajte žlicu ulja po porciji.",
))

R.append(dict(
    id="shake-kikiriki", naziv="Kalorijski shake: banana, kikiriki maslac, mlijeko, med",
    opis="Lako za popiti kad ne možete jesti. Oko 750 kcal.",
    porcije=1, vrijeme=5, aktivno=5,
    oprema=["blender"],
    tagovi=["brzo", "lako za jelo", "gusto"],
    sastojci=[("banana", 150), ("kikiriki_maslac", 50), ("mlijeko_bl", 450), ("med", 25)],
    koraci=[
        "Sve sastojke stavite u blender.",
        "Miksajte 30 do 40 sekundi dok ne bude glatko.",
        "Pijte polako, kroz 10 do 15 minuta.",
    ],
    napomena="Bez glutena i bez laktoze. Za više proteina možete dodati protein u prahu (provjerite sadrži li laktozu).",
))

R.append(dict(
    id="shake-zob-jogurt", naziv="Shake sa zobi, jogurtom i bananom",
    opis="Gust shake, otprilike 850 kcal.",
    porcije=1, vrijeme=8, aktivno=8,
    oprema=["blender"],
    tagovi=["brzo", "lako za jelo", "gusto"],
    sastojci=[("zob", 60), ("banana", 120), ("jogurt", 150), ("kikiriki_maslac", 25), ("mlijeko_bl", 300), ("med", 15)],
    koraci=[
        "Zobene pahuljice 5 minuta namočite u mlijeku.",
        "Sve prebacite u blender i dodajte ostale sastojke.",
        "Miksajte 40 sekundi dok ne bude glatko.",
    ],
    napomena="Sadrži laktozu (jogurt) i potencijalno gluten (zob). Dobar za testiranje reakcija jedno po jedno.",
))

R.append(dict(
    id="zobena-kasa-mikrovalna", naziv="Zobena kaša s bananom i kikiriki maslacem (mikrovalna)",
    opis="Gotova za 5 minuta, meka i lagana za jelo.",
    porcije=1, vrijeme=6, aktivno=5,
    oprema=["mikrovalna"],
    tagovi=["brzo", "lako za jelo", "gusto"],
    sastojci=[("zob", 80), ("mlijeko_bl", 300), ("banana", 120), ("kikiriki_maslac", 25), ("med", 15)],
    koraci=[
        "Zob i mlijeko stavite u veliku posudu za mikrovalnu (kaša se digne).",
        "Grijte 2,5 do 3 minute na 800 W, promiješajte nakon 1,5 minute.",
        "Dodajte narezanu bananu, kikiriki maslac i med pa promiješajte.",
    ],
    napomena="Zob može sadržavati tragove glutena. Bez laktoze.",
))

R.append(dict(
    id="palacinke-zob-banana", naziv="Palačinke od zobi i banane",
    opis="Tijesto iz blendera, bez brašna.",
    porcije=1, vrijeme=15, aktivno=15,
    oprema=["blender", "štednjak (tava)"],
    tagovi=["brzo", "lako za jelo"],
    sastojci=[("zob", 80), ("banana", 120), ("jaja", 100), ("mlijeko_bl", 100), ("ulje", 10), ("med", 20)],
    koraci=[
        "Zob, bananu, jaja i mlijeko izmiksajte u blenderu do glatkog tijesta.",
        "Tavu lagano premažite uljem i zagrijte na srednjoj vatri.",
        "Ulijte po 3 do 4 žlice tijesta, pecite 2 minute sa svake strane.",
        "Poslužite s medom.",
    ],
    napomena="Zob može sadržavati tragove glutena. Bez laktoze.",
))

R.append(dict(
    id="riza-s-mlijekom", naziv="Riža s mlijekom i bananom",
    opis="Slatki međuobrok, vrlo lagan za želudac.",
    porcije=1, vrijeme=25, aktivno=5,
    oprema=["štednjak"],
    tagovi=["lako za jelo", "gusto"],
    sastojci=[("riza", 60), ("mlijeko_bl", 400), ("banana", 100), ("med", 20)],
    koraci=[
        "Rižu isperite i stavite u lonac s mlijekom i prstohvatom soli.",
        "Zakuhajte pa smanjite na tihu vatru i kuhajte 18 do 20 minuta uz često miješanje (mlijeko lako zagori).",
        "Maknite s vatre, dodajte med i narezanu bananu.",
    ],
    napomena="Bez glutena i bez laktoze (bezlaktozno mlijeko).",
))

R.append(dict(
    id="tortilja-piletina-sir", naziv="Tortilja s piletinom, paprikom i sirom",
    opis="Brzi wrap, dobar i hladan za van.",
    porcije=1, vrijeme=20, aktivno=15,
    oprema=["štednjak (tava)", "zračna friteza (po želji)"],
    tagovi=["brzo"],
    sastojci=[("tortilja", 130), ("pileca_prsa", 180), ("sir", 40), ("paprika", 50), ("ulje", 10)],
    koraci=[
        "Prsa narežite na trakice, posolite i popaprite.",
        "Pecite na ulju 6 do 8 minuta dok nisu potpuno pečena. Papriku narežite na trakice.",
        "Na tortilje poslažite meso, papriku i naribani sir, zamotajte.",
        "Zagrijte u tavi ili u zračnoj fritezi 3 minute na 180 °C da sir omekša.",
    ],
    napomena="Sadrži gluten (tortilja) i laktozu (sir).",
))

R.append(dict(
    id="jogurt-med-banana-zob", naziv="Grčki jogurt s medom, bananom i zobi",
    opis="Međuobrok bez kuhanja.",
    porcije=1, vrijeme=5, aktivno=5,
    oprema=[],
    tagovi=["brzo", "lako za jelo"],
    sastojci=[("jogurt", 250), ("med", 25), ("banana", 120), ("zob", 40)],
    koraci=[
        "Jogurt stavite u zdjelu.",
        "Dodajte narezanu bananu, zobene pahuljice i med.",
        "Promiješajte i jedite odmah ili ostavite 10 minuta da zob omekša.",
    ],
    napomena="Sadrži laktozu i potencijalno gluten (zob). Upotrijebite za test svakog sastojka zasebno.",
))

R.append(dict(
    id="zapecenji-krumpir-meso", naziv="Zapečeni krumpir s mljevenim mesom",
    opis="Jedno-posudni obrok iz pećnice.",
    porcije=4, vrijeme=70, aktivno=25, batch=True,
    oprema=["štednjak", "pećnica"],
    tagovi=["batch", "meal prep"],
    sastojci=[("krumpir", 1200), ("mljevena_junetina", 600), ("luk", 120), ("passata", 300), ("ulje", 60)],
    koraci=[
        "Pećnicu zagrijte na 200 °C.",
        "Krumpir ogulite, narežite na ploške debljine oko 5 mm i prokuhajte 5 minuta u slanoj vodi, pa ocijedite.",
        "U tavi na 20 g ulja pirjajte sitno nasjeckan luk 4 minute, dodajte meso i pecite 8 minuta.",
        "Dodajte pasiranu rajčicu, sol i papar i kuhajte 10 minuta.",
        "U vatrostalnu posudu složite pola krumpira, preko njega meso, pa ostatak krumpira. Prelijte s 40 g ulja i posolite.",
        "Pecite 30 minuta dok ne dobije zlatnu koricu. Podijelite na 4 porcije; u hladnjaku do 3 dana.",
    ],
    napomena="Bez glutena i bez laktoze.",
))

R.append(dict(
    id="burger-friteza", naziv="Burger iz zračne friteze s krumpirićima",
    opis="Domaća pljeskavica i krumpirići bez prženja u dubokom ulju.",
    porcije=1, vrijeme=30, aktivno=12,
    oprema=["zračna friteza"],
    tagovi=[],
    sastojci=[("mljevena_junetina", 180), ("kruh", 80), ("sir", 25), ("krumpir", 250), ("ulje", 10)],
    koraci=[
        "Meso posolite, popaprite i oblikujte pljeskavicu debljine oko 2 cm.",
        "Krumpir narežite na štapiće, promiješajte s uljem i solju. Zračna friteza 200 °C, 18 do 20 minuta, protresite na pola vremena.",
        "Pljeskavicu pecite u fritezi 10 do 12 minuta na 180 °C, okrenite na pola, a sir dodajte zadnju minutu.",
        "Zemičku zagrijte 2 minute, složite burger i poslužite s krumpirićima.",
    ],
    napomena="Sadrži gluten (zemička) i laktozu (sir). Pljeskavica mora biti potpuno pečena.",
))


def build():
    out = []
    for r in R:
        tot = dict(kcal=0, p=0, c=0, f=0, fib=0)
        gl = lac = 0
        sast = []
        for key, g in r["sastojci"]:
            n, kcal, p, c, f, fib, g_, l_, piece = INGREDIENTS[key]
            k = g / 100.0
            tot["kcal"] += kcal * k
            tot["p"] += p * k
            tot["c"] += c * k
            tot["f"] += f * k
            tot["fib"] += fib * k
            gl |= g_
            lac |= l_
            item = {"naziv": n, "g": g, "gluten": g_, "laktoza": l_}
            if piece:
                item["kom"] = round(g / piece, 1)
            sast.append(item)
        s = r["porcije"]
        per = {k: round(v / s, 1) for k, v in tot.items()}
        tags = list(r.get("tagovi", []))
        if r["vrijeme"] <= 25 and "brzo" not in tags:
            tags.append("brzo")
        if not gl:
            tags.append("bez glutena")
        if not lac:
            tags.append("bez laktoze")
        if per["fib"] < 6:
            tags.append("niska vlaknina")
        out.append({
            "id": r["id"], "naziv": r["naziv"], "opis": r["opis"], "porcije": s,
            "vrijeme": r["vrijeme"], "aktivno": r["aktivno"], "oprema": r["oprema"],
            "sastojci": sast, "koraci": r["koraci"], "napomena": r["napomena"],
            "kcal": round(per["kcal"]), "protein": round(per["p"]), "ugljikohidrati": round(per["c"]),
            "masti": round(per["f"]), "vlaknine": round(per["fib"], 1),
            "gluten": gl, "laktoza": lac, "tagovi": tags,
        })
    return {
        "info": [
            "Vrijednosti su približne, izračunate iz sirovih težina i prosječnih nutritivnih tablica. Po porciji.",
            "Recepti nisu prilagođeni vašoj toleranciji: oznake za gluten, laktozu i vlaknine služe da lakše testirate što vam odgovara.",
            "Meso uvijek dobro ispecite. Gotova jela čuvajte u hladnjaku najviše 3 dana i grijte dok ne postanu vruća.",
        ],
        "recepti": out,
    }


if __name__ == "__main__":
    data = build()
    Path(__file__).with_name("recipes.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in data["recepti"]:
        print(f'{r["naziv"][:52]:52} {r["kcal"]:5} kcal  P{r["protein"]:3} U{r["ugljikohidrati"]:4} M{r["masti"]:3} V{r["vlaknine"]:5}  '
              f'{"G" if r["gluten"] else "-"}{"L" if r["laktoza"] else "-"}')
