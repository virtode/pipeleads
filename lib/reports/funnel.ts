export interface ConversionStep {
  stageId: string
  stageName: string
  stageColor: string
  count: number
  rate: number
  isLost: boolean
  isReferral: boolean
  isWon: boolean
}

interface StageRow {
  id: string
  name: string
  color: string
  is_lost: boolean
  is_referral: boolean
  is_won: boolean
}

export function buildFunnelSteps(
  stages: StageRow[],
  stageCounts: Map<string, number>,
  totalInPipeline: number,
): ConversionStep[] {
  const normalStages   = stages.filter((s) => !s.is_lost && !s.is_referral && !s.is_won)
  const lostStages     = stages.filter((s) => s.is_lost)
  const referralStages = stages.filter((s) => s.is_referral)
  const wonStages      = stages.filter((s) => s.is_won)

  const referralContactCount = referralStages.reduce(
    (sum, s) => sum + (stageCounts.get(s.id) ?? 0), 0
  )
  const wonContactCount = wonStages.reduce(
    (sum, s) => sum + (stageCounts.get(s.id) ?? 0), 0
  )
  const effectiveTotal = totalInPipeline - referralContactCount - wonContactCount

  const normalCounts: number[] = normalStages.map((_, i) =>
    normalStages.slice(i).reduce((sum, s) => sum + (stageCounts.get(s.id) ?? 0), 0)
  )

  const normalSteps: ConversionStep[] = normalStages.map((stage, i) => ({
    stageId: stage.id,
    stageName: stage.name,
    stageColor: stage.color,
    count: i === 0 ? effectiveTotal : normalCounts[i],
    rate: effectiveTotal > 0 ? (i === 0 ? 100 : Math.round((normalCounts[i] / effectiveTotal) * 100)) : 0,
    isLost: false,
    isReferral: false,
    isWon: false,
  }))

  const lostSteps: ConversionStep[] = lostStages.map((stage) => {
    const count = stageCounts.get(stage.id) ?? 0
    return {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      count,
      rate: effectiveTotal > 0 ? Math.round((count / effectiveTotal) * 100) : 0,
      isLost: true,
      isReferral: false,
      isWon: false,
    }
  })

  const referralSteps: ConversionStep[] = referralStages.map((stage) => {
    const count = stageCounts.get(stage.id) ?? 0
    return {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      count,
      rate: totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 100) : 0,
      isLost: false,
      isReferral: true,
      isWon: false,
    }
  })

  const wonSteps: ConversionStep[] = wonStages.map((stage) => {
    const count = stageCounts.get(stage.id) ?? 0
    return {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      count,
      rate: totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 100) : 0,
      isLost: false,
      isReferral: false,
      isWon: true,
    }
  })

  return [...normalSteps, ...lostSteps, ...referralSteps, ...wonSteps]
}
