import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { formatDateShort, parseISO } from '../lib/utils';
import type { TimeSpentDataPoint, CompletionRateDataPoint } from '../types';

// ── Shared tooltip styles ────────────────────────────────────────────────────

interface CustomTooltipBaseProps extends TooltipProps<number, string> {
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
  valueLabel?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  valueLabel = 'Value',
}: CustomTooltipBaseProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0].value as number;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="text-gray-500 dark:text-gray-400 mb-1">
        {labelFormatter ? labelFormatter(label as string) : label}
      </p>
      <p className="font-semibold text-gray-900 dark:text-white">
        {valueLabel}: {valueFormatter ? valueFormatter(raw) : raw}
      </p>
    </div>
  );
}

// ── Time Spent Bar Chart ──────────────────────────────────────────────────────

interface TimeSpentChartProps {
  data: TimeSpentDataPoint[] | undefined;
  isLoading?: boolean;
}

export function TimeSpentChart({ data, isLoading }: TimeSpentChartProps) {
  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-sm">No time data yet</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDateShort(parseISO(d.date)),
    hours: Math.round((d.total_seconds_spent / 3600) * 10) / 10,
    rawDate: d.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-700" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'currentColor' }}
          className="text-gray-500 dark:text-gray-400"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'currentColor' }}
          className="text-gray-500 dark:text-gray-400"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}h`}
        />
        <Tooltip
          content={
            <CustomTooltip
              valueLabel="Time spent"
              valueFormatter={(v) => `${v}h`}
            />
          }
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
        />
        <Bar dataKey="hours" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Completion Rate Line Chart ────────────────────────────────────────────────

interface CompletionRateChartProps {
  data: CompletionRateDataPoint[] | undefined;
  isLoading?: boolean;
}

export function CompletionRateChart({ data, isLoading }: CompletionRateChartProps) {
  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-sm">No completion data yet</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDateShort(parseISO(d.date)),
    rate: Math.round(d.completion_rate),
    completed: d.completed_count,
    total: d.total_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-700" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'currentColor' }}
          className="text-gray-500 dark:text-gray-400"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'currentColor' }}
          className="text-gray-500 dark:text-gray-400"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          content={
            <CustomTooltip
              valueLabel="Completion"
              valueFormatter={(v) => `${v}%`}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#6366F1"
          strokeWidth={2.5}
          dot={{ fill: '#6366F1', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: '#6366F1' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
