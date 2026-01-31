'use client';

import { useTheme } from 'next-themes';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'Emails', value: 2.8, color: 'hsl(var(--primary))' },
  { name: 'Attachments', value: 1.2, color: 'hsl(var(--secondary))' },
  { name: 'Other', value: 0.2, color: 'hsl(var(--muted))' },
];

export function StorageChart() {
  const { theme } = useTheme();

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
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
