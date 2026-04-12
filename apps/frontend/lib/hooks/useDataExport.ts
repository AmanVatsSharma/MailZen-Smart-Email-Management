'use client';

import { useLazyQuery } from '@apollo/client';
import type { DocumentNode } from '@apollo/client';

export function useDataExport(
  queryDoc: DocumentNode,
  filename: string,
  variables?: Record<string, unknown>,
) {
  const [runExport, { loading }] = useLazyQuery(queryDoc, {
    variables,
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      const exportKey = Object.keys(data).find((k) => k.toLowerCase().includes('export'));
      if (!exportKey) return;
      const payload = data[exportKey] as { dataJson: string; generatedAtIso: string } | null;
      if (!payload?.dataJson) return;
      const blob = new Blob([payload.dataJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return { runExport, loading };
}
