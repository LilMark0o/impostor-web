import type { Mode, Difficulty } from '../types';

export const MODE_LABELS: Record<Mode, string> = {
  clasico:          'Clásico',
  caos:             'Caos',
  aliados:          'Aliados',
  espejo:           'Espejo',
  infiltrados:      'Infiltrados',
  aleatorio:        'Aleatorio',
  sin_impostores:   'Sin Impostores',
  todos_impostores: 'Todos Impostores',
};

export const MODE_ICONS: Record<Mode, string> = {
  clasico:          '🎯',
  caos:             '🎲',
  aliados:          '🤝',
  espejo:           '🪞',
  infiltrados:      '🕵️',
  aleatorio:        '🎰',
  sin_impostores:   '😇',
  todos_impostores: '🔥',
};

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  clasico:          'Un impostor. No sabe la palabra.',
  caos:             'Impostores aleatorios. Todos saben cuántos hay.',
  aliados:          '2 impostores que se conocen entre sí.',
  espejo:           'El impostor tiene una palabra diferente de la misma categoría.',
  infiltrados:      '2 impostores con palabras distintas. No se conocen.',
  aleatorio:        'El destino elige. Puede pasar cualquier cosa.',
  sin_impostores:   'Nadie es impostor. ¿Lo sabrán?',
  todos_impostores: 'Todos son impostores. Nadie sabe la palabra.',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil:   'Fácil',
  dificil: 'Difícil',
  brutal:  'Brutal',
};
