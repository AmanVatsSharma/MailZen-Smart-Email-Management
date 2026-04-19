/**
 * File:        apps/frontend/components/email/RichTextEditor.tsx
 * Module:      Email · Rich Text Editor
 * Purpose:     Thin Tiptap EditorContent wrapper that renders the contenteditable
 *              area for the EmailComposer. The editor instance is created and owned
 *              by EmailComposer (hoisted) so the toolbar and editor share one state.
 *
 * Exports:
 *   - RichTextEditor(props, ref)   — forwardRef component; renders EditorContent
 *                                    using the editor instance passed via props
 *   - RichTextEditorHandle          — ref type exposing focus(), getHTML(), setContent(html)
 *   - RichTextEditorProps           — component prop shape
 *
 * Depends on:
 *   - @tiptap/react                 — EditorContent, Editor type
 *   - @/lib/utils                   — cn() Tailwind class merger
 *
 * Side-effects:
 *   - none (pure client component; no I/O)
 *
 * Key invariants:
 *   - The editor instance is owned by the parent (EmailComposer) and passed in via
 *     the `editor` prop. This guarantees the toolbar's chain() calls and the visible
 *     contenteditable operate on the same ProseMirror instance — no dual-editor split.
 *   - setContent({ emitUpdate: false }) suppresses onUpdate so content injection
 *     from the parent doesn't re-fire onChange and cause cursor-jump loops.
 *   - This is a 'use client' component — Tiptap requires DOM APIs unavailable in SSR.
 *
 * Read order:
 *   1. RichTextEditorHandle — imperative ref API
 *   2. RichTextEditorProps  — component contract
 *   3. RichTextEditor       — main implementation
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */

'use client';

import React, {
  forwardRef,
  useImperativeHandle,
} from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';

// ── Public ref handle ─────────────────────────────────────────────────────────

export interface RichTextEditorHandle {
  /** Move browser focus into the editor. */
  focus(): void;
  /** Return the current editor content as an HTML string. */
  getHTML(): string;
  /** Replace editor content with the supplied HTML string without triggering onChange. */
  setContent(html: string): void;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  /**
   * The Tiptap editor instance created and owned by the parent component.
   * Passing the instance here (rather than creating one internally) guarantees
   * the toolbar's chain() calls and the visible EditorContent share one state.
   */
  editor: Editor | null;
  /** Initial / controlled HTML content — used only for the content-sync effect in parent. */
  content: string;
  /** Called with the updated HTML on every editor change (wired via onUpdate in parent). */
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ editor, className }, ref) {
    // ── Imperative handle ───────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      focus() {
        editor?.commands.focus();
      },
      getHTML() {
        return editor?.getHTML() ?? '';
      },
      setContent(html: string) {
        // emitUpdate: false — no feedback loop back through onChange
        editor?.commands.setContent(html, { emitUpdate: false });
      },
    }));

    return (
      <div className={cn('relative', className)}>
        <EditorContent editor={editor} />
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';
