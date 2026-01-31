'use client';

import { useTheme } from 'next-themes';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const data = [
  { name: 'Mon', total: Math.floor(Math.random() * 50) + 10 },
  { name: 'Tue', total: Math.floor(Math.random() * 50) + 10 },
  { name: 'Wed', total: Math.floor(Math.random() * 50) + 10 },
  { name: 'Thu', total: Math.floor(Math.random() * 50) + 10 },
  { name: 'Fri', total: Math.floor(Math.random() * 50) + 10 },
  { name: 'Sat', total: Math.floor(Math.random() * 50) + 10 },
  { name: 'Sun', total: Math.floor(Math.random() * 50) + 10 },
];

export function OverviewChart() {
  const { theme } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
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
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip 
          cursor={{ fill: 'transparent' }}
          contentStyle={{ 
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
            borderRadius: '8px',
            color: theme === 'dark' ? '#f8fafc' : '#0f172a'
          }}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
