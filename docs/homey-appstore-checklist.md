# Homey App Store Publicatie Checklist

Deze checklist bevat alle vereisten om de HomeyMCPServer app succesvol te publiceren in de Homey App Store en goedkeuring te krijgen van Athom.

## Status Legend
- ✅ **Compleet** - Voldoet aan de eisen
- ⚠️ **Moet verbeterd** - Bestaat maar voldoet niet volledig aan de eisen
- ❌ **Ontbreekt** - Nog niet aanwezig
- 📋 **Te controleren** - Handmatig te verifiëren

---

## 1. App Manifest (app.json / .homeycompose/app.json)

### 1.1 Verplichte Basisvelden
- ✅ **id**: `nl.vmcc.homeymcpserver`
- ✅ **version**: `1.0.0`
- ✅ **compatibility**: `>=12.4.0`
- ✅ **sdk**: `3`
- ✅ **name.en**: `HomeyMCPServer`
- ⚠️ **description.en**: Aanwezig maar moet verbeterd (zie sectie 3.2)
- ✅ **category**: `tools`
- ✅ **author.name**: `Jeroen van Menen`
- ✅ **author.email**: `jeroen@vanmenen.nl`

### 1.2 Optionele maar Aanbevolen Velden
- ❌ **brandColor**: Niet aanwezig - **VERPLICHT volgens richtlijnen**
- ❌ **homepage**: Geen website/documentatie link
- ❌ **support**: Geen support URL/email
- ❌ **source**: Geen GitHub/GitLab repository link
- ❌ **bugs**: Geen issue tracker link
- ❌ **homeyCommunityTopicId**: Geen Homey Community forum topic ID
- ❌ **contributing.donate.paypal.username**: Geen donatie optie

### 1.3 Actie Items - Manifest
1. **Voeg brandColor toe** (VERPLICHT)
   ```json
   "brandColor": "#FF6600"  // Kies een kleur die past bij je icon
   ```

2. **Voeg support velden toe** (indien van toepassing)
   ```json
   "homepage": "https://github.com/jvanmenen/homeymcp",
   "support": "mailto:jeroen@vanmenen.nl",
   "source": "https://github.com/jvanmenen/homeymcp",
   "bugs": "https://github.com/jvanmenen/homeymcp/issues"
   ```

3. **Overweeg donatie ondersteuning toe te voegen**
   ```json
   "contributing": {
     "donate": {
       "paypal": {
         "username": "jouw_paypal_username"
       }
     }
   }
   ```

4. **Maak een Homey Community topic** en voeg het ID toe
   - Ga naar https://community.homey.app
   - Maak een topic in het Developers forum
   - Voeg het topic ID toe aan manifest

---

## 2. Visuele Assets

### 2.1 App Icon (SVG)
- ✅ **Bestand**: `/assets/icon.svg` aanwezig
- 📋 **Vereisten te controleren**:
  - Transparante achtergrond
  - Duidelijk herkenbare branding
  - GEEN tekst in icon
  - GEEN achtergrondkleur

### 2.2 App Images (PNG/JPG) - **KRITIEK: ONTBREKEN**
- ❌ **small**: `/assets/images/small.png` (250×175px) - **ONTBREEKT**
- ❌ **large**: `/assets/images/large.png` (500×350px) - **ONTBREEKT**
- ❌ **xlarge**: `/assets/images/xlarge.png` (1000×700px) - **ONTBREEKT**

### 2.3 Actie Items - Visuele Assets
1. **PRIORITEIT: Maak app images aan**
   - De images directory bestaat maar is leeg
   - Vereiste formaten: 250×175, 500×350, 1000×700 pixels
   - Maak levendige, aantrekkelijke afbeeldingen
   - VERMIJD: Simpele logo's of clipart
   - AANBEVOLEN: Screenshots van de app in actie, gebruik scenarios

2. **Controleer icon.svg**
   - Open het bestand en verifieer dat het voldoet aan de eisen
   - Transparante achtergrond?
   - Geen tekst?
   - Duidelijk herkenbaar?

---

## 3. Content & Documentatie

### 3.1 README.txt
- ✅ **Bestand aanwezig**: `/README.txt`
- ⚠️ **Content**: Bevat slechts 1 korte regel
- ❌ **Kwaliteit**: Voldoet NIET aan richtlijnen

**Huidige content**:
```
An MCP Server to expose Homey Flows and Devices to Large Languages Models (LLMs)
```

**Vereisten volgens Athom**:
- 1-2 paragrafen plain text
- GEEN Markdown formatting
- GEEN URLs
- GEEN changelogs
- GEEN uitgebreide feature lijsten
- Focus op de "verhaal" achter de app

### 3.2 Description (in app.json)
- ⚠️ **Huidige description**: "An MCP Server to expose Homey Flows and Devices to Large Languages Models (LLMs)"
- ❌ **Probleem**: Te technisch en herhaalt de app naam

**Vereisten**:
- Eén pakkende regel
- NIET de app naam herhalen
- VERMIJD "adds support for" of "integrates with"
- Maak het aantrekkelijk voor eindgebruikers

**Voorbeeld verbeterde descriptions**:
- "Control your Homey with AI assistants like Claude using natural language"
- "Let AI assistants discover and control all your Homey devices and flows"
- "Bridge your smart home to powerful language models for intelligent automation"

### 3.3 Actie Items - Content
1. **Herschrijf README.txt**
   - Schrijf 1-2 paragrafen die uitleggen:
     - Wat de app doet (in begrijpelijke taal)
     - Waarom iemand het zou willen gebruiken
     - Hoe het je smart home ervaring verbetert
   - Gebruik plain text (geen markdown)
   - Geen technische jargon zoals "MCP Server" of "LLMs"

2. **Verbeter de description**
   - Maak het pakkend en gebruikersgericht
   - Focus op de voordelen, niet de technologie

---

## 4. App Naming

### 4.1 Naam Validatie
- ✅ **Naam**: "HomeyMCPServer"
- ✅ **Gebruikt GEEN "Homey" of "Athom"** (toegestaan als onderdeel, niet als prefix)
- ✅ **Gebruikt GEEN protocol namen** (Zigbee, Z-Wave, etc.)
- ✅ **Maximaal 4 woorden**

### 4.2 Overwegingen
- De naam "HomeyMCPServer" is technisch correct maar mogelijk te technisch
- "MCP" is misschien niet bekend bij gemiddelde gebruikers
- **Optioneel**: Overweeg een meer gebruiksvriendelijke naam zoals:
  - "Homey AI Assistant"
  - "Homey AI Bridge"
  - "AI Control for Homey"

---

## 5. Flow Cards

### 5.1 Trigger Card: "MCP command received"
- ✅ **title.en**: "MCP command received"
- ✅ **titleFormatted**: Gebruikt argumenten correct
- ✅ **hint**: Duidelijke uitleg aanwezig
- ✅ **Geen haakjes in titel**
- ✅ **Tokens**: 5 parameter tokens (value1-value5)

### 5.2 Aanbevelingen Flow Cards
- 📋 **Controleer**: Is "MCP" duidelijk voor eindgebruikers?
- **Overweeg**: Nederlandse vertaling is aanwezig maar mogelijk te technisch
- Flow card ziet er goed uit en volgt de richtlijnen

---

## 6. Meertaligheid

### 6.1 Huidige Talen
- ✅ **Engels**: Volledig geïmplementeerd
- ✅ **Nederlands**: Geïmplementeerd in Flow cards

### 6.2 Vereisten
- ⚠️ **Engels is verplicht**: Aanwezig
- ⚠️ **Consistentie**: Als je Nederlands toevoegt, moet ALLES vertaald zijn
  - Description (nu alleen Engels)
  - README.txt (nu alleen Engels)
  - Flow cards (aanwezig)

### 6.3 Actie Items - Meertaligheid
- **Optie A**: Voeg volledige Nederlandse vertaling toe voor alles
- **Optie B**: Verwijder Nederlandse vertalingen en gebruik alleen Engels
- **Aanbeveling**: Kies Optie A en voeg volledige NL support toe

---

## 7. Licentie & Juridisch

### 7.1 Licentie
- ✅ **LICENSE bestand**: GPL-3.0 aanwezig
- ✅ **Open source**: Voldoet aan Homey richtlijnen

### 7.2 Extra Bestanden
- ✅ **CODE_OF_CONDUCT.md**: Aanwezig
- ✅ **CONTRIBUTING.md**: Aanwezig

---

## 8. Technische Vereisten

### 8.1 Permissions
- ⚠️ **homey:manager:api**: Gebruikt
- ⚠️ **Let op**: Deze permission vereist grondiger review van Athom
- ⚠️ **Verwachting**: Langere review tijd

### 8.2 SDK & Compatibility
- ✅ **SDK 3**: Correct
- ✅ **Compatibility**: `>=12.4.0` - duidelijk gedefinieerd
- ✅ **Platform**: `local` - correct

### 8.3 Changelog
- ✅ **`.homeychangelog.json` aanwezig**
- ✅ **Versie 1.0.0 entry**: "First version!"

---

## 9. Build & Validatie

### 9.1 Validatie Status
```bash
homey app validate --level publish
```

**Huidige resultaten**:
- ❌ **FAIL**: `Filepath does not exist: /assets/images/small.png`
- ❌ **FAIL**: Impliceert ook large.png en xlarge.png ontbreken
- ⚠️ **Warning**: `homey:manager:api` permission vereist extra review

### 9.2 Actie Items - Validatie
1. **PRIORITEIT**: Maak de ontbrekende image assets
2. **Na images**: Run opnieuw validatie
3. **Voor publicatie**: Run `homey app validate --level publish` zonder errors

---

## 10. Publicatie Proces

### 10.1 Pre-Publicatie Checklist
- [ ] Alle validatie errors opgelost
- [ ] App getest op crashes en bugs
- [ ] Spelling & grammatica gecontroleerd
- [ ] Flow cards getest
- [ ] README.txt is gebruiksvriendelijk
- [ ] Description is pakkend
- [ ] Images zijn professioneel en aantrekkelijk
- [ ] brandColor toegevoegd en test het met je icon

### 10.2 Publicatie Stappen
1. **Build de app**:
   ```bash
   cd src/nl.vmcc.homeymcpserver
   homey app build
   ```

2. **Valideer op publish level**:
   ```bash
   homey app validate --level publish
   ```

3. **Publiceer naar Homey App Store**:
   ```bash
   homey app publish
   ```

4. **Ga naar je dashboard**:
   - https://tools.developer.homey.app
   - Apps SDK → My Apps
   - Beheer je submission

5. **Kies publicatie strategie**:
   - **Test Release**: Alleen via speciale link (aanbevolen voor eerste keer)
   - **Direct Live**: Direct beschikbaar na goedkeuring

### 10.3 Review Proces
- ⏱️ **Verwachte duur**: Tot 2 weken
- ⏱️ **Met `homey:manager:api`**: Mogelijk langer
- 📧 **Communicatie**: Via Athom developer dashboard
- ✅ **Mogelijke uitkomsten**:
  - Goedkeuring
  - Feedback/wijzigingen nodig
  - Vragen van Athom

---

## 11. Community & Support

### 11.1 Homey Community Forum
- ❌ **Forum topic**: Nog niet aangemaakt
- **Aanbevolen**:
  1. Maak een topic in het Developers forum
  2. Leg uit wat de app doet
  3. Vraag om feedback van community
  4. Voeg topic ID toe aan app.json

### 11.2 Source Code Repository
- 📋 **Status**: Onbekend of er een publieke repository is
- **Aanbevolen**:
  - Host op GitHub/GitLab
  - Voeg link toe aan app.json (`source` veld)
  - Voeg README.md toe aan repository (mag wel Markdown)
  - Voeg installatie instructies toe

---

## 12. Content Richtlijnen Samenvatting

### Wat MOET je vermijden:
- ❌ Adult content
- ❌ Betaalde features (app moet gratis blijven)
- ❌ Afhankelijkheid van andere apps voor kernfunctionaliteit
- ❌ Spelling/grammatica fouten
- ❌ "Homey" of "Athom" in app naam als prefix
- ❌ Protocol namen in app naam

### Wat wordt AANGEMOEDIGD:
- ✅ Donatie opties toevoegen
- ✅ Duidelijke, gebruiksvriendelijke content
- ✅ Professionele visuele assets
- ✅ Community betrokkenheid
- ✅ Open source development
- ✅ Goede documentatie

---

## 13. Prioriteiten Samenvatting

### KRITIEK (moet opgelost voor publicatie):
1. ❌ **App images maken** (small.png, large.png, xlarge.png)
2. ❌ **brandColor toevoegen** aan app.json
3. ⚠️ **README.txt verbeteren** (1-2 paragrafen, gebruiksvriendelijk)
4. ⚠️ **Description verbeteren** (pakkender en gebruikersgericht)

### HOOG (sterk aanbevolen):
5. ❌ **Support velden toevoegen** (homepage, support, source, bugs)
6. ❌ **Homey Community topic maken** en ID toevoegen
7. 📋 **Consistente meertaligheid** (NL volledig of alleen EN)

### MEDIUM (optioneel maar waardevol):
8. ❌ **Donatie optie toevoegen**
9. 📋 **App naam overwegen** (is "MCP" duidelijk genoeg?)
10. 📋 **Repository setup** (GitHub met goede README)

---

## 14. Quick Start Action Plan

### Fase 1: Kritieke Assets (1-2 uur)
1. Maak drie app images (250×175, 500×350, 1000×700)
   - Gebruik screenshots of conceptuele afbeeldingen
   - Zorg dat ze visueel aantrekkelijk zijn
2. Voeg brandColor toe aan .homeycompose/app.json
3. Run `homey app build` om app.json te regenereren

### Fase 2: Content Verbetering (30-60 min)
4. Herschrijf README.txt (1-2 paragrafen)
5. Verbeter description in .homeycompose/app.json
6. Overweeg meertaligheid strategie

### Fase 3: Metadata & Community (30-60 min)
7. Voeg support URLs toe aan app.json
8. Maak Homey Community forum topic
9. Voeg homeyCommunityTopicId toe

### Fase 4: Validatie & Publicatie
10. Run `homey app validate --level publish`
11. Los eventuele resterende issues op
12. Run `homey app publish`
13. Monitor je dashboard voor feedback van Athom

---

## 15. Handige Links

- **Homey Apps SDK Documentation**: https://apps.developer.homey.app
- **App Store Guidelines**: https://apps.developer.homey.app/app-store/guidelines
- **App Store Publishing**: https://apps.developer.homey.app/app-store/publishing
- **Developer Dashboard**: https://tools.developer.homey.app
- **Homey Community Forum**: https://community.homey.app
- **SDK v2 Docs (reference)**: https://apps-sdk-v2.developer.athom.com

---

## Conclusie

Je app is **technisch solide** maar heeft nog enkele **kritieke content en asset verbeteringen** nodig voordat het gepubliceerd kan worden:

**Blokkerende issues**:
- Ontbrekende app images (small, large, xlarge)
- Ontbrekende brandColor

**Sterk aanbevolen verbeteringen**:
- Betere README.txt en description
- Support URLs en community integratie
- Meer gebruiksvriendelijke content

Met 2-3 uur werk kun je alle kritieke items afvinken en de app klaar maken voor publicatie. Succes! 🚀
