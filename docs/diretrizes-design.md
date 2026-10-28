# Diretrizes Técnicas de Design e Motion - Agibank

Este documento estabelece as regras matemáticas e as boas práticas de layout para o motor de renderização e animação do HUB Audiovisual.

## 📐 1. Grid e Margens de Segurança
- **Margem de Respiro:** Todo motion deve conter uma área de respiro nas bordas do layout, preservando o conteúdo principal.
- **Reserva de Logo:** A área de segurança ao redor dos logotipos deve ser de, no mínimo, **3 vezes o tamanho do pingo verde do "i"** do logotipo. Nunca ultrapasse ou invada essa área com textos ou grafismos.

## 🟩 2. Regras para os Módulos de Composição (Grafismos)
Os módulos diagonais que dividem a tela devem seguir estritamente as regras de proporção e geometria:
1. **Cantos Arredondados:** Todo módulo diagonal deve ter cantos arredondados configurados **estritamente entre 12px e 17px**. 
   - *Atenção:* Nunca utilize cantos retos (0px), valores menores que 12px ou cantos excessivamente arredondados (maiores que 18px).
2. **Espaçamentos entre Módulos:** A distância entre as divisões deve ser proporcional, mantendo de **5% a 8% do tamanho do módulo**. Não sobreponha, não grude e não ultrapasse 9% de distância.
3. **Divisões e Diagonais:** As extremidades dos módulos nas bordas da tela devem ser sempre perfeitamente horizontais ou verticais. As divisões internas devem ser diagonais e **nunca paralelas** (devem possuir ângulos de inclinação diferentes).

## 🌀 3. Aplicação de Texturas e Formas Irregulares
- **Formas Irregulares:** Podem ser rotacionadas, espelhadas ou escalonadas, desde que nunca sejam distorcidas em suas proporções originais.
- **Legibilidade sobre Texturas:** **NUNCA** aplique o logotipo ou textos diretamente sobrepostos às texturas geométricas de fundo. A textura serve exclusivamente como máscara para imagens ou plano de fundo sem texto para preservar a legibilidade.

## 👁️ 4. Contraste de Cores para Textos e Lettering
Siga a escala de contraste oficial para garantir legibilidade perfeita nos letterings de vídeo:
- **Sobre fundo Branco:** Use preferencialmente **Azul Escuro (#000f44)** ou **Azul Médio (#0033b0)**.
- **Sobre fundo Azul Agibank (#0064f5):** Use exclusivamente texto em **Branco (#FFFFFF)**.
- **Sobre fundo Azul Escuro (#000f44):** Use texto em **Branco (#FFFFFF)**, **Verde Claro (#C9FF90)** ou **Amarelo (#FFD600)**.
- **Sobre fundo Verde (#77df40):** Use exclusivamente texto em **Azul Escuro (#000f44)**.
- **Sobre fundo Amarelo (#FFD600):** Use exclusivamente texto em **Azul Escuro (#000f44)**.
