import type { Card, GamePhase, PileConstraint } from '../../../shared/src/types.ts'

export interface ServerPlayerState {
  id: string
  name: string
  hand: Card[]
  faceUp: Card[]
  faceDown: Card[]
  isFinished: boolean
  hasSetFaceUp: boolean
}

export interface ServerGameState {
  players: ServerPlayerState[] // fixed turn order
  drawPile: Card[]
  discardPile: Card[]
  effectiveTop: Card | null // last non-3 card on pile; null if pile empty or burned
  constraint: PileConstraint
  currentPlayerIndex: number
  phase: GamePhase
  finishedPlayerIds: string[]
  loser?: string
}

export interface PlayResult {
  state: ServerGameState
  burned: boolean
  faceDownCard?: Card // revealed face-down card (if applicable)
  faceDownUnplayable?: boolean // true if face-down card couldn't be played
  playerFinished: boolean
  gameOver: boolean
}
