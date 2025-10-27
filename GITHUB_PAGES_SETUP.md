# GitHub Pages Setup Instructies

## Eenmalige Setup (doe dit 1 keer)

1. Ga naar: https://github.com/jvmenen/homey-ai-chat-control/settings/pages

2. Onder **"Build and deployment"**:
   - **Source**: Selecteer **"GitHub Actions"**

3. Klik op **"Save"**

## Dat's alles!

De documentatie wordt nu automatisch gepubliceerd op:
**https://jvmenen.github.io/homey-ai-chat-control/**

## Wanneer wordt er gedeployed?

- Automatisch bij elke push naar `main` branch die bestanden in de `docs/` folder wijzigt
- Handmatig via de "Actions" tab → "Deploy Documentation to GitHub Pages" → "Run workflow"

## Verificatie

Na de eerste deployment kun je de status checken:
1. Ga naar: https://github.com/jvmenen/homey-ai-chat-control/actions
2. Kijk of de workflow succesvol is afgerond
3. Bezoek de URL: https://jvmenen.github.io/homey-ai-chat-control/

## Troubleshooting

Als het niet werkt:
- Controleer of GitHub Pages is ingeschakeld (stap 1-2 hierboven)
- Kijk in de Actions tab of er fouten zijn
- Zorg dat de `docs/` folder `index.html` bevat
