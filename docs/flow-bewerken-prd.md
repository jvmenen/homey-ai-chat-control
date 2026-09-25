# PRD: flows aanmaken en bewerken via de AI

**Status:** concept, 25 september 2026
**App:** AI Chat Control (nl.joonix.aichatcontrol), vanaf versie 4.0.4

## 1. Aanleiding

Via de lokale Homey API kan een AI flows aanmaken en aanpassen, zoals de Achterkamer-flow en de tafellamp-flows. Dat werkt goed en is een van de nuttigste dingen die een AI met Homey kan: je beschrijft wat je wilt en de AI bouwt de flow. Deze app kan dat nog niet.

De vraag is niet of de AI flows mag wijzigen, maar hoe dat kan zonder dat je ooit een werkende flow kwijtraakt.

## 2. Doel

- De AI kan nieuwe flows maken, zowel standaardflows (als/en/dan) als advanced flows.
- De AI kan bestaande flows aanpassen, van elk type.
- Een bestaande flow wordt nooit overschreven of verwijderd. Elke wijziging levert een nieuwe versie op en de vorige versie gaat uit. Zo is er altijd een backup.

## 3. Uitgangspunten

### 3.1 Nooit overschrijven: elke wijziging is een nieuwe versie

1. De AI kopieert de bron-flow, voert de wijziging uit in de kopie en zet die neer als nieuwe flow.
2. De vorige versie wordt uitgezet, niet verwijderd.
3. Dat geldt voor elke wijziging, ook tijdens het itereren. Zegt de gebruiker drie keer "nog iets feller", dan ontstaan v2, v3 en v4. Alleen de laatste staat aan.
4. De app wijzigt aan een bestaande flow alleen de aan/uit-status. Naam, kaarten en map blijven ongemoeid.
5. Terug naar een eerdere versie is een wissel: die versie gaat weer aan, de huidige uit.
6. Opruimen van oude versies doet de gebruiker zelf in de Homey-app. De AI verwijdert geen flows.

Waarom elke wijziging een nieuwe versie: bij "je mag je eigen versie blijven bewerken" is nooit duidelijk tot wanneer dat mag. Stel dat de gebruiker na drie stappen terug wil naar stap twee. Met een versie per wijziging kan dat altijd, en de regel blijft eenvoudig uit te leggen.

### 3.2 Naamgeving en herkenbaarheid

- Een nieuwe versie krijgt de naam van de bron met een versienummer: `Achterkamer (v2)`, `Achterkamer (v3)`. Het origineel (zonder nummer) geldt als v1.
- De nieuwe versie komt in dezelfde map als de bron.
- De app houdt per flow bij welke versie het is en van welke flow hij afstamt (versielijn). Dat staat in de app-instellingen (`homey.settings`), gekoppeld aan het flow-ID. Homey zelf heeft geen veld voor zulke gegevens.
- Hernoemt de gebruiker een versie, dan blijft de versielijn gewoon werken, omdat die aan het ID hangt en niet aan de naam.

### 3.3 Aan/uit bij het wisselen

- De nieuwe versie neemt de aan/uit-status van de bron over. Stond de bron aan, dan gaat de nieuwe versie aan en de bron uit. Stond de bron uit, dan blijven beide uit.
- Volgorde van wisselen:
  1. nieuwe versie uitgeschakeld aanmaken;
  2. teruglezen en controleren;
  3. bron uitzetten;
  4. nieuwe versie aanzetten.
- Mislukt stap 4, dan zet de app de bron weer aan en meldt dat. Er draaien dus nooit twee versies tegelijk. Dat voorkomt dubbele acties, bijvoorbeeld een lamp die twee keer schakelt.
- Een compleet nieuwe flow (zonder bron) wordt standaard uitgeschakeld aangemaakt. De AI vraagt of hij aan mag.

### 3.4 Verwijzingen naar de oude versie

Een nieuwe versie heeft een nieuw ID. Alles wat de oude flow bij ID aanroept, wijst daarna naar een uitgeschakelde flow:

- andere flows met een kaart "Start een flow";
- favorieten en dashboards in de Homey-app;
- andere apps of scripts die de flow via de API starten.

De app zoekt bij elke wijziging in alle flows en advanced flows naar het ID van de bron en meldt de treffers ("Let op: flow X start deze flow nog via de oude versie"). De app past die flows niet automatisch aan. Aanpassen kan wel op verzoek, en dat levert dan ook voor die flows een nieuwe versie op. Favorieten en dashboards kan de app niet zien. De AI noemt die mogelijkheid daarom kort bij flows die handmatig gestart worden.

Flows met de trigger van deze app ("AI-tool aangeroepen") zijn geen probleem. De app biedt alleen ingeschakelde flows als tool aan, dus na de wissel is de nieuwe versie de tool.

## 4. Toegang: eigen API-sleutel

Uit een proef (25 september 2026) blijkt dat het token dat Homey aan apps geeft voor flows alleen `homey.flow.readonly` heeft. Aanmaken, wijzigen en verwijderen geven `403 Missing Scopes`. Dat kan een app niet uitbreiden.

Oplossing:

- De instellingenpagina van de app krijgt een optioneel veld voor een persoonlijke API-sleutel. Die maakt de gebruiker aan op my.homey.app.
- De app gebruikt die sleutel alleen voor het schrijven van flows. Al het andere blijft via het token van de app lopen.
- Zonder sleutel zijn de schrijftools niet beschikbaar. De leestools werken altijd.
- De sleutel komt nooit in logs, tool-uitvoer of foutmeldingen. De instellingenpagina toont hem na het opslaan alleen gemaskeerd.
- De uitleg bij het veld noemt welke rechten de sleutel minimaal nodig heeft (uit te zoeken in fase 0) en dat de sleutel onversleuteld op Homey staat.

## 5. Tools

| Tool | Doel | Sleutel nodig |
|---|---|---|
| `get_flow_definition` | Volledige definitie van één standaard- of advanced flow, leesbaar voor de AI | nee |
| `find_flow_cards` | Trigger-, voorwaarde- en actiekaarten zoeken op app, apparaat of tekst, met hun argumenten | nee |
| `get_flow_card_options` | Keuzelijsten voor argumenten (autocomplete), bijvoorbeeld een mood of zone | nee (te controleren) |
| `create_flow` | Nieuwe flow maken, standaard of advanced; standaard uitgeschakeld | ja |
| `edit_flow` | Nieuwe versie maken op basis van een bestaande flow, en wisselen (3.3) | ja |
| `list_flow_versions` | Versielijn van een flow: welke versies er zijn, welke aan staat, wanneer gemaakt | nee |
| `restore_flow_version` | Eerdere versie weer aanzetten en de huidige uitzetten | ja |

Bij `edit_flow` stuurt de AI de complete nieuwe definitie mee, niet alleen een wijziging. De AI haalt eerst de definitie op met `get_flow_definition`, past die aan en stuurt hem terug. Dat is eenvoudiger en betrouwbaarder dan een patch-formaat, zeker bij advanced flows.

Alle schrijftools geven in hun antwoord terug wat er gebeurd is: welke flow aangemaakt is, welke uitgezet, en welke verwijzingen (3.4) gevonden zijn.

## 6. Controle vóór het opslaan

Homey controleert een flow zelf bij het aanmaken. De app controleert vooraf wat de AI anders pas na een foutmelding merkt:

- bestaan alle kaarten (trigger, voorwaarden, acties) nog;
- zijn verplichte argumenten ingevuld;
- advanced flows: verwijzen verbindingen en tokens (droptokens) naar kaarten die in de flow bestaan.

Foutmeldingen noemen de kaart en het argument, zodat de AI het zelf kan herstellen.

## 7. Buiten scope

- Flows verwijderen door de AI.
- Een bestaande flow ter plekke aanpassen, ook een eigen versie.
- Flows naar een andere map verplaatsen, mappen aanmaken of hernoemen.
- Opruimen van oude versies (doet de gebruiker in de Homey-app).
- Verwijzingen in andere flows automatisch bijwerken (alleen melden, zie 3.4).

## 8. Fasering

| Fase | Inhoud | Klaar als |
|---|---|---|
| 0. Proef | Minimale rechten voor de API-sleutel bepalen; payload-formaat voor aanmaken van standaard- en advanced flows vastleggen; nagaan of autocomplete met het app-token werkt | Rechtenlijst en voorbeeld-payloads staan in dit document |
| 1. Lezen | `get_flow_definition`, `find_flow_cards`, `get_flow_card_options` | De AI kan elke bestaande flow volledig beschrijven en de juiste kaarten vinden |
| 2. Aanmaken | Instellingenveld voor de sleutel, `create_flow` voor beide types, controle vooraf (6) | Nieuwe flows van beide types werken live, uitgeschakeld aangemaakt |
| 3. Bewerken | `edit_flow` met versies, wisselen en zoeken naar verwijzingen | Een wijziging levert een nieuwe versie; de bron staat uit en is ongewijzigd |
| 4. Versies | `list_flow_versions`, `restore_flow_version` | Terug naar elke eerdere versie met één opdracht |

## 9. Acceptatiecriteria

- Na elke wijziging bestaat de vorige versie nog, met dezelfde inhoud, alleen uitgeschakeld.
- Er staan nooit twee versies uit dezelfde versielijn tegelijk aan.
- Mislukt het wisselen, dan staat de oorspronkelijke flow weer aan en meldt de tool dat.
- Zonder API-sleutel zijn de schrijftools niet zichtbaar en werken de leestools gewoon.
- De API-sleutel komt in geen enkele uitvoer of log voor (test daarop).
- Verwijzingen naar de bron-flow in andere flows worden gemeld.
- Unit-tests voor naamgeving, versielijn, wisselvolgorde en terugdraaien bij fouten. Live test op Homey in een testmap met een standaard- en een advanced flow.

## 10. App Store

De app gebruikt al `homey:manager:api` en krijgt daardoor een zwaardere review. Schrijven in flows met een sleutel van de gebruiker valt daar extra op. De beschrijving legt uit:

- dat flows alleen worden bijgemaakt en nooit overschreven of verwijderd;
- dat de sleutel optioneel is.

## 11. Open vragen

1. Welke rechten heeft de API-sleutel minimaal nodig? Alleen `homey.flow`, of ook rechten op apparaten om hun kaarten te mogen gebruiken? (fase 0)
2. Moeten uitgeschakelde oude versies op den duur naar een aparte map, bijvoorbeeld "Flow-versies", zodat de mappen overzichtelijk blijven? Dat zou betekenen dat de app de map van een bestaande flow wijzigt, wat nu buiten scope is.
3. Mag de AI op uitdrukkelijk verzoek van de gebruiker wel eigen oude versies verwijderen, en nooit het origineel? Nu buiten scope.
4. Moet de AI vóór elke wijziging bevestiging vragen, of alleen bij flows die aan staan?
