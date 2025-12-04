'use client'

import { TrendingUp } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { DashboardStats } from '@/types/dashboard'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { motion } from 'framer-motion'

interface AssetValueChartProps {
  data: DashboardStats['assetValueByCategory'] | undefined
  isLoading: boolean
}

const chartColors = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#f43f5e', // Rose
  '#22c55e', // Emerald
  '#eab308', // Yellow
]

export function AssetValueChart({ data, isLoading }: AssetValueChartProps) {
  // Transform data for radar chart - show all categories
  const allCategories = data || []
  
  const chartData = allCategories.map((item, index) => ({
    category: item.name.length > 12 ? `${item.name.substring(0, 12)}...` : item.name,
    value: item.value,
    fullName: item.name,
    color: chartColors[index % chartColors.length],
  }))

  const chartConfig = {
    value: {
      label: 'Asset Value',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  const totalValue = allCategories.reduce((sum, item) => sum + item.value, 0)

  if (isLoading) {
    return (
      <Card className="flex flex-col h-[500px]">
        <CardHeader>
          <div className="h-6 w-1/2 bg-muted rounded mb-2" />
          <div className="h-4 w-1/3 bg-muted rounded" />
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="flex flex-col h-full min-h-[500px]">
        <CardHeader className="items-center pb-4">
          <CardTitle>Asset Value by Category</CardTitle>
          <CardDescription>
            Total asset value grouped by category
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-0 flex-1 flex flex-col">
          {chartData.length > 0 ? (
            <>
              <div className="flex-1 flex items-center justify-center min-h-[250px]">
                <ChartContainer
                  config={chartConfig}
                  className="w-full aspect-square max-h-[250px]"
                >
                  <RadarChart data={chartData}>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                      formatter={(value: number) => `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <PolarGrid gridType="circle" />
                    <PolarAngleAxis dataKey="category" />
                    <Radar
                      dataKey="value"
                      fill="var(--color-value)"
                      fillOpacity={0.6}
                      dot={{
                        r: 4,
                        fillOpacity: 1,
                      }}
                    />
                  </RadarChart>
                </ChartContainer>
              </div>
              
              {/* Custom Legend below chart */}
              <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 mt-4 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar border-t pt-4">
                {chartData.map((item) => (
                  <div key={item.fullName} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground truncate flex-1" title={item.fullName}>
                      {item.fullName}
                    </span>
                    <span className="font-medium tabular-nums text-xs">
                      ₱{item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
        {chartData.length > 0 && (
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 leading-none font-medium">
              {chartData.length} categories by value <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              Total: ₱{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  )
}
