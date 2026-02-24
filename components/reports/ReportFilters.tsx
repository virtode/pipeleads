'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { usePipelines } from '@/hooks/usePipelines'
import type { ReportFilters } from '@/hooks/useReports'

const NO_PIPELINE = '__all__'

type Preset = '7d' | '30d' | '90d' | 'custom'

interface ReportFiltersProps {
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
}

function presetDates(preset: Preset): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (preset === '7d') start.setDate(start.getDate() - 6)
  else if (preset === '30d') start.setDate(start.getDate() - 29)
  else if (preset === '90d') start.setDate(start.getDate() - 89)
  return { start, end }
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function ReportFilters({ filters, onChange }: ReportFiltersProps) {
  const { data: pipelines } = usePipelines()
  const [preset, setPreset] = useState<Preset>('30d')
  const [customOpen, setCustomOpen] = useState(false)
  const [customStart, setCustomStart] = useState(toInputDate(filters.startDate))
  const [customEnd, setCustomEnd] = useState(toInputDate(filters.endDate))

  function handlePreset(value: Preset) {
    setPreset(value)
    if (value !== 'custom') {
      const { start, end } = presetDates(value)
      onChange({ ...filters, startDate: start, endDate: end })
    } else {
      setCustomOpen(true)
    }
  }

  function handlePipeline(value: string) {
    onChange({ ...filters, pipelineId: value === NO_PIPELINE ? null : value })
  }

  function applyCustom() {
    if (!customStart || !customEnd) return
    const start = new Date(customStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
    onChange({ ...filters, startDate: start, endDate: end })
    setCustomOpen(false)
  }

  const pipelineValue = filters.pipelineId ?? NO_PIPELINE

  const periodLabel = preset === 'custom'
    ? `${customStart} → ${customEnd}`
    : preset === '7d' ? '7 derniers jours'
    : preset === '30d' ? '30 derniers jours'
    : '90 derniers jours'

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Pipeline */}
      <div className="space-y-1">
        <Label className="text-xs">Pipeline</Label>
        <Select value={pipelineValue} onValueChange={handlePipeline}>
          <SelectTrigger className="h-8 w-48 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PIPELINE}>Tous les pipelines</SelectItem>
            {(pipelines ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Period presets */}
      <div className="space-y-1">
        <Label className="text-xs">Période</Label>
        <div className="flex items-center gap-1">
          {(['7d', '30d', '90d'] as Preset[]).map((p) => (
            <Button
              key={p}
              variant={preset === p ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => handlePreset(p)}
            >
              {p === '7d' ? '7j' : p === '30d' ? '30j' : '90j'}
            </Button>
          ))}

          {/* Custom date picker */}
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={preset === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-1 px-3 text-xs"
                onClick={() => handlePreset('custom')}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {preset === 'custom' ? periodLabel : 'Personnalisé'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3 p-3" align="start">
              <div className="space-y-1">
                <Label className="text-xs">Du</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-sm"
                  max={customEnd}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Au</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-sm"
                  min={customStart}
                />
              </div>
              <Button size="sm" className="w-full h-8" onClick={applyCustom}>
                Appliquer
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
