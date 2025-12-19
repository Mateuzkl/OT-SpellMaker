# 🧙‍♂️ Open Tibia Spell Maker

Uma ferramenta web moderna para criar e editar spells de área para Open Tibia (TFS 1.x+).

## 🚀 Funcionalidades

- **Editor Visual**: Grid interativo (11x11, 15x15, 21x21) para desenhar áreas de efeito.
- **Leitor de SPR (.spr)**: **NOVO!** Carregue seu próprio arquivo `Tibia.spr` para usar os sprites oficiais do cliente!
- **Modo Local/Online**: Funciona com imagens locais ou carrega do arquivo SPR.
- **Gerador de Lua**: Cria automaticamente o código Lua pronto para copiar e colar no seu servidor.
- **Tema Dark**: Interface moderna inspirada em editores de código.

## 🛠️ Como Usar

1. Abra o arquivo `index.html` no seu navegador.
2. (Opcional) Clique em **Load .SPR** no topo e selecione seu arquivo `Tibia.spr` para carregar sprites reais.
3. Se não carregar SPR, ele usará as imagens da pasta `src/images/effects`.
4. **Painel Esquerdo**: Configure o nome, palavras mágicas, mana, cooldown e tipo de dano.
5. **Painel Direito**: Navegue pelos efeitos/sprites.
6. **Painel Central**:
   - Clique nas células do grid para "pintar" a área.
   - Use os botões de tamanho para ajustar o grid.
   - Botão **Test Animation** mostra um preview visual.
7. **Gerar Código**: Copie o código Lua gerado.

## 📦 Estrutura

- `index.html`: Arquivo principal.
- `src/styles/styles.css`: Estilização.
- `src/javascript/script.js`: Lógica principal.
- `src/javascript/spr_loader.js`: Lógica de leitura binária de arquivos .spr.

---
*Transformado a partir do repositório landing-page-food-theme.*
