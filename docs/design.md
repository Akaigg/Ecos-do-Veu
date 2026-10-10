# Ecos do Véu — notas de design

Este documento registra as decisões que estão no código, as hipóteses de balanceamento e o que ainda falta. Os números citados vêm de `src/data/*` e `src/game/*`; se divergir, o código vale.

## Personagem e progressão

- **Atributos:** vigor, força, destreza, intelecto, espírito e percepção. Vida máxima = `(40 + vigor×8 + nível×6) × (1 + vida%) + vida fixa`. Resistências têm teto de 75%.
- **Classe por personagem, progresso por classe.** Trocar de classe no santuário não apaga o progresso da anterior; cada classe guarda nível e talentos próprios.
- **Talentos:** cada classe tem 3 árvores de 10 nós (ativa, bifurcação, ativa, bifurcação, passiva, ativa, modificador, culminante). Pontos = `⌊nível/2⌋` + marcos (15, 30, 45, 60). Os pontos **não** bastam para completar todas as árvores (testado), então cada build é uma escolha. Bifurcações são exclusivas; redistribuição tem duas trocas gratuitas e depois custo crescente.
- **Seis ativas + uma passiva:** o jogador monta o conjunto de 6 habilidades a partir do que aprendeu. No nível 40 abre uma disciplina secundária de outra classe.

## Combate

- Por turnos, com **linha de frente e retaguarda**. Ataques corpo a corpo só alcançam a retaguarda quando a frente inimiga está vazia. Mover-se pode acompanhar a ação da rodada (o movimento acontece antes dela).
- **Intenções visíveis:** os inimigos escolhem a ação ao fim da rodada e o painel mostra o que farão. Isso torna defender, interromper e trocar de linha decisões reais.
- Ordem: fase dos heróis, depois fase dos inimigos. Estados de controle diminuem depois do turno de quem os sofre.
- **Combos elementais** (ex.: molhado + raio), estados acumuláveis, escudos, provocação, interrupção.
- **Chefes** têm fases por vida, medidores (que sobem com certos elementos e fortalecem o chefe), rotações fixas, pilhas que mudam de efeito por linha, e **partes** com ordem de destruição (placas, sigilos, cabeças da hidra que voltam a crescer). Partes travadas pela ordem não aparecem como alvo.
- **Domar:** criaturas domáveis podem ser capturadas em combate com uma isca no cinto, de tier compatível, quando estão abaixo de 35% de vida (25% para variantes). A chance sobe quanto mais ferido o alvo e com percepção/espírito, e cai se a criatura for de nível maior.
- **Cinto de combate:** consumíveis vão do inventário para um dono intermediário durante a luta e o que sobra volta ao fim.
- Combate em grupo: painel compartilhado + painel pessoal efêmero; quem não age dentro do prazo (modo assíncrono) usa a postura automática escolhida.

### Hipóteses de balanceamento

`npm run balance` simula todas as classes contra todas as regiões e chefes com uma IA ingênua. Resultado atual:

- Criaturas comuns solo no nível da região: a maioria das classes vence a maioria dos encontros; encontros duplos em regiões tardias são difíceis de propósito (devem empurrar para grupo ou preparo).
- Variantes especiais solo: ~79% de vitórias — elas são “mini-chefes” e devem exigir atenção.
- Chefes com grupo sugerido (nível +2): 17 de 20 vencidos em quase todas as simulações. **Hidra das Sete Fomes, Coração do Micélio e Fornalha Viva** quase sempre derrotam a IA, porque exigem a contramedida da mecânica (queimar os tocos da hidra, destruir os brotos na ordem, esfriar a fornalha). A IA de teste não faz isso; jogadores lendo as intenções devem fazer. **Precisa de validação com pessoas.**
- Monge e Bardo aparecem abaixo das outras classes nas regiões tardias no simulador. Parte é a IA (o Bardo depende de sinergia de grupo e o Monge de sequências de combo), mas vale observar em teste real.
- Multiplicador de vida por tamanho do grupo: comuns ×1 / 1,5 / 2 / 2,5; chefes ×1 / 1,8 / 2,6 / 3,4.

## Trabalho automático

- `/trabalhar` monta uma ordem com local, horas, ferramentas e suprimentos (ração, água, células de energia em locais escuros) e mostra uma **previsão** antes de confirmar.
- **Regras de parada** (a primeira que acontecer vence): tempo, mochila cheia (capacidade em kg), ferramenta perto de quebrar, fim dos suprimentos, perigo do local sem contramedida.
- A ordem inteira é simulada a partir de uma semente salva: interromper no meio entrega exatamente o que já teria sido coletado até aquele minuto, e a entrega depois de um reinício do bot é idêntica.
- Fadiga começa depois de algumas horas (mais cedo em altitude sem preparo) e reduz o rendimento.
- Ferramentas e suprimentos ficam presos à atividade enquanto ela roda; o que sobra volta.

## Fabricação

- Receitas simples (poções, comida, refino) e **equipamento em camadas**: base (material e modelo) + reforço + forro + acabamento, com **orçamento de poder** limitado por tier. Raridade (comum → lendário) e propriedades especiais são sorteadas; efeitos lendários exigem o material único de um chefe.
- Fila de produção com horário de término no banco. Materiais saem uma única vez, na entrada da fila (testado).
- Ferramentas são fabricadas, gastam durabilidade, podem ser reparadas e aprimoradas.

## Pets

- Domados em combate. Cada espécie tem afinidade (que define o saque de missões por faixa de região), assistência em combate e traços.
- **Missões:** 1, 2, 4, 8 ou 12 horas, consomem ração de pet por hora, exigem nível mínimo por faixa de região e devolvem itens ao fim. Um pet em missão não luta.
- Um pet ativo pode acompanhar o jogador em combate como lacaio.

## Mundo, social e economia

- 12 regiões com clima semanal, perigos e assinatura de material. **Eventos regionais** cíclicos (determinísticos por semana) mudam rendimento, saques e preços.
- Exploração em 6 passos com caminhos parcialmente revelados; a mochila só vai para o inventário ao voltar à cidade; uma derrota perde metade do que ainda não foi guardado.
- Mapas do tesouro, descobertas raras, bestiário com pistas que revelam fraquezas, títulos, reputação com facções e contratos semanais acumuláveis.
- **Mercado:** taxa de anúncio 2%, imposto de venda 5%, até 20 anúncios de 72 h. Compra atômica (dois compradores simultâneos não levam o mesmo item — testado).
- **Encomendas:** o pedido deixa materiais e pagamento em custódia; o artesão fabrica e recebe.
- **Guildas:** cargos, cofre com permissões por cargo, registro de movimentações, projetos coletivos (melhorias da sede), estandarte em pixel art e biblioteca.
- **Campanhas:** até 4 jogadores, ao vivo ou assíncronas (prazo de votação configurável de 1 a 48 h). Capítulos com escolhas votadas, testes de atributo, combates, acampamentos (onde dá para pausar e trocar de membro) e chefe final. Algumas escolhas dependem da história do personagem. *O Último Rasgo* exige exatamente 4 pessoas. Fragmentos de campanha são trocados por recompensas.

## Imagens

Imagens pequenas sempre que possível: ícones 16×16 (< 2 KB cada) agrupados em catálogos (inventário, loja, habilidades). Imagens maiores apenas onde o tamanho importa: retrato do personagem (64×64 ampliado), mapa do mundo, sede da guilda, árvore de talentos e cena de batalha. Tudo é gerado na hora, sem arquivos estáticos.

## O que ainda não foi feito

Pendências conhecidas, para planejar as próximas etapas:

- **Teste num servidor real.** Todo o fluxo foi exercitado com interações simuladas do discord.js, mas não rodou ainda com um token de verdade. Limites práticos (tempo de resposta de 3 s em imagens grandes, permissões de tópico, DMs bloqueadas) precisam ser conferidos ao vivo.
- **Moradia** do jogador (casa, armazenamento extra, decoração).
- **Arena** / combate entre jogadores.
- **Quadro de contratos da guilda:** a melhoria da sede existe, mas os contratos coletivos ainda não.
- **Progressão depois do nível máximo** além de coleções, títulos e bestiário (maestrias, por exemplo).
- **Balanceamento com pessoas:** os três chefes de mecânica dura e as classes Monge/Bardo (ver acima).
- **Escala:** o banco é SQLite num único processo. Para muitos servidores seria preciso trocar por Postgres e separar o processador de tarefas, mantendo as mesmas transações.
