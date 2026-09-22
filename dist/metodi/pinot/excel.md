# Pinoprofiili: Excel-työkirja (liiketoimintalaskenta)

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<t>` = työkirjan polku.

Tätä profiilia käytetään, kun dokumentoitava järjestelmä on **Excel-työkirja
eikä lähdekoodia**. Työkalu `tyokalut/xlsx-kartta.mjs` tulee paketin mukana.

## Miksi tämä on oma pino

Liiketoiminnan työkirja on ohjelma: data on välilehdillä, logiikka kaavoissa,
kontrollivuo `IF`-lauseissa, hakurakenteet `VLOOKUP`-taulukoissa ja
konfiguraatio parametrivälilehdellä. Siitä puuttuu kaikki se, mikä tekee
koodista hallittavaa: versiohistoria, testit, katselmointi ja toinen ihminen
joka ymmärtää sen.

Tekninen ero muihin pinoihin: **`.xlsx` on binääri, joten `git grep` ei näe sen
sisään.** Kartoitus tehdään työkalulla, joka purkaa työkirjan tekstiksi.

## Kartoitustyökalu

Komennot ajetaan **`vnetcon-docs/`-hakemistosta**, kuten paketin muutkin
menettelyt ([`konventiot.md`](../konventiot.md) kohta 2). `<t>` on työkirjan
polku **projektin juuresta**, joten komennossa sen eteen tulee `../`:

bash (macOS, Linux, WSL, Git Bash):

```bash
node tyokalut/xlsx-kartta.mjs ../<t>              # kaikki osat
node tyokalut/xlsx-kartta.mjs ../<t> --osa rakenne
node tyokalut/xlsx-kartta.mjs ../<t> --osa kaavat
node tyokalut/xlsx-kartta.mjs ../<t> --osa funktiot
node tyokalut/xlsx-kartta.mjs ../<t> --osa arvot
node tyokalut/xlsx-kartta.mjs ../<t> --osa linkit
node tyokalut/xlsx-kartta.mjs ../<t> --osa riskit

# monta työkirjaa kerralla — sama osa jokaiselle + riippuvuusgraafi
node tyokalut/xlsx-kartta.mjs ../<t1> ../<t2> ../<t3> --osa riskit
```

PowerShell (Windows ilman bashia):

```powershell
node tyokalut/xlsx-kartta.mjs ../<t>              # kaikki osat
node tyokalut/xlsx-kartta.mjs ../<t> --osa rakenne
node tyokalut/xlsx-kartta.mjs ../<t> --osa kaavat
node tyokalut/xlsx-kartta.mjs ../<t> --osa funktiot
node tyokalut/xlsx-kartta.mjs ../<t> --osa arvot
node tyokalut/xlsx-kartta.mjs ../<t> --osa linkit
node tyokalut/xlsx-kartta.mjs ../<t> --osa riskit

# monta työkirjaa kerralla — sama osa jokaiselle + riippuvuusgraafi
node tyokalut/xlsx-kartta.mjs ../<t1> ../<t2> ../<t3> --osa riskit
```

Dokumenteissa polku kirjoitetaan silti **ilman** `../`-etuliitettä. Jos projekti
pitää työkalua muualla, kirjaa todellinen komento
[`kartoitus.md`](../kartoitus.md):hen.

Työkalu on Nodea eikä käytä riippuvuuksia (`.xlsx` on zip-paketti XML:ää, ja
`zlib` tulee Noden mukana), joten kumpikin lohko toimii sellaisenaan.
Windowsilla riittää PowerShell — ei bashia, ei Pythonia, ei asennuksia.

Tuloste on tekstiä, joten se on haettavissa ja liitettävissä dokumentteihin
sellaisenaan. **Aja `--osa riskit` ensimmäisenä** — se kertoo minuutissa, missä
kohdissa työkirja voi valehdella hiljaa.

Työkalun voi myös importoida, kun toteutus tarvitsee työkirjan sisällön:

```js
import { lueTyokirja, valilehti, rivit } from './tyokalut/xlsx-kartta.mjs';
const wb = lueTyokirja('../<t>');
const data = rivit(valilehti(wb, '<välilehden nimi>'));   // rivit olioina otsikoiden mukaan
```

## Manifesti ja moduulirakenne

Työkirja vastaa moduulia, välilehti sen osaa. Aja `--osa rakenne` ja kirjaa:

- montako välilehteä, mitkä ovat **syötteitä**, mitkä **laskentaa**, mitkä
  **parametreja** ja mikä on **tuloste**
- otsikkorivin numero jokaiselle datavälilehdelle — jos se ei ole 1, jokainen
  automaattinen luku tarvitsee rivisiirtymän
- piilotetut välilehdet: ne ovat yhtä aktiivisia kuin näkyvät

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files '*.xlsx' '*.xlsm'               # mitä työkirjoja projektissa on
git -C .. log --oneline -- <t> | head -20          # kuka on muuttanut ja milloin
git -C .. ls-files '*.xlsb'                        # ks. varoitus alla
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files '*.xlsx' '*.xlsm'                            # mitä työkirjoja projektissa on
git -C .. log --oneline -- <t> | Select-Object -First 20        # kuka on muuttanut ja milloin
git -C .. ls-files '*.xlsb'                                     # ks. varoitus alla
```

> ⚠️ **`.xlsb` ei aukea tällä työkalulla.** `.xlsx` ja `.xlsm` ovat zip-paketteja
> XML:ää, mutta `.xlsb` on binäärimuoto (BIFF12), jota työkalu ei jäsennä. Jos
> projektissa on `.xlsb`-työkirjoja, se on **katve** — kirjaa se
> `kartoitus.md`:hen äläkä oleta niiden sisältöä. Kierto: tallenna kopio
> `.xlsx`-muotoon Excelissä, mutta muista että kopio ei ole versioitu totuus.

Jos `git log` on tyhjä tai siinä on vain "päivitys"-viestejä, muutoshistoriaa ei
käytännössä ole — kirjaa se katveeksi, älä oleta.

## Monta työkirjaa

Kun projektissa on useampi työkirja, ratkaise **ensin jako, sitten kartoitus.**
Väärä jako maksaa enemmän kuin väärä haku, koska se ohjaa koko dokumentaation
rakenteen.

| Tilanne | Jako | Miksi |
|---------|------|-------|
| Työkirjat ovat saman asian **ilmentymiä**: kuukausiversiot, aluekohtaiset kopiot, pohja + täytetyt | **Yksi moduuli**, `tila/rekisteri.yaml` → `tiedostot`-lista | Logiikka on sama; erot ovat dataa, eivät prosesseja. Kaksi kertaa kirjoitettu `prosessit/` on merkki väärästä jaosta |
| Työkirjoilla on **eri omistaja, eri muutostahti tai eri tarkoitus** — varsinkin jos toinen syöttää toista | **Moduuli per työkirja** + `jarjestelmaprosessit/`-kuvaus ketjusta | Ne muuttuvat eri aikaan ja eri syistä, joten ne myös vanhenevat eri aikaan |

Nyrkkisääntö: **jos joutuisit kirjoittamaan saman prosessikuvauksen kahdesti,
se on yksi moduuli.**

Erillisten moduulien tapauksessa kirjaa hypyt `tila/rakenne.yaml`:n
`kytkennat`-listaan — HTML-etusivun järjestelmäkartta piirtää niistä nuolet.

### Ulkoiset linkit ovat rajapinta ilman sopimusta

`--osa linkit` kertoo mihin työkirja linkittää, mistä soluista, ja onko kohde
saatavilla. Aja se aina kun työkirjoja on enemmän kuin yksi.

bash (macOS, Linux, WSL, Git Bash):

```bash
node tyokalut/xlsx-kartta.mjs ../<t1> ../<t2> --osa linkit
```

PowerShell (Windows ilman bashia):

```powershell
node tyokalut/xlsx-kartta.mjs ../<t1> ../<t2> --osa linkit
```

Monella tiedostolla tuloste päättyy Mermaid-riippuvuusgraafiin, jonka voi
liittää järjestelmäprosessidokumenttiin sellaisenaan.

Kolme asiaa on kirjattava jokaisesta linkistä, eikä yksikään niistä selviä
tiedostosta:

1. **kuka päivittää kohteen ja milloin** — linkki näyttää tuoreelta vaikka
   kohdetta ei olisi avattu vuoteen; Excel näyttää välimuistiin jäänyttä arvoa
2. **mitä tapahtuu kun tiedosto siirtyy tai nimetään uudelleen** — ehdoton polku
   (`C:\…`, verkkolevy) katkeaa toisella koneella, **eikä katkeaminen näy
   laskennassa**
3. **onko kohde versionhallinnassa** — jos ei, ketjun toinen pää on skoopin
   ulkopuolella ja se on kirjattava katveeksi `kartoitus.md`:hen

Jos `--osa linkit` kertoo, ettei yksikään kaava viittaa johonkin linkkiin, se on
jäänne: kirjaa se poistettavaksi, älä dokumentoi sitä riippuvuudeksi.

## Sisääntulopisteet

Mistä data tulee sisään ja missä muodossa:

- **liitettävä alue**: välilehti, jolle käyttäjä kopioi rivit toisesta
  järjestelmästä (tunnistat ohjetekstistä ja yhdistetystä otsikkorivistä)
- **erilliset syötetiedostot**: `git -C .. ls-files '*.xlsx' '*.xlsm'` ja poista
  listalta itse laskentatyökirja. Syötekansion nimi on projektikohtainen —
  kirjaa löytämäsi hakemisto ja hakukomento `kartoitus.md`:hen
- **ulkoiset linkit toisiin työkirjoihin** — `--osa riskit` löytää nämä
- manuaaliset korjaussolut: arvo, jonka joku kirjoittaa käsin joka kuukausi

Kirjaa jokaisesta syötteestä: kuka tuottaa, millä komennolla tai napilla,
kuinka usein, ja mitä tapahtuu jos sarakkeet muuttuvat.

## Logiikka: kaavat sääntöinä

`--osa kaavat` normalisoi rivinumerot pois, jolloin 500 samanlaista riviä
tiivistyy yhdeksi säännöksi. Juuri nuo säännöt ovat dokumentoitava logiikka.

Kirjoita jokaisesta säännöstä kolme asiaa:

1. **mitä se tekee** liiketoiminnan kielellä (ei "VLOOKUP sarakkeeseen B")
2. **mihin se nojaa**: mikä taulukko, mikä parametri, mikä välilehti
3. **milloin se ei päde**: mikä ehto ohittaa sen

Poikkeukset ovat tärkeämpiä kuin pääsääntö. Ne ovat se osa, jota kukaan ei
muista, ja ne ovat aina kaavan sisällä — eivät taulukossa.

## Funktiot: mitä työkalu ei näe

`--osa funktiot` listaa kaikki työkirjan käyttämät Excel-funktiot ja **kertoo
milloin muu analyysi on epäluotettavaa.** Aja se heti `--osa riskit`in jälkeen.

Kaksi varoitusluokkaa, ja molemmat ovat tärkeämpiä kuin itse lista:

- **`INDIRECT`, `OFFSET`** rakentavat viittauksen merkkijonosta ajon aikana.
  Silloin `--osa riskit`:n hakualuetarkistus **ei näe niiden läpi** — se ei voi
  kertoa kattaako haku taulukon, koska aluetta ei ole olemassa ennen laskentaa.
  Jos näitä on, riskianalyysi on vajaa: tarkista ne käsin ja **kirjaa katve**
  `kartoitus.md`:hen. Älä raportoi riskilistaa täydellisenä.
- **`NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `CELL`, `INFO`** ovat haihtuvia: tulos
  muuttuu joka avauksella. Sama työkirja antaa eri luvun eri päivinä, jolloin
  *"Testikomento ja lähtötaso"* -osion historiavertailu ei ole toistettava
  sellaisenaan. Sovi miten aika kiinnitetään ennen kuin lupaat sentilleen
  täsmäävää vertailua.

Jos kumpaakaan luokkaa ei esiinny, työkalu sanoo sen ääneen — silloin
hakualuetarkistus kattaa kaikki kaavat ja riskilistaan voi luottaa.

## Parametrit ja taulukot

`--osa arvot` tulostaa pienet välilehdet kokonaan. Nämä ovat konfiguraatiota:
prosentit, portaat, kertoimet, rajat, voimassaolopäivät.

Tarkista jokaisesta: **milloin sitä on viimeksi muutettu ja kuka päättää siitä.**
Parametri, jonka omistajaa ei tiedetä, on riski riippumatta sen arvosta.

## Riskikohdat

`--osa riskit` tunnistaa nämä koneellisesti:

| Löydös | Miksi vaarallinen |
|--------|-------------------|
| `IFERROR`-kääre | Osumaton haku palauttaa hiljaa 0:n — ei virhettä, ei jälkeä |
| Hakualue lyhyempi kuin taulukko | Taulukkoon lisätty rivi jää haun ulkopuolelle |
| Kovakoodattu ehto kaavassa | Nimeltä kirjoitettu poikkeus (`="Virtanen Katja"`), jota ei näy missään taulukossa |
| Kovakoodattu luku kaavassa | Prosentti, kerroin tai raja kaavan sisällä (`*0.03`, `>0.2`). Funktioargumentit (`VLOOKUP`in sarakeindeksi, `ROUND`in tarkkuus) eivät osu tähän |
| Piilotettu välilehti | Yhtä aktiivinen kuin näkyvä, mutta jää katselmoinnin ulkopuolelle |
| Yhdistetty otsikkorivi | Data ei ala riviltä 2 |
| Päivämäärä tekstinä | Suodatus ja lajittelu menevät pieleen, rivejä katoaa |
| "vanha"/"old"/"copy" välilehden nimessä | Hylätty, mutta usein yhä viitattu |
| Ulkoinen linkki | Laskenta riippuu tiedostosta, jota ei ole repossa. Kohteet nimetään; yksityiskohdat `--osa linkit` |
| VBA-makro | Osa logiikasta on koodina työkirjan sisällä |

**Löydös ei ole syyte.** Työkirja on kasvanut vuosien varrella ilman
katselmointia; sen tekijä on ratkaissut oikean ongelman käytettävissä olevilla
välineillä. Kirjaa havainto, sen rahallinen vaikutus jos se on laskettavissa, ja
ehdotus — älä arvostele.

## Testikomento ja lähtötaso

Työkirjan korvaava tai täydentävä toteutus testataan **historiaa vasten**:
vanhan työkirjan tuottamat luvut ovat samaan aikaan määrittely ja testiorakkeli.

```
Aja kaikki saatavilla olevat kuukaudet sekä vanhan työkirjan tuloksia vasten
että uudella toteutuksella. Jokaisen luvun on täsmättävä sentilleen.
Ero on joko vika uudessa toteutuksessa tai vika vanhassa — ja kummankin
tapauksen ratkaisee liiketoiminta, ei toteuttaja.
```

Tämä on ainoa hyväksymiskriteeri, joka antaa organisaatiolle rohkeuden korvata
työkirja. Kirjaa `tila/projekti.yaml` → `komennot.testi` se komento, joka ajaa
vertailun.

## Huomiot

- **Replikoi ensin, korjaa sitten.** Ensimmäinen toteutus jäljittelee vanhaa
  työkirjaa vikoineen, jotta vertailu täsmää 100-prosenttisesti. Vasta sen
  jälkeen viat korjataan tiketteinä, tietoisesti ja hyväksytysti. Jos korjaat
  samalla kun replikoit, et tiedä kumpi ero johtui mistäkin.
- **Pyöristys ratkaistaan aikaisin.** Excel pyöristää eri kohdissa kuin
  suoraviivainen toteutus. Sovi pyöristyssääntö ennen toteutusta, älä sen jälkeen.
- **Tuloste on tuote.** Tiketin lopputulos on se tiedosto, jonka liiketoiminta
  saa — ei koodi, jolla se tehdään. Hyväksymiskriteerit kirjoitetaan tiedostosta:
  välilehdet, sarakkeet, muotoilut, tiedostonimi.
- **Logiikka koodiin, Excel tulosteeksi.** Jos uusi toteutus tuottaa taas
  työkirjan, jossa on kaavoja, ongelma on siirretty eikä ratkaistu.
