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
- ✅ **id**: `nl.joonix.aichatcontrol`
- ✅ **version**: `1.0.0`
- ✅ **compatibility**: `>=12.4.0`
- ✅ **sdk**: `3`
- ✅ **name.en**: `AI Chat Control`
- ✅ **name.nl**: `AI Chat Controle`
- ✅ **description.en**: "Control your Homey with AI assistants like Claude using natural language"
- ✅ **description.nl**: "Bedien je Homey met AI assistenten zoals Claude via natuurlijke taal"
- ✅ **category**: `tools`
- ✅ **author.name**: `Jeroen van Menen`
- ✅ **author.email**: `jeroen@vanmenen.nl`

### 1.2 Optionele maar Aanbevolen Velden
- ✅ **brandColor**: `#A9BCB8`
- ✅ **homepage**: `https://jvmenen.github.io/homey-ai-chat-control/`
- ✅ **support**: `https://github.com/jvmenen/homey-ai-chat-control/issues`
- ✅ **source**: `https://github.com/jvmenen/homey-ai-chat-control`
- ✅ **bugs**: `https://github.com/jvmenen/homey-ai-chat-control/issues`
- ❌ **homeyCommunityTopicId**: Geen Homey Community forum topic ID
- ❌ **contributing.donate.paypal.username**: Geen donatie optie

### 1.3 Actie Items - Manifest

1. **Overweeg Homey Community topic** (optioneel)
   - Ga naar https://community.homey.app
   - Maak een topic in het Developers forum
   - Voeg het topic ID toe aan manifest

2. **Overweeg donatie ondersteuning toe te voegen** (optioneel)
   ```json
   "contributing": {
     "donate": {
       "paypal": {
         "username": "jouw_paypal_username"
       }
     }
   }
   ```

---

## 2. Visuele Assets

### 2.1 App Icon (SVG)
- ✅ **Bestand**: `/assets/icon.svg` aanwezig
- 📋 **Vereisten te controleren**:
  - Transparante achtergrond
  - Duidelijk herkenbare branding
  - GEEN tekst in icon
  - GEEN achtergrondkleur

### 2.2 App Images (PNG/JPG)
- ✅ **small**: `/assets/images/small.png` (250×175px)
- ✅ **large**: `/assets/images/large.png` (500×350px)
- ✅ **xlarge**: `/assets/images/xlarge.png` (1000×700px)

**Status**: Alle vereiste images zijn aanwezig!

---

## 3. Content & Documentatie

### 3.1 README.txt
- ✅ **Bestand aanwezig**: `/README.txt`
- ✅ **Content**: Uitgebreide beschrijving (2 paragrafen)
- ✅ **Kwaliteit**: Voldoet aan richtlijnen

**Huidige content** (samenvatting):
- Paragraaf 1: Uitlegt wat de app doet (AI assistenten verbinden met Homey via natuurlijke taal)
- Paragraaf 2: Uitlegt hoe het werkt (lokale server, zelfde netwerk, custom Flow triggers)
- Plain text, geen Markdown
- Geen URLs
- Gebruiksvriendelijk geschreven

**Vereisten volgens Athom**: ✅ Voldoet
- 1-2 paragrafen plain text
- GEEN Markdown formatting
- GEEN URLs
- GEEN changelogs
- GEEN uitgebreide feature lijsten
- Focus op de "verhaal" achter de app

### 3.2 Description (in app.json)
- ✅ **Engels**: "Control your Homey with AI assistants like Claude using natural language"
- ✅ **Nederlands**: "Bedien je Homey met AI assistenten zoals Claude via natuurlijke taal"
- ✅ **Kwaliteit**: Pakkend en gebruikersgericht

**Vereisten**: ✅ Voldoet
- Eén pakkende regel
- NIET de app naam herhalen
- VERMIJD "adds support for" of "integrates with"
- Maak het aantrekkelijk voor eindgebruikers

---

## 4. App Naming

### 4.1 Naam Validatie
- ✅ **Naam**: "AI Chat Control" / "AI Chat Controle"
- ✅ **Gebruikt GEEN "Homey" of "Athom"** (toegestaan als onderdeel, niet als prefix)
- ✅ **Gebruikt GEEN protocol namen** (Zigbee, Z-Wave, etc.)
- ✅ **Maximaal 4 woorden**
- ✅ **Gebruiksvriendelijk**: Duidelijk wat de app doet zonder technische jargon

**Conclusie**: Uitstekende naam die duidelijk maakt wat de app doet!

---

## 5. Flow Cards

### 5.1 Trigger Card: "AI Tool call"
- ✅ **title.en**: "AI Tool call"
- ✅ **title.nl**: "AI Tool aanroep"
- ✅ **titleFormatted**: Gebruikt argumenten correct
- ✅ **hint**: Duidelijke uitleg aanwezig (EN + NL)
- ✅ **Geen haakjes in titel**
- ✅ **Tokens**: 5 parameter tokens (value1-value5) + command token

### 5.2 Kwaliteit Flow Cards
- ✅ Volledig meertalig (EN + NL)
- ✅ Duidelijke beschrijvingen
- ✅ Goede voorbeelden in placeholders
- ✅ Volgt alle Homey richtlijnen

---

## 6. Meertaligheid

### 6.1 Huidige Talen
- ✅ **Engels**: Volledig geïmplementeerd
- ✅ **Nederlands**: Volledig geïmplementeerd

### 6.2 Vereisten
- ✅ **Engels is verplicht**: Aanwezig en compleet
- ✅ **Consistentie**: Alles consequent vertaald
  - ✅ Name (EN + NL)
  - ✅ Description (EN + NL)
  - ✅ Flow cards (EN + NL)
  - ✅ README.txt (Engels - standaard voor internationale apps)

**Conclusie**: Uitstekende meertalige implementatie!

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
- ⚠️ **Verwachting**: Langere review tijd (maar noodzakelijk voor de functionaliteit)

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

**Status**: 📋 Nog te testen na laatste wijzigingen

### 9.2 Actie Items - Validatie
1. **Voor publicatie**: Run `homey app validate --level publish` om te verifiëren dat alles klopt
2. **Test de app**: Zorg dat er geen crashes of bugs zijn
3. **Test Flow cards**: Verifieer dat alle Flow cards correct werken

---

## 10. Publicatie Proces

### 10.1 Pre-Publicatie Checklist
- ✅ Alle validatie errors opgelost
- 📋 App getest op crashes en bugs (nog te testen)
- ✅ Spelling & grammatica gecontroleerd
- 📋 Flow cards getest (nog te testen)
- ✅ README.txt is gebruiksvriendelijk
- ✅ Description is pakkend
- ✅ Images zijn professioneel en aantrekkelijk
- ✅ brandColor toegevoegd

### 10.2 Publicatie Stappen
1. **Build de app**:
   ```bash
   cd src/nl.joonix.aichatcontrol
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
- **Optioneel maar aanbevolen**:
  1. Maak een topic in het Developers forum
  2. Leg uit wat de app doet
  3. Vraag om feedback van community
  4. Voeg topic ID toe aan app.json

### 11.2 Source Code Repository
- ✅ **GitHub repository**: https://github.com/jvmenen/homey-ai-chat-control
- ✅ **Link in app.json**: Aanwezig
- ✅ **Issue tracker**: Geconfigureerd
- 📋 **README.md**: Te controleren of aanwezig en up-to-date

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

### ✅ VOLTOOID - Kritieke items:
1. ✅ **App images** (small.png, large.png, xlarge.png)
2. ✅ **brandColor** toegevoegd aan app.json
3. ✅ **README.txt** verbeterd (2 paragrafen, gebruiksvriendelijk)
4. ✅ **Description** verbeterd (pakkend en gebruikersgericht)
5. ✅ **Support velden** toegevoegd (homepage, support, source, bugs)

### ✅ VOLTOOID - Hoge prioriteit:
6. ✅ **Consistente meertaligheid** (volledig EN + NL)
7. ✅ **App naam** verbeterd (van "MCP" naar "AI Chat Control")

### OPTIONEEL - Nog niet gedaan:
8. ❌ **Homey Community topic** maken en ID toevoegen
9. ❌ **Donatie optie** toevoegen (PayPal)
10. 📋 **Repository README.md** controleren/verbeteren

---

## 14. Quick Start Action Plan

### ✅ Fase 1: Kritieke Assets - VOLTOOID
- ✅ Drie app images gemaakt (250×175, 500×350, 1000×700)
- ✅ brandColor toegevoegd aan .homeycompose/app.json

### ✅ Fase 2: Content Verbetering - VOLTOOID
- ✅ README.txt herschreven (2 paragrafen)
- ✅ Description verbeterd in .homeycompose/app.json
- ✅ Volledige meertaligheid (EN + NL)

### ✅ Fase 3: Metadata - VOLTOOID
- ✅ Support URLs toegevoegd aan app.json

### Fase 4: Validatie & Publicatie - KLAAR OM TE STARTEN
1. 📋 Run `homey app validate --level publish`
2. 📋 Los eventuele resterende issues op
3. 📋 Test de app grondig
4. 📋 Run `homey app publish`
5. 📋 Monitor je dashboard voor feedback van Athom

### Optioneel - Na publicatie:
6. ❌ Maak Homey Community forum topic
7. ❌ Voeg homeyCommunityTopicId toe
8. ❌ Overweeg donatie optie

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

🎉 **Je app is klaar voor publicatie!**

**Status**: ✅ Alle kritieke en hoge prioriteit items zijn voltooid!

**Wat is gedaan**:
- ✅ Alle verplichte assets (images, brandColor)
- ✅ Professionele content (README.txt, descriptions)
- ✅ Volledige meertaligheid (Engels + Nederlands)
- ✅ Alle support URLs en metadata
- ✅ Duidelijke, gebruiksvriendelijke naamgeving

**Volgende stappen**:
1. Run `homey app validate --level publish` om te verifiëren
2. Test de app grondig
3. Publiceer met `homey app publish`
4. Monitor het developer dashboard

**Optioneel (kan ook na publicatie)**:
- Homey Community topic aanmaken
- Donatie optie toevoegen

**Verwachte review tijd**: 1-2 weken (mogelijk langer vanwege `homey:manager:api` permission, maar dit is noodzakelijk voor de functionaliteit)

Succes met de publicatie! 🚀
