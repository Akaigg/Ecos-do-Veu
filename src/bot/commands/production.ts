import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { PROFESSIONS, professionById } from '../../data/professions.ts';
import { WORK_LOCATIONS, workLocationById, regionById } from '../../data/regions.ts';
import { itemById, ITEMS } from '../../data/items.ts';
import { RECIPES, recipeById } from '../../data/recipes.ts';
import {
  ARMOR_MODELS, CLOAK_MODELS, FINISHES, JEWELRY_MODELS, LININGS, REINFORCEMENTS, SLOTS, SLOT_LABEL, TOOL_MODELS, VISUALS, WEAPON_MODELS,
  LEGENDARY_EFFECTS, RARITY_INFO, materialByItem, type Slot,
} from '../../data/equipment.ts';
import { SHOP_TOOLS } from '../../data/social.ts';
import { STOP_LABEL, type WorkRules } from '../../game/work.ts';
import { analyzeSpec, recipeLabel, type CraftSpec, type EquipSpec } from '../../game/crafting.ts';
import { describeEquip, equipColor, equipIcon, computeEquipStats } from '../../game/equipment.ts';
import { fail, type Game } from '../../services/core.ts';
import { allProfs, allUnlockSet, getCharacterByUser, getProf, hasUnlock, requireCharacter, unlocksOf, type Character } from '../../services/character.ts';
import { currentWork, finishWork, lastReports, planWork, resolvePending, startWork } from '../../services/work.ts';
import { analyzeFor, cancelCraft, pendingQueue, queueCraft, queueSlots, recentCrafts } from '../../services/crafting.ts';
import { applyOil, buy, damagedItems, equipItem, repair, sell, sellUnique, setVisual, shopCatalog, unequip, uniqueItems, upgrade, upgradeCost } from '../../services/gear.ts';
import { currentExploration } from '../../services/exploration.ts';
import { runOf } from '../../services/campaign.ts';
import { listPets } from '../../services/pets.ts';
import { iconFor } from '../../render/sprites/icons.ts';
import { catalogImage, itemCatalog } from '../../render/scenes.ts';
import { command, component, ephemeral } from '../registry.ts';
import { bar, clip, COLORS, duration, gold, image, itemList, itemName, ts } from '../ui/format.ts';

const GATHER = PROFESSIONS.filter((p) => p.kind === 'coleta');
const CRAFT = PROFESSIONS.filter((p) => p.kind === 'fabricacao' || p.id === 'caca');

// ===================================================================== /trabalhar

const RULE_KEYS = ['stopBeforeBreak', 'useReserves', 'returnFull', 'ignoreCommon', 'stopOnDanger'] as const;
function rulesFromBits(bits: string): Partial<WorkRules> {
  const b = (n: number) => bits[n] === '1';
  return { stopBeforeBreak: b(0), useReserves: b(1), returnAt: b(2) ? 0.95 : 1, ignoreCommon: b(3), stopOnDanger: b(4) };
}

function workPreview(g: Game, c: Character, loc: string, hours: number, bits: string) {
  const plan = planWork(g, c, loc, hours, rulesFromBits(bits));
  const f = plan.forecast;
  const p = plan.params;
  const tool = p.tools[0];
  const sample = Object.entries(f.sample).sort((a, b) => b[1][1] - a[1][1]).slice(0, 6).map(([k, [lo, hi]]) => `${itemName(k)} ${lo}–${hi}`).join(', ');
  const limit = f.limits.reduce((a, b) => (b.hours < a.hours ? b : a));
  const rows = [
    ['Duração solicitada', `${p.hours} hora(s)`],
    ['Ferramenta', `${tool.name}: ${Math.round(tool.durability)} de ${tool.maxDurability}${p.tools.length > 1 ? ` (+${p.tools.length - 1} reserva)` : ''}`],
    ['Desgaste estimado', `${f.wearPerHour.toFixed(1)} por hora`],
    ['Comida', p.perHour.racao > 0 ? `${p.supplies.racao} ração(ões); consumo de ${p.perHour.racao.toFixed(2)} por hora` : '—'],
    ['Água', p.perHour.agua > 0 ? `${p.supplies.agua} unidade(s); consumo de ${p.perHour.agua.toFixed(2)} por hora` : p.perHour.celula > 0 ? `Células: ${p.supplies.celula}; ${p.perHour.celula} por hora` : '—'],
    ['Carga disponível', `${p.capacityKg} kg`],
    ['Produção esperada', `${f.itemsMin}–${f.itemsMax} itens (${sample || 'sujeita à jazida e à perícia'})`],
    ['Paradas', `tempo, ${p.rules.stopBeforeBreak ? 'antes da ferramenta quebrar' : 'até a quebra'}${p.rules.useReserves ? ' (usa reservas)' : ''}, suprimentos, ${p.rules.returnAt < 1 ? 'mochila quase cheia' : 'mochila cheia'}${p.rules.stopOnDanger ? ', perigo' : ''}`],
  ];
  const lines = rows.map(([k, v]) => `**${k}:** ${v}`);
  lines.push('', `📌 Primeiro limite previsto: **${limit.label}** (~${limit.hours.toFixed(1)}h). Simulação: ~${f.expectedHours.toFixed(1)}h, parada por ${STOP_LABEL[f.stop]}.`);
  if (plan.needs.racao > p.supplies.racao || plan.needs.agua > p.supplies.agua) lines.push(`⚠️ Suprimentos não cobrem todas as ${p.hours}h (precisa de ${plan.needs.racao} rações e ${plan.needs.agua} águas). Compre na \`/loja\`.`);
  if (f.hazardNote) lines.push(`🌡️ ${f.hazardNote}`);
  if (plan.veinNote) lines.push(`⛏️ ${plan.veinNote}`);
  if (plan.location.danger !== 'segura') lines.push(`⚠️ Área **${plan.location.danger}**: eventos perigosos podem encerrar a ordem ou causar perdas limitadas.`);
  const embed = new EmbedBuilder().setColor(COLORS.info).setTitle(`⛏️ Ordem de trabalho — ${plan.location.name}`)
    .setDescription(lines.join('\n')).setFooter({ text: `${professionById.get(p.profession)?.name} nível ${p.profLevel} • ${regionById.get(plan.location.region)?.name}` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`wk:go:${loc}:${p.hours}:${bits}`).setStyle(ButtonStyle.Success).setLabel('Confirmar').setEmoji('✅'),
    new ButtonBuilder().setCustomId('wk:cancel').setStyle(ButtonStyle.Secondary).setLabel('Cancelar'),
  );
  return { embeds: [embed], components: [row] };
}

command({
  data: new SlashCommandBuilder().setName('trabalhar').setDescription('Planeja uma ordem de trabalho automática (continua com o Discord fechado)')
    .addStringOption((o) => o.setName('atividade').setDescription('Profissão de coleta').setRequired(true).addChoices(...GATHER.map((p) => ({ name: p.name, value: p.id }))))
    .addStringOption((o) => o.setName('local').setDescription('Local conhecido na região atual').setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => o.setName('duracao').setDescription('Horas (1 a 12)').setRequired(true).setMinValue(1).setMaxValue(12))
    .addBooleanOption((o) => o.setName('parar_antes_de_quebrar').setDescription('Parar antes de a ferramenta chegar a zero (padrão: sim)'))
    .addBooleanOption((o) => o.setName('usar_reservas').setDescription('Usar ferramentas de reserva (padrão: sim)'))
    .addBooleanOption((o) => o.setName('voltar_quase_cheia').setDescription('Voltar com a mochila quase cheia (padrão: sim)'))
    .addBooleanOption((o) => o.setName('ignorar_comuns').setDescription('Ignorar materiais secundários (padrão: não)'))
    .addBooleanOption((o) => o.setName('encerrar_no_perigo').setDescription('Encerrar diante de perigo (padrão: sim)')),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const bit = (name: string, def: boolean) => ((i.options.getBoolean(name) ?? def) ? '1' : '0');
    const bits = bit('parar_antes_de_quebrar', true) + bit('usar_reservas', true) + bit('voltar_quase_cheia', true) + bit('ignorar_comuns', false) + bit('encerrar_no_perigo', true);
    const loc = workLocationById.get(i.options.getString('local', true)) ?? fail('Local desconhecido.');
    if (loc!.profession !== i.options.getString('atividade', true)) fail(`${loc!.name} é um local de ${professionById.get(loc!.profession)?.name}.`);
    return i.reply(ephemeral(workPreview(g, c, loc!.id, i.options.getInteger('duracao', true), bits)));
  },
  async autocomplete(ctx, i) {
    const c = getCharacterByUser(ctx.game, i.user.id);
    if (!c) return i.respond([]);
    const prof = i.options.getString('atividade');
    const q = i.options.getFocused().toLowerCase();
    const known = new Set(unlocksOf(ctx.game, c.id, 'local'));
    return i.respond(WORK_LOCATIONS.filter((l) => known.has(l.id) && l.region === c.region && (!prof || l.profession === prof) && l.name.toLowerCase().includes(q))
      .slice(0, 25).map((l) => ({ name: `${l.name} (${professionById.get(l.profession)?.name}, ${l.danger})`, value: l.id })));
  },
});

component('wk', async (ctx, i, [action, a, b, bits]) => {
  const g = ctx.game;
  const c = requireCharacter(g, i.user.id);
  if (!i.isButton()) return;
  if (action === 'cancel') return i.update({ content: 'Ordem cancelada.', embeds: [], components: [] });
  if (action === 'go') {
    const plan = planWork(g, c, a, Number(b), rulesFromBits(bits));
    const r = startWork(g, c, plan);
    return i.update({ content: `✅ Ordem iniciada em **${plan.location.name}**. Conclusão prevista ${ts(r.endsAt)} (${STOP_LABEL[r.result.stop]}). Você receberá um relatório; acompanhe com \`/atividade\`.`, embeds: [], components: [] });
  }
  if (action === 'stop') {
    const w = currentWork(g, c.id) ?? fail('Nenhuma ordem de trabalho em andamento.');
    const rep = finishWork(g, w!.row.id, g.now());
    return i.update({ content: rep ? `⏹️ Ordem interrompida após ${duration(rep.result.minutes * 60000)}. Produção: ${itemList(rep.result.items)}. Suprimentos não usados voltaram ao inventário.` : 'Já concluída.', embeds: [], components: [] });
  }
  if (action === 'pend') {
    const [choiceId, opt] = [b, bits];
    const msg = resolvePending(g, c, Number(a), choiceId, opt);
    return i.update({ content: msg, embeds: [], components: [] });
  }
});

// ===================================================================== /atividade

command({
  data: new SlashCommandBuilder().setName('atividade').setDescription('Progresso, previsão e interrupção das suas atividades'),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const lines: string[] = [];
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const w = currentWork(g, c.id);
    if (w) {
      const total = w.row.ends_at - w.row.started_at;
      const done = g.now() - w.row.started_at;
      lines.push(`⛏️ **Trabalhando em ${w.location.name}** \`${bar(done / total)}\` término ${ts(w.row.ends_at)}`,
        `   Até agora: ${itemList(w.partial.items)} • ${w.partial.weightKg} kg`);
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('wk:stop').setStyle(ButtonStyle.Danger).setLabel('Interromper e voltar')));
    }
    const ex = currentExploration(g, c.id);
    if (ex) lines.push(`🧭 **Explorando ${regionById.get(ex.state.region)?.name}** — passo ${ex.state.step + 1}/${ex.state.maxSteps}. Use \`/explorar\` para continuar.`);
    const run = runOf(g, c.id);
    if (run) lines.push(`📜 **Campanha** em andamento (${run.status}). Use \`/campanha continuar\`.`);
    if (!w && !ex && !run) lines.push('🏙️ Nenhuma atividade de campo: você está livre na cidade.');
    const q = pendingQueue(g, c.id);
    lines.push('', `🔨 **Fila de produção** (${q.length}/${queueSlots(g, c)}):`);
    lines.push(...(q.length ? q.map((x) => `• ${x.label} — pronta ${ts(x.ends_at)}`) : ['• vazia']));
    const pets = listPets(g, c.id).filter((p) => p.status === 'missao');
    if (pets.length) lines.push('', '🐾 **Pets em missão:**', ...pets.map((p) => `• ${p.name} em ${regionById.get(p.mission!.region)?.name} — volta ${ts(p.mission!.endsAt)}`));
    const reports = lastReports(g, c.id, 3);
    const pendRow = new ActionRowBuilder<ButtonBuilder>();
    if (reports.length) {
      lines.push('', '📋 **Últimos relatórios:**');
      for (const r of reports) {
        lines.push(`• ${workLocationById.get(r.params.location)?.name}: ${itemList(r.result.items)} (${STOP_LABEL[r.result.stop]}, ${duration(r.result.minutes * 60000)})${Object.keys(r.result.lostItems).length ? ` • perdido: ${itemList(r.result.lostItems)}` : ''}`);
        for (const e of r.result.events.slice(-2)) lines.push(`   ↳ ${e.text}`);
        for (const p of r.result.pending) {
          lines.push(`   ⚠️ ${p.text}`);
          for (const o of p.options) if (pendRow.components.length < 5) pendRow.addComponents(new ButtonBuilder().setCustomId(`wk:pend:${r.id}:${p.id}:${o.id}`).setLabel(clip(o.label, 70)).setStyle(ButtonStyle.Primary));
        }
      }
    }
    if (pendRow.components.length) rows.push(pendRow);
    const recent = recentCrafts(g, c.id, 3);
    if (recent.length) lines.push('', '✅ **Produções prontas recentes:** ' + recent.map((r) => r.label).join(', '));
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('📋 Atividades').setDescription(clip(lines.join('\n'), 4000))], components: rows }));
  },
});

// ===================================================================== /fabricar

const pendingSpecs = new Map<string, CraftSpec>();

function craftPreview(g: Game, c: Character, spec: CraftSpec) {
  const an = analyzeFor(g, c, spec);
  const have = (k: string) => g.db.get<{ qty: number }>("SELECT qty FROM items WHERE owner_kind='char' AND owner_id=? AND item_key=? AND data IS NULL", c.id, k)?.qty ?? 0;
  const lines = [
    `**${an.label}** — ${professionById.get(an.profession)?.name ?? an.profession} (nível ${an.level}+) • ⏱️ ${duration(an.minutes * 60000)}`,
    '',
    '**Materiais:** ' + an.inputs.map(([k, q]) => `${have(k) >= q ? '✅' : '❌'} ${q}× ${itemName(k)} (${have(k)})`).join(', '),
  ];
  if (an.preview) lines.push('', ...describeEquip({ ...an.preview, durability: an.preview.maxDurability }).map((l) => `> ${l}`), '_A raridade final é sorteada ao concluir (perícia acima do requisito aumenta as chances; catalisadores permitem épico)._');
  if (an.errors.length) lines.push('', ...an.errors.map((e) => `⛔ ${e}`));
  const files = [];
  const embed = new EmbedBuilder().setColor(an.ok ? COLORS.ok : COLORS.bad).setTitle('🔨 Fabricação').setDescription(clip(lines.join('\n'), 4000));
  if (an.preview) {
    const ic = image(iconFor(equipIcon(an.preview), equipColor(an.preview)).scaled(4), 'peca');
    embed.setThumbnail(ic.url);
    files.push(ic.file);
  }
  pendingSpecs.set(c.userId, spec);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('fb:go').setStyle(ButtonStyle.Success).setLabel('Colocar na fila').setDisabled(!an.ok),
    new ButtonBuilder().setCustomId('fb:cancel').setStyle(ButtonStyle.Secondary).setLabel('Cancelar'),
  );
  return { embeds: [embed], components: [row], files };
}

const pieceChoices = [{ name: 'Cabeça', value: 'cabeca' }, { name: 'Torso', value: 'torso' }, { name: 'Mãos', value: 'maos' }, { name: 'Pernas', value: 'pernas' }, { name: 'Pés', value: 'pes' }, { name: 'Amuleto', value: 'amuleto' }, { name: 'Anel', value: 'anel' }];

command({
  data: new SlashCommandBuilder().setName('fabricar').setDescription('Receitas, equipamentos em camadas, ferramentas e fila de produção')
    .addSubcommand((s) => s.setName('receita').setDescription('Produz materiais, poções, comidas e runas')
      .addStringOption((o) => o.setName('receita').setDescription('Receita').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName('quantidade').setDescription('Vezes').setMinValue(1).setMaxValue(50)))
    .addSubcommand((s) => s.setName('equipamento').setDescription('Monta uma peça camada por camada')
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true).addChoices({ name: 'Armadura', value: 'armadura' }, { name: 'Capa', value: 'capa' }, { name: 'Joia', value: 'joia' }, { name: 'Arma / mão secundária', value: 'arma' }))
      .addStringOption((o) => o.setName('modelo').setDescription('Modelo').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('material').setDescription('Material principal').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('peca').setDescription('Parte do corpo (armaduras) ou tipo de joia').addChoices(...pieceChoices))
      .addStringOption((o) => o.setName('reforco').setDescription('Reforço (ocupa capacidade)').addChoices(...REINFORCEMENTS.map((r) => ({ name: `${r.name} — ${r.desc}`.slice(0, 100), value: r.id }))))
      .addStringOption((o) => o.setName('forro').setDescription('Forro (resistências ambientais)').addChoices(...LININGS.map((r) => ({ name: `${r.name} — ${r.desc}`.slice(0, 100), value: r.id }))))
      .addStringOption((o) => o.setName('acabamento').setDescription('Acabamento').addChoices(...FINISHES.map((r) => ({ name: `${r.name} — ${r.desc}`.slice(0, 100), value: r.id }))))
      .addStringOption((o) => o.setName('runa1').setDescription('Runa').setAutocomplete(true))
      .addStringOption((o) => o.setName('runa2').setDescription('Runa').setAutocomplete(true))
      .addStringOption((o) => o.setName('runa3').setDescription('Runa').setAutocomplete(true))
      .addStringOption((o) => o.setName('gema').setDescription('Gema (joias)').setAutocomplete(true))
      .addStringOption((o) => o.setName('catalisador').setDescription('Material de chefe ou Fragmento do Véu (permite épico)').setAutocomplete(true))
      .addStringOption((o) => o.setName('lendario').setDescription('Efeito lendário aprendido').setAutocomplete(true))
      .addStringOption((o) => o.setName('cor').setDescription('Cor da aparência (#rrggbb)').setMaxLength(7))
      .addStringOption((o) => o.setName('nome').setDescription('Nome da peça').setMaxLength(40)))
    .addSubcommand((s) => s.setName('ferramenta').setDescription('Fabrica uma ferramenta de coleta')
      .addStringOption((o) => o.setName('modelo').setDescription('Ferramenta').setRequired(true).addChoices(...TOOL_MODELS.map((t) => ({ name: t.name, value: t.id }))))
      .addStringOption((o) => o.setName('material').setDescription('Material').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('fila').setDescription('Mostra e cancela produções'))
    .addSubcommand((s) => s.setName('receitas').setDescription('Lista receitas de uma profissão')
      .addStringOption((o) => o.setName('profissao').setDescription('Profissão').setRequired(true).addChoices(...CRAFT.map((p) => ({ name: p.name, value: p.id }))))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    if (sub === 'receita') return i.reply(ephemeral(craftPreview(g, c, { t: 'receita', recipe: i.options.getString('receita', true), qty: i.options.getInteger('quantidade') ?? 1 })));
    if (sub === 'ferramenta') return i.reply(ephemeral(craftPreview(g, c, { t: 'ferramenta', model: i.options.getString('modelo', true), material: i.options.getString('material', true) })));
    if (sub === 'equipamento') {
      const piece = i.options.getString('peca') ?? undefined;
      const kind = i.options.getString('tipo', true) as EquipSpec['kind'];
      const spec: EquipSpec = {
        t: 'equipamento', kind, model: i.options.getString('modelo', true), material: i.options.getString('material', true),
        piece: (kind === 'joia' ? (i.options.getString('modelo', true) === 'amuleto' ? 'amuleto' : 'anel') : piece) as EquipSpec['piece'],
        reinforcement: i.options.getString('reforco') ?? undefined, lining: i.options.getString('forro') ?? undefined, finish: i.options.getString('acabamento') ?? undefined,
        runes: ['runa1', 'runa2', 'runa3'].map((k) => i.options.getString(k)).filter((x): x is string => !!x),
        gem: i.options.getString('gema') ?? undefined, catalyst: i.options.getString('catalisador') ?? undefined, legendary: i.options.getString('lendario') ?? undefined,
        color: i.options.getString('cor') ?? undefined, name: i.options.getString('nome') ?? undefined,
      };
      return i.reply(ephemeral(craftPreview(g, c, spec)));
    }
    if (sub === 'fila') {
      const q = pendingQueue(g, c.id);
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const x of q.filter((x) => x.started_at > g.now()).slice(0, 5)) row.addComponents(new ButtonBuilder().setCustomId(`fb:del:${x.id}`).setStyle(ButtonStyle.Danger).setLabel(clip(`Cancelar ${x.label}`, 80)));
      return i.reply(ephemeral({ content: q.length ? q.map((x) => `• **${x.label}** — ${x.started_at > g.now() ? `começa ${ts(x.started_at)}, ` : ''}pronta ${ts(x.ends_at)}`).join('\n') : 'Fila vazia.', components: row.components.length ? [row] : [] }));
    }
    if (sub === 'receitas') {
      const prof = i.options.getString('profissao', true);
      const lvl = getProf(g, c.id, prof).level;
      const unlocks = allUnlockSet(g, c.id);
      const list = RECIPES.filter((r) => r.profession === prof);
      return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle(`📒 Receitas — ${professionById.get(prof)?.name} (nível ${lvl})`)
        .setDescription(clip(list.map((r) => `${lvl >= r.level && (!r.unlock || unlocks.has(`receita:${r.id}`)) ? '✅' : '🔒'} **${recipeLabel(r)}** (nv ${r.level}) — ${r.inputs.map(([k, q]) => `${q} ${itemName(k)}`).join(', ')}`).join('\n'), 4000))
        .setFooter({ text: 'Equipamentos e ferramentas são montados por camadas: /fabricar equipamento • /fabricar ferramenta' })] }));
    }
  },
  async autocomplete(ctx, i) {
    const g = ctx.game;
    const c = getCharacterByUser(g, i.user.id);
    if (!c) return i.respond([]);
    const f = i.options.getFocused(true);
    const q = f.value.toLowerCase();
    const inv = new Map(g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0", c.id).map((r) => [r.item_key, r.qty]));
    const lvl = Object.fromEntries(allProfs(g, c.id).map((p) => [p.professionId, p.level]));
    const fmt = (k: string) => `${itemById.get(k)?.name ?? k} (${inv.get(k) ?? 0})`;
    const out = (list: { name: string; value: string }[]) => i.respond(list.filter((x) => x.name.toLowerCase().includes(q)).slice(0, 25));
    switch (f.name) {
      case 'receita': return out(RECIPES.filter((r) => (lvl[r.profession] ?? 1) >= r.level).map((r) => ({ name: `${recipeLabel(r)} — ${professionById.get(r.profession)?.name} ${r.level}`.slice(0, 100), value: r.id })));
      case 'modelo': {
        const tipo = i.options.getString('tipo');
        const models = tipo === 'armadura' ? ARMOR_MODELS : tipo === 'capa' ? CLOAK_MODELS : tipo === 'joia' ? JEWELRY_MODELS : WEAPON_MODELS;
        return out(models.map((m) => ({ name: m.name, value: m.id })));
      }
      case 'material': return out([...inv.keys()].filter((k) => materialByItem.has(k)).map((k) => ({ name: fmt(k), value: k })));
      case 'runa1': case 'runa2': case 'runa3': return out([...inv.keys()].filter((k) => k.startsWith('runa-')).map((k) => ({ name: fmt(k), value: k })));
      case 'gema': return out([...inv.keys()].filter((k) => materialByItem.get(k)?.family === 'cristal').map((k) => ({ name: fmt(k), value: k })));
      case 'catalisador': return out([...inv.keys()].filter((k) => k === 'fragmento-veu' || (itemById.get(k)?.kind === 'monstro' && (itemById.get(k)?.value ?? 0) > 40)).map((k) => ({ name: fmt(k), value: k })));
      case 'lendario': return out(Object.entries(LEGENDARY_EFFECTS).filter(([id]) => hasUnlock(g, c.id, 'receita', `lendario:${id}`)).map(([id, e]) => ({ name: `${e.name} — ${e.desc}`.slice(0, 100), value: id })));
    }
    return i.respond([]);
  },
});

component('fb', async (ctx, i, [action, id]) => {
  const g = ctx.game;
  const c = requireCharacter(g, i.user.id);
  if (!i.isButton()) return;
  if (action === 'cancel') { pendingSpecs.delete(c.userId); return i.update({ content: 'Fabricação cancelada.', embeds: [], components: [], attachments: [] }); }
  if (action === 'del') { cancelCraft(g, c, Number(id)); return i.update({ content: '🗑️ Produção cancelada e materiais devolvidos.', components: [] }); }
  if (action === 'go') {
    const spec = pendingSpecs.get(c.userId) ?? fail('Prévia expirada. Use o comando novamente.');
    const r = queueCraft(g, c, spec!);
    pendingSpecs.delete(c.userId);
    return i.update({ content: `🔨 **${r.analysis.label}** na fila — pronta ${ts(r.row.ends_at)}.${r.saved.length ? ` Aproveitamento: economizou ${itemList(r.saved)}.` : ''}`, embeds: [], components: [], attachments: [] });
  }
});

// ===================================================================== /equipamento e /inventario

function slotIcon(g: Game, c: Character) {
  const eq = uniqueItems(g, c).filter((x) => x.slot);
  const entries = SLOTS.map((s) => {
    const it = eq.find((x) => x.slot === s);
    return it
      ? { icon: iconFor(equipIcon(it.data), equipColor(it.data)), color: RARITY_INFO[it.data.rarity].color }
      : { icon: iconFor('saco', '#3a3442'), dim: true };
  });
  return catalogImage(entries, 6);
}

command({
  data: new SlashCommandBuilder().setName('equipamento').setDescription('Peças equipadas, visuais, reparo e aprimoramento')
    .addSubcommand((s) => s.setName('ver').setDescription('Espaços equipados'))
    .addSubcommand((s) => s.setName('inspecionar').setDescription('Detalhes de uma peça').addStringOption((o) => o.setName('item').setDescription('Peça').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('equipar').setDescription('Equipa uma peça').addStringOption((o) => o.setName('item').setDescription('Peça').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('remover').setDescription('Desequipa um espaço').addStringOption((o) => o.setName('espaco').setDescription('Espaço').setRequired(true).addChoices(...SLOTS.map((s) => ({ name: SLOT_LABEL[s], value: s })))))
    .addSubcommand((s) => s.setName('visual').setDescription('Aparência desbloqueada sobre a peça (não muda atributos)')
      .addStringOption((o) => o.setName('item').setDescription('Peça').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('visual').setDescription('Visual desbloqueado').setAutocomplete(true))
      .addStringOption((o) => o.setName('cor').setDescription('Cor (#rrggbb)').setMaxLength(7)))
    .addSubcommand((s) => s.setName('reparar').setDescription('Repara todas as peças desgastadas (custa ouro)'))
    .addSubcommand((s) => s.setName('aprimorar').setDescription('Aprimoramento garantido até +5 (nunca destrói a peça)').addStringOption((o) => o.setName('item').setDescription('Peça').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('oleo').setDescription('Aplica um óleo na arma principal').addStringOption((o) => o.setName('oleo').setDescription('Óleo').setRequired(true).setAutocomplete(true))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    const rowId = () => Number(i.options.getString('item', true));
    if (sub === 'ver') {
      const eq = uniqueItems(g, c).filter((x) => x.slot);
      const img = image(slotIcon(g, c), 'equipamento');
      return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🛡️ Equipamento').setImage(img.url).setDescription(SLOTS.map((s, n) => {
        const it = eq.find((x) => x.slot === s);
        if (!it) return `\`${n + 1}\` ${SLOT_LABEL[s]}: —`;
        const st = computeEquipStats(it.data);
        return `\`${n + 1}\` ${SLOT_LABEL[s]}: **${it.data.name}** (${RARITY_INFO[it.data.rarity].label}${it.data.upgrade ? ` +${it.data.upgrade}` : ''})${st.damage ? ` • dano ${st.damage}` : ''}${st.armor ? ` • arm ${st.armor}` : ''} • ${it.data.durability}/${it.data.maxDurability}${it.data.oil ? ` • óleo ${it.data.oil.elem} (${it.data.oil.fights})` : ''}`;
      }).join('\n'))], files: [img.file] }));
    }
    if (sub === 'inspecionar') {
      const it = uniqueItems(g, c).find((x) => x.id === rowId()) ?? fail('Peça não encontrada.');
      const ic = image(iconFor(equipIcon(it!.data), equipColor(it!.data)).scaled(4), 'peca');
      return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(parseInt(RARITY_INFO[it!.data.rarity].color.slice(1), 16)).setTitle(it!.data.name).setThumbnail(ic.url)
        .setDescription(describeEquip(it!.data).join('\n') + (it!.data.crafter ? `\n_Feita por ${it!.data.crafter}_` : '') + (it!.bound ? '\n🔗 Vinculada' : ''))], files: [ic.file] }));
    }
    if (sub === 'equipar') { const slot = equipItem(g, c, rowId()); return i.reply(ephemeral(`✅ Equipado em ${SLOT_LABEL[slot]}.`)); }
    if (sub === 'remover') { unequip(g, c, i.options.getString('espaco', true) as Slot); return i.reply(ephemeral('✅ Removido.')); }
    if (sub === 'visual') { const d = setVisual(g, c, rowId(), i.options.getString('visual'), i.options.getString('cor') ?? undefined); return i.reply(ephemeral(`🎨 Aparência de **${d.name}** atualizada.`)); }
    if (sub === 'reparar') {
      const list = damagedItems(g, c);
      if (!list.length) fail('Nada para reparar.');
      const total = repair(g, c, list.map((x) => x.id));
      return i.reply(ephemeral(`🔧 ${list.length} peça(s) reparada(s) por ${gold(total)}.`));
    }
    if (sub === 'aprimorar') {
      const it = uniqueItems(g, c).find((x) => x.id === rowId()) ?? fail('Peça não encontrada.');
      const cost = upgradeCost(it!.data);
      const d = upgrade(g, c, it!.id);
      return i.reply(ephemeral(`⬆️ **${d.name}** agora é +${d.upgrade} (custou ${gold(cost.gold)} e ${itemList(cost.items)}).`));
    }
    if (sub === 'oleo') { const d = applyOil(g, c, i.options.getString('oleo', true)); return i.reply(ephemeral(`🛢️ Óleo aplicado em **${d.name}** (${d.oil?.fights} combates).`)); }
  },
  async autocomplete(ctx, i) {
    const g = ctx.game;
    const c = getCharacterByUser(g, i.user.id);
    if (!c) return i.respond([]);
    const f = i.options.getFocused(true);
    const q = f.value.toLowerCase();
    if (f.name === 'visual') {
      const owned = new Set(unlocksOf(g, c.id, 'visual'));
      return i.respond(VISUALS.filter((v) => owned.has(v.id) && v.name.toLowerCase().includes(q)).map((v) => ({ name: v.name, value: v.id })));
    }
    if (f.name === 'oleo') {
      const rows = g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0", c.id);
      return i.respond(rows.filter((r) => itemById.get(r.item_key)?.use?.t === 'oleo').map((r) => ({ name: `${itemById.get(r.item_key)!.name} (${r.qty})`, value: r.item_key })));
    }
    const sub = i.options.getSubcommand();
    return i.respond(uniqueItems(g, c).filter((x) => x.data.kind !== 'ferramenta' || sub === 'inspecionar').filter((x) => x.data.name.toLowerCase().includes(q)).slice(0, 25)
      .map((x) => ({ name: clip(`${x.slot ? '⚔️ ' : ''}${x.data.name} — ${RARITY_INFO[x.data.rarity].label}${x.data.upgrade ? ` +${x.data.upgrade}` : ''}`, 100), value: String(x.id) })));
  },
});

const INV_FILTERS: Record<string, (k: string) => boolean> = {
  materiais: (k) => !itemById.get(k)?.use,
  consumiveis: (k) => !!itemById.get(k)?.use,
  todos: () => true,
};

command({
  data: new SlashCommandBuilder().setName('inventario').setDescription('Seus itens (catálogo compacto)')
    .addStringOption((o) => o.setName('filtro').setDescription('Filtro').addChoices({ name: 'Todos', value: 'todos' }, { name: 'Materiais', value: 'materiais' }, { name: 'Consumíveis', value: 'consumiveis' }, { name: 'Peças e ferramentas', value: 'pecas' }))
    .addIntegerOption((o) => o.setName('pagina').setDescription('Página').setMinValue(1)),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const filtro = i.options.getString('filtro') ?? 'todos';
    const page = (i.options.getInteger('pagina') ?? 1) - 1;
    if (filtro === 'pecas') {
      const list = uniqueItems(g, c);
      const img = image(catalogImage(list.slice(page * 32, page * 32 + 32).map((x) => ({ icon: iconFor(equipIcon(x.data), equipColor(x.data)), color: RARITY_INFO[x.data.rarity].color, badge: x.slot ? 'E' : x.data.upgrade ? `+${x.data.upgrade}` : undefined }))), 'pecas');
      return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle(`🎒 Peças e ferramentas (${list.length})`).setImage(img.url)
        .setDescription(clip(list.slice(page * 32, page * 32 + 32).map((x, n) => `\`${n + 1}\` ${x.data.name} — ${RARITY_INFO[x.data.rarity].label} • ${x.data.durability}/${x.data.maxDurability}${x.slot ? ' (equipado)' : ''}`).join('\n') || 'Nada.', 4000))], files: [img.file] }));
    }
    const rows = g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0 ORDER BY item_key", c.id)
      .filter((r) => (INV_FILTERS[filtro] ?? INV_FILTERS.todos)(r.item_key));
    const slice = rows.slice(page * 40, page * 40 + 40);
    const img = image(itemCatalog(slice.map((r) => ({ item: r.item_key, qty: r.qty }))), 'inventario');
    const embed = new EmbedBuilder().setColor(COLORS.info).setTitle(`🎒 Inventário — ${gold(c.gold)}`).setImage(img.url)
      .setDescription(clip(slice.map((r, n) => `\`${n + 1}\` ${itemById.get(r.item_key)?.name} ×${r.qty}`).join(' • ') || 'Vazio.', 4000))
      .setFooter({ text: `Página ${page + 1}/${Math.max(1, Math.ceil(rows.length / 40))}` });
    return i.reply(ephemeral({ embeds: [embed], files: [img.file] }));
  },
});

// ===================================================================== /loja

command({
  data: new SlashCommandBuilder().setName('loja').setDescription('Catálogo da Companhia dos Errantes')
    .addSubcommand((s) => s.setName('ver').setDescription('Catálogo'))
    .addSubcommand((s) => s.setName('comprar').setDescription('Compra').addStringOption((o) => o.setName('item').setDescription('Item').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setMinValue(1).setMaxValue(99)))
    .addSubcommand((s) => s.setName('vender').setDescription('Vende materiais à Companhia (30% do valor)').addStringOption((o) => o.setName('item').setDescription('Item').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setMinValue(1)))
    .addSubcommand((s) => s.setName('vender_peca').setDescription('Vende uma peça única').addStringOption((o) => o.setName('item').setDescription('Peça').setRequired(true).setAutocomplete(true))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    if (sub === 'ver') {
      const cat = shopCatalog(c);
      const entries = [...cat.items.map((e) => ({ icon: iconFor(itemById.get(e.item)!.icon, itemById.get(e.item)!.color), badge: String(e.price) })),
        ...cat.tools.map((t) => ({ icon: iconFor(TOOL_MODELS.find((m) => m.id === t.tool)!.icon, itemById.get(t.material)!.color), badge: String(t.price) }))];
      const img = image(catalogImage(entries), 'loja');
      const names = [...cat.items.map((e) => `${itemById.get(e.item)!.name} — ${e.price}`), ...cat.tools.map((t) => `${TOOL_MODELS.find((m) => m.id === t.tool)!.name} de bronze — ${t.price}`)];
      return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle(`🏪 Loja — ${regionById.get(c.region)?.hub}`).setImage(img.url)
        .setDescription(names.map((n, k) => `\`${k + 1}\` ${n}`).join(' • ')).setFooter({ text: `Seu ouro: ${c.gold}` })], files: [img.file] }));
    }
    if (sub === 'comprar') { const r = buy(g, c, i.options.getString('item', true), i.options.getInteger('quantidade') ?? 1); return i.reply(ephemeral(`🛒 Comprou ${r.label} por ${gold(r.cost)}.`)); }
    if (sub === 'vender') { const n = sell(g, c, i.options.getString('item', true), i.options.getInteger('quantidade') ?? 1); return i.reply(ephemeral(`💰 Vendido por ${gold(n)}.`)); }
    if (sub === 'vender_peca') { const n = sellUnique(g, c, Number(i.options.getString('item', true))); return i.reply(ephemeral(`💰 Peça vendida por ${gold(n)}.`)); }
  },
  async autocomplete(ctx, i) {
    const g = ctx.game;
    const c = getCharacterByUser(g, i.user.id);
    if (!c) return i.respond([]);
    const q = i.options.getFocused().toLowerCase();
    const sub = i.options.getSubcommand();
    if (sub === 'comprar') {
      const cat = shopCatalog(c);
      return i.respond([...cat.items.map((e) => ({ name: `${itemById.get(e.item)!.name} — ${e.price}`, value: e.item })), ...SHOP_TOOLS.map((t) => ({ name: `${TOOL_MODELS.find((m) => m.id === t.tool)!.name} — ${t.price}`, value: t.tool }))]
        .filter((x) => x.name.toLowerCase().includes(q)).slice(0, 25));
    }
    if (sub === 'vender_peca') return i.respond(uniqueItems(g, c).filter((x) => !x.slot && x.data.name.toLowerCase().includes(q)).slice(0, 25).map((x) => ({ name: clip(x.data.name, 100), value: String(x.id) })));
    const rows = g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0", c.id);
    return i.respond(rows.filter((r) => itemById.get(r.item_key)?.name.toLowerCase().includes(q)).slice(0, 25).map((r) => ({ name: `${itemById.get(r.item_key)!.name} (${r.qty}) — ${Math.max(1, Math.floor(itemById.get(r.item_key)!.value * 0.3))} cada`, value: r.item_key })));
  },
});

void ITEMS; void recipeById; void analyzeSpec;
