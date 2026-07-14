export type Mode =
  | 'clasico'
  | 'caos'
  | 'aliados'
  | 'espejo'
  | 'infiltrados'
  | 'aleatorio'
  | 'sin_impostores'
  | 'todos_impostores';
// 'ciego' removed from UI type — kept in DB/backend only
export type Difficulty = 'facil' | 'dificil' | 'brutal';

export interface Player {
  id: string;
  name: string;
  telegram_id: number | null;
  token: string;
}

export interface PlayerTokenOut {
  name: string;
  token: string;
}

export interface StartGameResponse {
  category: string;
  mode: Mode;
  n_impostors: number;
  sent: string[];
  failed: string[];
  session_id: string;
  players: PlayerTokenOut[];
  word?: string;
}

export interface RevealState {
  state: 'waiting' | 'ready';
  player_name: string;
  session_id?: string;
  is_impostor?: boolean;
  category?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  lang: string;
}
