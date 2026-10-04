# Autentikointi ja käyttöoikeudet

> 🇬🇧 [English](authentication.md) · [Takaisin pääohjeeseen](../README.md) ·
> [HTTP-palvelin](http-palvelin.md)

HTTP-palvelin tukee neljää tilaa: `none`, `bearer`, `basic` ja `oidc`. Stdio-yhteys on
paikallinen aliprosessi eikä käytä näitä HTTP-tunnuksia.

## Tila `none`

Paikallinen kokeilu:

```bash
./multiproject-mcp auth set-mode none
```

Loopback-osoitteessa tämä on käyttökelpoinen kehitystila. Ei-loopback-osoitteessa
palvelin kieltäytyy käynnistymästä, ellei avoin verkkokäyttö ole erikseen
hyväksytty:

```bash
./multiproject-mcp auth set-mode none --allow-unauthenticated-network
```

Avoimessa tilassa ei ole käyttäjäkohtaista auditointia tai aineistorajausta.

## Bearer-token

Bearer on suositeltu ensimmäinen tunnistustapa automatisoidulle clientille:

```bash
./multiproject-mcp auth set-mode bearer
./multiproject-mcp auth token create --name cursor-matti
```

Token näytetään vain luontihetkellä. Client lähettää sen muodossa:

```http
Authorization: Bearer mcp_...
```

Rajaa tunnus tarvittaessa:

```bash
./multiproject-mcp auth token create \
  --name talous-tiimi \
  --channels production \
  --projects laskutus,reskontra
```

Hallinta:

```bash
./multiproject-mcp auth token list
./multiproject-mcp auth token revoke talous-tiimi
```

## Käyttäjätunnus ja salasana

Basic sopii clienteille, jotka osaavat lähettää HTTP Basic -tunnuksen:

```bash
./multiproject-mcp auth set-mode basic
./multiproject-mcp auth user add \
  --username matti \
  --channels production \
  --projects laskutus,reskontra
```

Komento pyytää salasanan piilotettuna. Skriptissä salasana voidaan syöttää
stdinistä ilman komentoriviargumenttia:

```bash
printf '%s\n' "$MCP_SETUP_PASSWORD" | \
  ./multiproject-mcp auth user add --username matti --password-stdin
```

Salasanan vähimmäispituus on 12 merkkiä. Basic koodaa käyttäjätunnuksen ja
salasanan, mutta ei salaa niitä: käytä sitä verkossa vain HTTPS:n tai suojatun
tunnelin sisällä.

Hallinta:

```bash
./multiproject-mcp auth user list
./multiproject-mcp auth user remove matti
```

## Kanava- ja projektirajaukset

`--channels` rajaa HTTP-päätepisteet, joihin tunnus saa yhdistää.
`--projects` rajaa projektit, jotka MCP-työkalut näyttävät ja hyväksyvät.
Tuntemattomia tunnisteita ei hyväksytä tunnusta luotaessa.

Kun rajauksia ei anneta, tunnuksella on pääsy kaikkiin konfiguraation kanaviin
ja projekteihin. Rajapintatietue näkyy vain, jos kaikki sen osapuolet kuuluvat
tunnuksen sallittuihin projekteihin.

## OAuth 2.0 / OpenID Connect

OIDC-tila validoi organisaation identiteetintarjoajan access tokenit. Se toimii
esimerkiksi Microsoft Entra ID:n, Entrust IDaaS:n, Keycloakin, Oktan ja Auth0:n
kanssa, kun palvelu tarjoaa OIDC discovery- ja JWKS-päätepisteet.

```bash
./multiproject-mcp auth configure-oidc \
  --issuer https://id.example.com/tenant \
  --audience vnetcon-docs-mcp \
  --resource https://docs-mcp.intra.example/mcp \
  --scopes docs.read
```

Tarvittaessa discovery- tai JWKS-osoite voidaan antaa `--discovery-url`- tai
`--jwks-uri`-valitsimella. Palvelin tarkistaa allekirjoituksen, `issuer`- ja
`audience`-arvot, tokenin voimassaolon, hyväksytyn algoritmin sekä vaaditut
scopet. Avainten kierto käsitellään JWKS:n kautta automaattisesti.
Varsinainen kirjautuminen ja tokenin myöntäminen tapahtuvat IdP:ssä;
`multiproject-mcp` toimii OAuth protected resource -palvelimena eikä säilytä
OIDC-client secret -arvoa.

MCP-clientien discoverya varten julkaistaan sekä juuritason että `/mcp`-polun
protected-resource-metadata. Claim-pohjaisen säännön voi lisätä komennolla:

```bash
./multiproject-mcp auth oidc-rule add \
  --name talous-tiimi \
  --claim groups \
  --values <Entra group object ID> \
  --channels production \
  --projects laskutus,reskontra
./multiproject-mcp auth oidc-rule list
```

Sama konfiguraatio näkyy profiilin YAML-tiedostossa:

```yaml
runtime:
  http:
    authentication:
      mode: oidc
      oidc:
        issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
        audience: <API application client ID>
        resource: https://docs-mcp.intra.example/mcp
        required_scopes: [docs.read]
        principal_claim: oid
        access_rules:
          - name: talous-tiimi
            claim: groups
            values: [<Entra group object ID>]
            channels: [production]
            projects: [laskutus, reskontra]
```

Jos `access_rules` puuttuu, hyväksytyllä tokenilla on pääsy kaikkeen
konfiguroituun aineistoon. Jos säännöt on määritetty mutta yksikään ei täsmää,
pääsy estetään. Käytä ryhmien tai roolien muuttumattomia tunnisteita.
Säännön voi poistaa komennolla `auth oidc-rule remove talous-tiimi`.

## Tunnusten tallennus

Tunnisteet tallennetaan hallintatyötilaan:

```text
.multiproject/secrets/auth.json
```

- tiedosto luodaan mahdollisuuksien mukaan oikeuksilla `0600`
- bearer-tokenista tallennetaan vain SHA-256-tiiviste
- salasanasta tallennetaan satunnaisesti suolattu scrypt-tiiviste
- raakaa tokenia tai salasanaa ei voi lukea takaisin
- `.multiproject/` kuuluu generoidun työtilan `.gitignore`-tiedostoon.

Tokenin kadotessa luo uusi ja poista vanha. Salasanan vaihto tehdään poistamalla
käyttäjä ja lisäämällä se uudelleen.

## Tarkistus

```bash
./multiproject-mcp auth status
./multiproject-mcp doctor --http
```

`auth status` näyttää tilan, tunnusten nimet ja rajaukset, mutta ei salaisuuksia.
`doctor` ilmoittaa virheen, jos bearer-tilassa ei ole yhtään tokenia tai
basic-tilassa yhtään käyttäjää.

Sisäiset bearer- ja basic-tunnukset sopivat pieniin hallittuihin ympäristöihin.
OIDC on suositeltu organisaatiokäyttöön, kun tarvitaan keskitetty käyttäjän
elinkaari, ryhmät, sovellusroolit tai kertakirjautuminen.

Valmistaja- ja protokollaohjeet:

- [MCP authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization)
- [Microsoft Entra: access token validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [Microsoft Entra: claims validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation)
- [Entrust IDaaS: OIDC discovery](https://api.managed.entrust.com/pki/1.5/Use-discovery-endpoint.html)
