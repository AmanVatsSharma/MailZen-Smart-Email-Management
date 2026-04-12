'use client';

import { useTheme } from 'next-themes';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface StorageChartProps {
  usedMb?: number;
  totalMb?: number;
}

export function StorageChart({ usedMb, totalMb }: StorageChartProps) {
  const { theme } = useTheme();

  const used = usedMb ?? 4300;
  const total = totalMb ?? 15360;
  const remaining = Math.max(total - used, 0);

  const data = [
    { name: 'Used', value: used, color: 'hsl(var(--primary))' },
    { name: 'Free', value: remaining, color: 'hsl(var(--muted))' },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
            borderRadius: '8px',
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
          }}
          itemStyle={{ color: 'inherit' }}
          formatter={(value: number | undefined) => [`${((value ?? 0) / 1024).toFixed(1)} GB`, ''] as [string, string]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
