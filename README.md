# AutoHuolto AI – Codex-toteutuspaketti

Tämä paketti määrittelee yksityisyyttä painottavan, tilattoman web-sovelluksen, joka:

1. vastaanottaa käyttäjän selaimessa anonymisoimat huoltokirja- ja kuittikuvat,
2. poimii kuvista rakenteisen huoltohistorian OpenAI API:n kuva-analyysillä,
3. antaa käyttäjän tarkistaa ja korjata poimitut rivit,
4. hakee verkosta ajoneuvovarianttiin liittyvät huolto- ja vaihtovälit,
5. laskee huoltojen tilanteen deterministisesti sovelluskoodissa,
6. näyttää lähteet ja epävarmuudet,
7. vie tuloksen JSON- ja Excel-tiedostoksi,
8. ei käytä omaa tietokantaa eikä tallenna käyttäjän kuvia tai raportteja pysyvästi.

## Codexille annettava aloitusohje

Avaa projektin juuressa oleva `AGENTS.md` ja toimi sen mukaan. Lue sen jälkeen:

1. `CODEX_BUILD_SPEC.md`
2. `docs/05_IMPLEMENTATION_PHASES.md`
3. `docs/06_TESTING_AND_ACCEPTANCE.md`
4. `docs/07_PRIVACY_AND_SECURITY.md`

Rakenna yksi vaihe kerrallaan. Älä ohita testejä tai yksityisyysvaatimuksia.

## Suositeltu toteutustapa

- Next.js, TypeScript ja App Router
- yksi deployattava web-sovellus
- server route -rajapinnat OpenAI-kutsuille
- ei tietokantaa
- selaimen muistissa säilyvä istuntotila
- manuaalinen kuvan peittäminen canvasilla ennen lähetystä
- OpenAI Responses API:
  - kuva-analyysi
  - Structured Outputs
  - web search
- Excel-vienti selaimessa

Tekninen spesifikaatio on englanniksi, koska se on Codexille ja lähdekoodin tuottamiseen yksiselitteisempi. Käyttöliittymän oletuskieli on suomi.

## Nykyinen toteutusvaihe

Phase 9 viimeistelee MVP:n kovennetuilla selainotsakkeilla, rajatulla
prosessikohtaisella väärinkäytön estolla, turvallisilla virhetiloilla,
automaattisella yksityisyystarkistuksella, mobiilinäkymillä, saavutettavuuden
selainarvioinnilla ja kattavalla Playwright-työnkululla. Sisäänrakennettu
Nordica Aurora -demo on täysin kuvitteellinen, toimii ilman API-kutsuja ja
sisältää kolme synteettistä asiakirjaviitettä, mailimuunnoksen,
epäselvän tapahtuman, lähderistiriidan sekä puuttuvan huoltomerkinnän.

MVP sisältää aiempien vaiheiden ajoneuvolomakkeen, selaimessa tehtävän
kuvan peittämisen ja tilattoman `/api/extract`-rajapinnan. Käyttäjän
erikseen hyväksymät uudet PNG-kuvat lähetetään pyyntökohtaisena kuvasisältönä
OpenAI Responses API:lle. `store: false`, palvelinpuolinen API-avain,
rakenteinen tulos, skeemavalidointi, yksi rajattu skeemakorjausyritys,
pyyntöaikaraja ja muistissa toimiva nopeusrajoitus suojaavat työnkulkua.

Poimitut tapahtumat, lähdekuvaviitteet, luettavuus ja luottamus näytetään
muokattavassa tarkistustaulukossa. Käyttäjä voi muokata, lisätä, poistaa ja
yhdistää tapahtumia. Tyhjä tai lukukelvoton aineisto esitetään rehellisenä
tyhjänä tuloksena, ja palveluvirhe säilyttää paikalliset kuvat uutta yritystä
varten. Muokattava tapahtuma tunnistetaan koko rivin korostuksesta,
aktiivisesta painikkeesta ja muokkauslomakkeen vierityksessä pysyvästä
otsakkeesta.

Tarkistusnäkymä näyttää alkuperäisen kuvanäytön rinnalla normalisoidun
päivämäärän, kilometreiksi muunnetun mittarilukeman ja kanonisen
komponenttiluokituksen. Mailit muunnetaan laskentaa varten täsmällisellä
kertoimella `1.609344`, mutta alkuperäinen arvo ja yksikkö säilyvät.
Päivämäärän tarkkuus päätellään syötteestä automaattisesti: `PP.KK.VVVV`,
`KK.VVVV` ja `VVVV` vastaavat päivä-, kuukausi- ja vuositarkkuutta.
Sovelluskoodi havaitsee virheelliset päivämäärät ja mittarilukemat,
mahdolliset kaksoiskappaleet sekä aikajärjestyksen ristiriidat. Käyttäjän on
korjattava virheet, kuitattava näkyvät epävarmuudet ja vahvistettava
huoltohistoria erikseen. Jokainen muokkaus poistaa vahvistuksen
automaattisesti.

`/api/extract` ohittaa Next.js-proxyn pyyntörungon puskuroinnin. Rajapinta
validoi itse enintään 10 kuvaa, 20 Mt kuvaa kohden ja noin 201 Mt koko
multipart-pyyntöä oletusasetuksilla. Lähetysesikatselu näyttää peitettyjen
PNG-kuvien tavumäärät, palvelimen vastaanottaman HTTP-pyyntörungon koon sekä
sovelletun kokonaisrajan. Kuvan tai pyynnön sisältöä ei kirjoiteta lokiin.
Kuvien poiminnan oletusaikaraja on 180 sekuntia, ja sen voi asettaa välille
5–240 sekuntia `OPENAI_EXTRACTION_TIMEOUT_MS`-ympäristömuuttujalla.
Poimintareitti ilmoittaa alustalle 300 sekunnin enimmäissuoritusajan, jotta
sovellus ehtii palauttaa hallitun aikakatkaisuvirheen.

Tarkistetun huoltohistorian jälkeen `/api/resolve-vehicle` hakee verkosta
mahdollisia ajoneuvoversioita OpenAI Responses API:n web search -työkalulla.
Ensimmäinen pyyntö säilyttää haussa käytetyt URL-osoitteet, ja erillinen
Structured Outputs -pyyntö normalisoi enintään viisi ehdokasta. Ehdokkaan
lähdeviite hyväksytään vain, jos sen palvelimen luoma lähdetunnus kuuluu
alkuperäiseen verkkohakuun. Molemmissa pyynnöissä käytetään `store: false`
-asetusta, eikä tausta-ajoa käytetä.

Käyttöliittymä näyttää yhteensopivuuden, täsmäävät ja ristiriitaiset tiedot,
puuttuvat erottavat kentät sekä napsautettavat lähteet. Ehdokasta ei valita
automaattisesti luottamuksesta riippumatta: käyttäjän on valittava ja
vahvistettava versio erikseen. “Mikään näistä” -polku jättää vahvistetun
version tyhjäksi. Ehdokkaat, lähteet ja valittu tarkka versio säilyvät vain
React-muistissa nykyisen välilehden ajan.

Ajoneuvohaku käyttää `OPENAI_RESEARCH_MODEL`-mallia ja
`OPENAI_RESEARCH_TIMEOUT_MS`-aikarajaa. Jos ne ovat tyhjiä, asetukset
periytyvät poiminnan vastaavista ympäristömuuttujista ja lopulta turvallisista
oletuksista.

Vahvistetulle ajoneuvoversiolle `/api/research` tekee kaksivaiheisen
huoltovälitutkimuksen. Ensimmäinen OpenAI Responses API -pyyntö käyttää
pakollista web search -työkalua ja tuottaa lähteisiin viittaavan
tutkimusmuistion. Toinen, ilman verkkotyökalua suoritettava Structured Outputs
-pyyntö saa vain muistion ja palvelimen talteen ottaman lähdeluettelon.
Normalisoitu väite hyväksytään vain, jos sen `source_id` kuuluu kyseiseen
verkkohakuun. Molemmissa pyynnöissä käytetään `store: false` -asetusta.

Sovelluskoodi valitsee huoltovälin deterministisesti lähdehierarkiasta:
valmistajan virallinen aineisto on ensisijainen, ja heikompi lähde ei voi
hiljaisesti ohittaa vahvempaa yhteensopivaa näyttöä. Saman parhaan lähdetason
poikkeavat välit näkyvät ristiriitana ilman automaattista valintaa. Jos
luotettavaa ja varianttiin sopivaa näyttöä ei ole, tulos on
`insufficient_evidence`. Mailit muunnetaan kilometreiksi kertoimella
`1.609344`, ja alkuperäinen arvo sekä yksikkö säilytetään lähdenäytössä.

Tutkimusmallille ei lähetetä kuvia, huoltohistorian sisältöä tai
matkamittarilukemaa. Tutkimuksen muistio, lähteet ja tulos ovat pyyntökohtaisia
ja säilyvät käyttöliittymässä vain nykyisen välilehden React-muistissa.

Huoltovälitutkimuksen jälkeen komponenttien tilat lasketaan puhtailla
TypeScript-funktioilla selaimessa. Tekoälyltä saatua tekstiä ei tulkita tilaksi.
Laskenta valitsee viimeisimmän riittävän luotettavan vaihto- tai
huoltomerkinnän, torjuu tulevaisuuden päivämäärät ja mahdottoman
mittarijärjestyksen sekä käyttää lähdekonfliktin ja riittämättömän näytön
tiloja ennen numeerista laskentaa.

Kilometri- ja kuukausirajat käyttävät konfiguroitavia välittömän tarpeen,
varoituksen ja ylitystoleranssin kynnyksiä. Kun tiedot riittävät, tulos sisältää
käytetyn ja jäljellä olevan matkan/ajan sekä arvioidun erääntymislukeman ja
-päivän. Jos huoltomerkintää ei löydy, käyttöliittymä kertoo
“Huoltohistoriasta ei löytynyt merkintää” eikä väitä, ettei huoltoa ole tehty.

Valmis raporttinäkymä kokoaa vahvistetun ajoneuvoversion, tarkistetun
huoltohistorian, deterministisesti lasketut komponenttitilat sekä kaikki
ajoneuvo- ja huoltovälilähteet epävarmuuksineen. Raportti voidaan ladata
paikallisesti JSON- tai Excel-tiedostona ilman uutta verkkopyyntöä.

Excel-vienti sisältää erilliset yhteenveto-, huoltohistoria-, komponentti- ja
lähdetaulukot. Ulkoinen tekstisisältö suojataan kaavainjektiolta ennen
soluihin kirjoittamista. Kuvat ja niiden sisältö eivät kuulu kumpaankaan
vientimuotoon; vain huoltotapahtuman lähdekuvien istuntotunnisteet säilytetään
tekstimuotoisina jäljitettävyyttä varten.

## Paikallinen kehitys

Vaatimukset:

- Node.js 20.9 tai uudempi
- npm

Asenna riippuvuudet ja käynnistä kehityspalvelin:

```bash
npm ci
npm run dev
```

Kopioi tarvittaessa `.env.example` tiedostoksi `.env.local`. Älä tallenna
API-avainta lähdekoodiin tai selaimelle näkyvään `NEXT_PUBLIC_`-muuttujaan.

## Laatuportit

```bash
npm run lint
npm run privacy:audit
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwright tarvitsee paikallisen Chromium-asennuksen:

```bash
npx playwright install chromium
```

Tuotantoympäristön vaatimukset, välityspalvelimen tietosuojarajaukset,
ympäristömuuttujat, synteettinen smoke-testi ja tunnetut käyttörajat on kuvattu
tiedostossa [`docs/09_DEPLOYMENT.md`](docs/09_DEPLOYMENT.md).
