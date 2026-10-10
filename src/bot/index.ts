// Carrega todos os módulos de comandos (cada um se registra no registry).
import './commands/character.ts';
import './commands/adventure.ts';
import './commands/production.ts';
import './commands/world.ts';

export { commands, components, dispatch } from './registry.ts';
