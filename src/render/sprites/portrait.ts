import { raceById, HAIR_COLORS, EYE_COLORS } from '../../data/races.ts';
import { classById } from '../../data/classes/index.ts';
import { armorModelById, cloakModelById, VISUALS, weaponModelById } from '../../data/equipment.ts';
import { regionById } from '../../data/regions.ts';
import { itemById } from '../../data/items.ts';
import type { EquipData } from '../../game/equipment.ts';
import { Canvas, hex, light, mix, shade, toHex } from '../canvas.ts';
import { M, renderRoles, RoleCanvas } from '../paint.ts';
import { iconFor } from './icons.ts';

export interface PortraitInput {
  race: string; raceChoice?: string | null; classId: string;
  appearance: { height: string; build: string; hair: string; hairColor: string; eyes: string; skin: number; marks: string };
  equipment: { slot: string; data: EquipData }[];
  region?: string;
  title?: string;
}

const LOOK_ROLES: Record<string, number> = {};
void LOOK_ROLES;

function outfitLook(eq: PortraitInput['equipment']): { look: string; color: string; legColor: string } {
  const torso = eq.find((e) => e.slot === 'torso')?.data;
  const legs = eq.find((e) => e.slot === 'pernas')?.data;
  let look = 'tunica';
  if (torso) {
    const visual = torso.appearance?.visual ? VISUALS.find((v) => v.id === torso.appearance!.visual)?.look : undefined;
    look = visual ?? armorModelById.get(torso.model)?.look ?? 'tunica';
  }
  const color = torso?.appearance?.color ?? itemById.get(torso?.material ?? '')?.color ?? '#6a5a8a';
  const legColor = legs?.appearance?.color ?? itemById.get(legs?.material ?? '')?.color ?? '#4a3a32';
  return { look, color, legColor };
}

export function renderPortrait(p: PortraitInput): Canvas {
  const race = raceById.get(p.race)!;
  const r = new RoleCanvas(64, 64);
  const feat = new Set(race.features);
  const short = p.appearance.height === 'baixa' || feat.has('baixo');
  const tall = p.appearance.height === 'alta' && !feat.has('baixo');
  const headY = short ? 22 : tall ? 13 : 17;
  const bw = p.appearance.build === 'esguia' ? 9 : p.appearance.build === 'robusta' ? 14 : 11;
  const cx = 32;
  const shoulderY = headY + 11;
  const hipY = Math.min(50, shoulderY + (short ? 13 : 17));
  const footY = 62;
  const { look, color, legColor } = outfitLook(p.equipment);
  const cape = p.equipment.find((e) => e.slot === 'capa')?.data;

  // Capa atrás
  if (cape) r.poly([[cx - bw - 2, shoulderY], [cx + bw + 2, shoulderY], [cx + bw + 7, footY - 2], [cx - bw - 7, footY - 2]], M.BASE2);
  // Pernas e botas
  r.rect(cx - bw + 2, hipY, bw - 3, footY - hipY - 4, M.LEATHER);
  r.rect(cx + 1, hipY, bw - 3, footY - hipY - 4, M.LEATHER);
  r.rect(cx - bw + 1, footY - 6, bw - 1, 6, M.DARK);
  r.rect(cx + 1, footY - 6, bw - 1, 6, M.DARK);
  // Braços
  r.line(cx - bw - 2, shoulderY + 2, cx - bw - 5, hipY + 2, M.CLOTH, 5);
  r.line(cx + bw + 2, shoulderY + 2, cx + bw + 5, hipY + 2, M.CLOTH, 5);
  r.circle(cx - bw - 5, hipY + 4, 2.5, M.SKIN);
  r.circle(cx + bw + 5, hipY + 4, 2.5, M.SKIN);
  // Torso conforme o visual
  const torso = (bottom: number) => r.poly([[cx - bw - 1, shoulderY], [cx + bw + 1, shoulderY], [cx + bw, bottom], [cx - bw, bottom]], M.CLOTH);
  switch (look) {
    case 'manto': torso(footY - 2); r.line(cx, shoulderY + 2, cx, footY - 3, M.ACCENT); r.rect(cx - bw, hipY - 2, bw * 2, 2, M.GOLD); break;
    case 'sobretudo': torso(hipY + 9); r.poly([[cx - 3, shoulderY], [cx, shoulderY + 9], [cx + 3, shoulderY]], M.ACCENT); r.line(cx, shoulderY + 9, cx, hipY + 8, M.ACCENT); r.dot(cx + 2, shoulderY + 12, M.GOLD); r.dot(cx + 2, shoulderY + 16, M.GOLD); break;
    case 'couro': torso(hipY + 2); r.line(cx - bw, shoulderY + 1, cx + bw, hipY - 2, M.LEATHER, 2); r.rect(cx - bw, hipY - 2, bw * 2, 2, M.LEATHER); break;
    case 'brigandina': torso(hipY + 3); for (let y = shoulderY + 3; y < hipY; y += 4) for (let x = cx - bw + 2; x < cx + bw; x += 4) r.dot(x, y, M.METAL); break;
    case 'malha': torso(hipY + 3); for (let y = shoulderY + 1; y < hipY + 3; y++) for (let x = cx - bw; x < cx + bw; x++) if ((x + y) % 3 === 0) r.set(x, y, M.METAL); break;
    case 'escamas': torso(hipY + 3); for (let y = shoulderY + 2; y < hipY + 2; y += 3) for (let x = cx - bw + 1 + (y % 2) * 2; x < cx + bw; x += 4) r.ellipse(x, y, 1.5, 1.2, M.ACCENT); break;
    case 'placas': torso(hipY + 2); r.ellipse(cx - bw - 1, shoulderY + 2, 5, 4, M.METAL); r.ellipse(cx + bw + 1, shoulderY + 2, 5, 4, M.METAL); r.rect(cx - bw + 2, shoulderY + 4, bw * 2 - 4, 8, M.METAL); r.line(cx, shoulderY + 4, cx, hipY, M.ACCENT); r.rect(cx - bw, hipY - 1, bw * 2, 3, M.METAL); break;
    default: torso(hipY + 4); r.rect(cx - bw, hipY - 1, bw * 2, 2, M.LEATHER); r.poly([[cx - 2, shoulderY], [cx, shoulderY + 4], [cx + 2, shoulderY]], M.SKIN);
  }
  // Pescoço e cabeça
  r.rect(cx - 2, headY + 7, 5, 5, M.SKIN);
  r.ellipse(cx, headY + 2, 7, 8, M.SKIN);
  // Traços raciais
  if (feat.has('orelhas_longas')) { r.poly([[cx - 7, headY + 1], [cx - 14, headY - 5], [cx - 7, headY + 4]], M.SKIN); r.poly([[cx + 7, headY + 1], [cx + 14, headY - 5], [cx + 7, headY + 4]], M.SKIN); }
  if (feat.has('orelhas_animais')) { r.poly([[cx - 6, headY - 4], [cx - 8, headY - 12], [cx - 2, headY - 6]], M.HAIR); r.poly([[cx + 6, headY - 4], [cx + 8, headY - 12], [cx + 2, headY - 6]], M.HAIR); r.dot(cx - 6, headY - 7, M.SKIN); r.dot(cx + 6, headY - 7, M.SKIN); }
  if (feat.has('chifres')) { r.line(cx - 4, headY - 5, cx - 9, headY - 12, M.BONE, 2); r.line(cx + 4, headY - 5, cx + 9, headY - 12, M.BONE, 2); }
  if (feat.has('escamas')) for (const [x, y] of [[-5, 4], [5, 4], [-6, 0], [6, 1], [-2, 7]]) r.dot(cx + x, headY + y, M.ACCENT);
  if (feat.has('placas')) { r.line(cx, headY - 6, cx, headY + 9, M.DARK); r.rect(cx - 7, headY + 2, 3, 2, M.METAL); r.rect(cx + 5, headY + 2, 3, 2, M.METAL); }
  if (feat.has('veios')) { r.line(cx - 6, headY + 3, cx - 3, headY + 8, M.GLOW); r.line(cx + 5, headY - 2, cx + 3, headY + 2, M.GLOW); }
  // Cabelo
  const hs = p.appearance.hair;
  if (hs !== 'raspado' && !feat.has('placas')) {
    r.ellipse(cx, headY - 3, 8, 5, M.HAIR);
    r.rect(cx - 7, headY - 3, 14, 3, M.HAIR);
    if (hs === 'longo') { r.rect(cx - 8, headY - 2, 3, 16, M.HAIR); r.rect(cx + 6, headY - 2, 3, 16, M.HAIR); }
    if (hs === 'trança') { r.rect(cx + 6, headY - 2, 3, 6, M.HAIR); for (let y = headY + 4; y < headY + 18; y += 3) r.circle(cx + 8, y, 1.8, M.HAIR); }
    if (hs === 'moicano') { r.rect(cx - 7, headY - 3, 14, 4, M.SKIN); r.rect(cx - 2, headY - 9, 4, 8, M.HAIR); }
    if (hs === 'coque') r.circle(cx, headY - 9, 3.5, M.HAIR);
    if (hs === 'cacheado') for (let i = -3; i <= 3; i++) r.circle(cx + i * 2.4, headY - 5 + Math.abs(i) * 0.6, 2.4, M.HAIR);
  }
  if (feat.has('folhas')) for (const [x, y] of [[-6, -5], [0, -9], [6, -6]]) r.poly([[cx + x, headY + y], [cx + x + 3, headY + y - 3], [cx + x + 4, headY + y + 1]], M.LEAF);
  if (feat.has('barba')) r.poly([[cx - 6, headY + 3], [cx + 6, headY + 3], [cx + 4, headY + 13], [cx, headY + 15], [cx - 4, headY + 13]], M.HAIR);
  // Rosto
  const glowEyes = feat.has('olhos_brilhantes');
  r.dot(cx - 3, headY + 2, glowEyes ? M.GLOW : M.WHITE); r.dot(cx - 2, headY + 2, glowEyes ? M.GLOW : M.EYE);
  r.dot(cx + 2, headY + 2, glowEyes ? M.GLOW : M.EYE); r.dot(cx + 3, headY + 2, glowEyes ? M.GLOW : M.WHITE);
  if (!feat.has('barba')) r.line(cx - 1, headY + 6, cx + 1, headY + 6, M.DARK);
  if (feat.has('presas')) { r.dot(cx - 2, headY + 6, M.BONE); r.dot(cx + 2, headY + 6, M.BONE); r.dot(cx - 2, headY + 5, M.BONE); r.dot(cx + 2, headY + 5, M.BONE); }
  switch (p.appearance.marks) {
    case 'cicatriz': r.line(cx + 3, headY - 1, cx + 5, headY + 5, M.ACCENT); break;
    case 'tatuagem': for (let i = 0; i < 3; i++) r.dot(cx - 5, headY + 1 + i * 2, M.DARK); break;
    case 'pintura': r.line(cx - 5, headY + 3, cx + 5, headY + 3, M.FIRE); break;
    case 'sardas': for (const [x, y] of [[-4, 4], [-3, 5], [3, 4], [4, 5]]) r.dot(cx + x, headY + y, M.ACCENT); break;
    case 'runas': r.dot(cx, headY - 2, M.GLOW); r.dot(cx - 1, headY - 1, M.GLOW); r.dot(cx + 1, headY - 1, M.GLOW); break;
  }

  const skin = race.skins[Math.min(race.skins.length - 1, p.appearance.skin)] ?? race.skins[0];
  const cls = classById.get(p.classId);
  const outfit = hex(color);
  const pal = {
    [M.SKIN]: skin, [M.HAIR]: HAIR_COLORS[p.appearance.hairColor] ?? '#5a3a22', [M.EYE]: EYE_COLORS[p.appearance.eyes] ?? '#5a3a22',
    [M.CLOTH]: color, [M.ACCENT]: toHex(shade(outfit, 0.4)), [M.LEATHER]: legColor, [M.BASE2]: cape?.appearance?.color ?? itemById.get(cape?.material ?? '')?.color ?? cls?.color ?? '#5a3a6a',
    [M.GLOW]: race.id === 'forjado' ? '#60e0f0' : '#c080ff', [M.METAL]: toHex(light(mix(outfit, hex('#a0a8b8'), 0.6), 0.1)),
    [M.DARK]: '#2a2030', [M.GOLD]: '#e0b040', [M.BONE]: '#e8e0c8', [M.WHITE]: '#f8f4ec', [M.LEAF]: '#5aa040', [M.FIRE]: '#c03030',
  };
  const fig = renderRoles(r, pal, { outline: 'auto', shadeAmt: 0.3, lightAmt: 0.2 });

  // Fundo: região atual com vinheta
  const bg = new Canvas(64, 64);
  const regColor = hex(regionById.get(p.region ?? 'bosque')?.color ?? '#4a3a6a');
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot(x - 32, y - 28) / 46;
    const band = Math.floor(y / 8) % 2 ? 0.04 : 0;
    bg.set(x, y, shade(mix(regColor, hex('#1a1424'), 0.55), Math.min(0.9, d * 0.8 + band)));
  }
  bg.rect(0, 58, 64, 6, shade(regColor, 0.75));
  bg.blit(fig, 0, 0);
  // Arma na mão
  const weapon = p.equipment.find((e) => e.slot === 'arma')?.data;
  if (weapon) {
    const icon = weaponModelById.get(weapon.model)?.icon ?? 'espada';
    bg.blit(iconFor(icon, weapon.appearance?.color ?? itemById.get(weapon.material)?.color ?? '#a0a0a0'), cx + bw + 1, hipY - 10);
  }
  const off = p.equipment.find((e) => e.slot === 'secundaria')?.data;
  if (off) {
    const icon = weaponModelById.get(off.model)?.icon ?? 'escudo';
    bg.blit(iconFor(icon, off.appearance?.color ?? itemById.get(off.material)?.color ?? '#a0a0a0'), cx - bw - 14, hipY - 8);
  }
  void cloakModelById;
  return bg;
}
