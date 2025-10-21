export const PIPELINE_CONFIG = {
  regions: 'us,us2,eu',
  propsConcurrency: 4,
  sports: ['NFL', 'NBA', 'MLB', 'NCAAF'] as const
}

export type SupportedSport = typeof PIPELINE_CONFIG.sports[number]
