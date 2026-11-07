'use client';

import { useMemo, useState } from 'react';
import type { SyllabusParseResult } from './types';


export function ModuleTopicSelector({
  syllabus,
  topicIds,
  selectedTopicIds,
  onChange,
  isLoading,
}: {
  syllabus: SyllabusParseResult | null;
  topicIds: Record<string, string>;
  selectedTopicIds: string[];
  onChange: (topicIds: string[]) => void;
  isLoading: boolean;
}) {
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const modules = useMemo(
    () => (syllabus?.modules ?? []).map((module) => ({ module }))
      .sort((a, b) => a.module.orderIndex - b.module.orderIndex),
    [syllabus],
  );
  const selected = new Set(selectedTopicIds);

  if (isLoading) {
    return <p role="status" className="py-8 text-center text-sm text-ink-2">Loading syllabus topics…</p>;
  }
  if (!syllabus) {
    return <p className="rounded border border-paper-3 bg-paper-1 p-6 text-center text-sm text-ink-2">Upload a syllabus first</p>;
  }
  if (modules.length === 0) {
    return <p role="alert" className="rounded border border-burgundy/20 bg-burgundy/10 p-4 text-sm text-burgundy">No modules were found in this syllabus.</p>;
  }

  const toggleTopics = (ids: string[], checked: boolean) => {
    const next = new Set(selectedTopicIds);
    ids.forEach((id) => checked ? next.add(id) : next.delete(id));
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm">Filter topics <input aria-label="Filter topics" className="ml-3 rounded border border-paper-3 p-2" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {modules.map(({ module }) => {
        const topics = module.topics.map((topic, topicIndex) => ({ topic, topicIndex }))
          .sort((a, b) => a.topic.orderIndex - b.topic.orderIndex);
        const ids = topics.map(({ topic }) => topicIds[`${module.orderIndex}:${topic.orderIndex}`]).filter(Boolean);
        const selectedCount = ids.filter((id) => selected.has(id)).length;
        return (
          <fieldset key={`${module.orderIndex}-${module.name}`} className="rounded-md border border-paper-3 bg-paper-0 p-4">
            <legend className="sr-only">{module.name}</legend>
            <label className="flex cursor-pointer items-start gap-3 font-semibold text-ink-0">
              <input
                type="checkbox"
                checked={ids.length > 0 && selectedCount === ids.length}
                ref={(element) => {
                  if (element) element.indeterminate = selectedCount > 0 && selectedCount < ids.length;
                }}
                onChange={(event) => toggleTopics(ids, event.currentTarget.checked)}
                className="mt-0.5 accent-plum"
              />
              <span>
                {module.name}
                <span className="ml-2 font-mono text-[10px] font-normal text-ink-3">{selectedCount} of {topics.length} topics selected</span>
                {module.description && <span className="mt-1 block text-xs font-normal text-ink-2">{module.description}</span>}
              </span>
            </label>
            <button type="button" aria-expanded={!collapsed.includes(module.orderIndex)} onClick={() => setCollapsed((current) => current.includes(module.orderIndex) ? current.filter((id) => id !== module.orderIndex) : [...current, module.orderIndex])} className="ml-7 mt-2 text-xs underline">{collapsed.includes(module.orderIndex) ? 'Expand topics' : 'Collapse topics'}</button>
            {!collapsed.includes(module.orderIndex) && <div className="ml-7 mt-3 space-y-2 border-l border-paper-3 pl-4">
              {topics.map(({ topic, topicIndex }) => {
                const id = topicIds[`${module.orderIndex}:${topic.orderIndex}`];
                if (!id || !topic.name.toLowerCase().includes(search.toLowerCase())) return null;
                return (
                  <label key={`${topic.orderIndex}-${topic.name}`} className="flex cursor-pointer gap-2 text-sm text-ink-1">
                    <input type="checkbox" checked={selected.has(id)} onChange={(event) => toggleTopics([id], event.currentTarget.checked)} className="mt-1 accent-plum" />
                    <span>{topic.name}{topic.description && <span className="mt-0.5 block text-xs text-ink-3">{topic.description}</span>}</span>
                  </label>
                );
              })}
            </div>}
          </fieldset>
        );
      })}
      {/* TODO(Veda): search/filter, select-all, per-module collapse */}
    </div>
  );
}
