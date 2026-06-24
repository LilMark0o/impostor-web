import type { Mode, Difficulty } from '../types';

export const MODE_LABELS: Record<Mode, string> = {
  clasico: 'Clásico',
  caos: 'Caos',
  ciego: 'Ciego',
  aliados: 'Aliados',
  espejo: 'Espejo',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  dificil: 'Difícil',
  brutal: 'Brutal',
};
