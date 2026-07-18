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
