export type Mode = 'clasico' | 'caos' | 'ciego' | 'aliados' | 'espejo';
export type Difficulty = 'facil' | 'dificil' | 'brutal';

export interface Player {
  id: string;
  name: string;
  telegram_id: number;
}

export interface GameResult {
  category: string;
  mode: string;
  n_impostors: number;
  sent: string[];
  failed: string[];
}

export interface AuthUser {
  id: string
  email: string
  name: string
  lang: string
}
