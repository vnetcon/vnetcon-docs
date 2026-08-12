# Pinoprofiili: käyttöliittymä (React / Vue / Angular / Svelte)

Käytä yhdessä [`yleinen.md`](yleinen.md):n ja [`node-ts.md`](node-ts.md):n
kanssa. `<m>` = moduulin polku.

Käyttöliittymämoduuli dokumentoidaan eri painotuksella kuin taustapalvelu:
sisääntulo on **käyttäjän toiminto ja näkymä**, ja "tietokanta" on
**taustapalvelun rajapinta + selaimen tila**.

## Näkymät ja reititys

```bash
# Tiedostopohjainen reititys
git -C .. ls-files '<m>/src/pages/**' '<m>/src/routes/**' '<m>/app/**/page.tsx'
# Konfiguroitu reititys
git -C .. grep -nE 'createBrowserRouter|<Route |RouterModule\.forRoot|createRouter|routes:' -- '<m>'
```

Kirjaa: polku → näkymä → mitä käyttäjä siinä tekee → mitä rajapintoja kutsutaan.

## Taustapalvelukutsut (moduulin todelliset kytkennät)

```bash
git -C .. grep -nE 'fetch\(|axios\.|useQuery\(|useMutation\(|createApi\(|HttpClient' -- '<m>'
git -C .. grep -nE '(BASE_URL|API_URL|VITE_|NEXT_PUBLIC_|REACT_APP_)' -- '<m>'
```

Nämä ovat järjestelmäprosessien lähtöpisteitä: käyttöliittymä → taustapalvelu.
Kirjaa ne `tila/rakenne.yaml`:n `kytkennat`-listaan.

## Tila ja datan muoto

```bash
# Tilanhallinta
git -C .. grep -nE 'createSlice|configureStore|create\(\(set|atom\(|writable\(|BehaviorSubject' -- '<m>'
# Rajapintatyypit ja validointi
git -C .. grep -nE '^export (interface|type) |z\.object\(' -- '<m>'
# Generoidut rajapintatyypit (= sopimus taustapalveluun)
git -C .. ls-files '<m>/**/*api*.ts' '<m>/**/generated/**' '<m>/**/schema.graphql'
```

Datavirta käyttöliittymässä: **rajapintavastaus → normalisoitu tila → näkymän
propsit → lähetettävä payload.** Kuvaa kussakin solmussa hallitseva tyyppi.

## Komponenttien väliset rajapinnat

```bash
# Mikro-frontendit / web-komponentit / moduulifederaatio
git -C .. grep -nE 'customElements\.define|defineCustomElement|ModuleFederation|remotes:' -- '<m>'
# Tapahtumaväylät komponenttien välillä
git -C .. grep -nE 'dispatchEvent\(|new CustomEvent\(|addEventListener\(' -- '<m>'
```

Jos käyttöliittymä isännöi muita sovelluksia (mikro-frontend), tämä on
**järjestelmäprosessi**: kuori → alisovellukset, ja tapahtumaväylä on
integraatiotapa. Dokumentoi se `jarjestelmaprosessit/`-kansioon.

## Käännösaikainen vs. ajonaikainen konfiguraatio

```bash
git -C .. ls-files '<m>/.env*' '<m>/vite.config.*' '<m>/next.config.*' '<m>/angular.json'
```

Erottele: mikä paistetaan buildiin (`VITE_*`, `NEXT_PUBLIC_*`) ja mikä haetaan
ajonaikaisesti (konfiguraatioendpoint, event). Tämä ero on dokumentaatiossa
tärkeä eikä näy koodista ilman että sitä etsii.

## Testit

```bash
git -C .. ls-files '<m>/**/*.test.*' '<m>/**/*.spec.*' '<m>/**/e2e/**' '<m>/**/*.cy.*'
```

Testikomennot: yksikkö (`vitest`/`jest`), E2E (`playwright`/`cypress`) — kirjaa
molemmat, koska tiketin toteutus tarvitsee tietää kumpi ajetaan.

## Huomiot

- **Älä dokumentoi komponenttipuuta tiedostoittain** — se vanhenee heti ja on
  luettavissa koodista. Dokumentoi näkymät, käyttäjän kulut ja rajapintakutsut.
- Design-systeemikirjastot ja generoidut tyylit eivät ole dokumentoinnin kohteita.
- Storybook-projektit ovat yleensä oma moduuli, jota ei tarvitse dokumentoida
  syvästi — merkitse rekisteriin ja perustele poisrajaus.
