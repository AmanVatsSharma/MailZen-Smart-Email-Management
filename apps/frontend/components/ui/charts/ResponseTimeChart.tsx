'use client';

import { useTheme } from 'next-themes';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const data = [
  { name: 'Mon', value: 4.5 },
  { name: 'Tue', value: 3.8 },
  { name: 'Wed', value: 3.2 },
  { name: 'Thu', value: 2.9 },
  { name: 'Fri', value: 2.5 },
  { name: 'Sat', value: 3.1 },
  { name: 'Sun', value: 2.8 },
];

export function ResponseTimeChart() {
  const { theme } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}h`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
            borderRadius: '8px',
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4, fill: 'hsl(var(--primary))' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
