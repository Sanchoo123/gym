# Gym Sancho

PWA para registar treinos no iPhone: coach com progressão automática, recordes, animações dos exercícios e chat com o Claude.

## Testar no PC
```bash
python3 -m http.server 8080
```
Abre http://localhost:8080 no Chrome/Edge e ativa o modo de telemóvel nas DevTools (F12 → ícone do telemóvel).

## Instalar no iPhone (GitHub Pages, grátis)
1. Cria um repositório no GitHub e faz push desta pasta.
2. No repositório: **Settings → Pages → Branch: main / root → Save**.
3. Abre o link `https://<user>.github.io/<repo>/` no **Safari** do iPhone.
4. Toca em **Partilhar → Adicionar ao ecrã principal**.

Para publicares uma atualização: faz push e sobe `VERSION` no `sw.js` (ex.: `v2`), senão o iPhone continua a usar a versão em cache.

## Coach com AI
Em Definições, cola uma chave da API da Anthropic (console.anthropic.com → API Keys). Define um limite de gastos baixo na consola. A chave fica só no iPhone.

## Dados
Ficam guardados localmente no iPhone. Usa **Definições → Exportar backup** de vez em quando.
