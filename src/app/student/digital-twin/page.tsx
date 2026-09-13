'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { PaperTexture } from '@/components/ui/PaperTexture';
import { Brain, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DigitalTwinPage() {
  const nodes = useAppStore((s) => s.nodes);
  const health = useAppStore((s) => s.health);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-terracotta uppercase tracking-widest font-medium">
          01 / COGNITIVE VECTOR SPACE
        </span>
        <h1 className="font-fraunces italic font-normal text-4xl text-ink-0">
          Digital Twin State Visualization
        </h1>
        <p className="text-sm text-ink-2 font-inter">
          Real-time multidimensional representation of academic performance, attendance, concept mastery, and behavioral velocity.
        </p>
      </div>

      <HairlineRule />

      {/* Main Graph Visualization Canvas */}
      <PaperTexture className="p-8 rounded-md bg-paper-2 border border-paper-3 min-h-[420px] flex items-center justify-center relative">
        <div className="relative w-full max-w-2xl h-80 flex items-center justify-center">
          {/* Central Digital Twin Core Node */}
          <div className="w-36 h-36 rounded-full bg-paper-0 border-2 border-ink-0 flex flex-col items-center justify-center text-center p-3 shadow-sm z-10">
            <Brain className="w-8 h-8 text-terracotta mb-1" />
            <span className="font-fraunces font-bold text-sm text-ink-0">Student Twin</span>
            <span className="font-space font-bold text-lg text-terracotta">{health}%</span>
          </div>

          {/* Surrounding Factor Nodes */}
          {nodes.map((node, index) => {
            const total = nodes.length;
            const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
            const radius = 150; // px
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <div
                key={node.label}
                className="absolute flex flex-col items-center group transition-transform hover:scale-105"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                <div className="w-14 h-14 rounded-full bg-paper-0 border border-paper-3 flex items-center justify-center shadow-sm group-hover:border-terracotta transition-colors">
                  <span className="text-base">{node.icon}</span>
                </div>
                <div className="mt-1 text-center bg-paper-0 px-2 py-0.5 rounded border border-paper-3 text-xs font-mono font-semibold uppercase text-ink-0">
                  {node.label}: <span className="text-terracotta">{node.value}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </PaperTexture>

      {/* Factor Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div key={node.label} className="p-5 rounded-md bg-paper-0 border border-paper-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-inter font-bold text-sm text-ink-0 flex items-center gap-2">
                <span>{node.icon}</span>
                <span>{node.label} Factor</span>
              </span>
              <span className="font-space font-bold text-base text-terracotta">{node.value}%</span>
            </div>
            <p className="text-xs text-ink-2 leading-relaxed">{node.description}</p>
            {node.subFactors && (
              <div className="pt-2 border-t border-paper-3 space-y-1.5 text-xs font-mono">
                {node.subFactors.map((sub) => (
                  <div key={sub.name} className="flex items-center justify-between text-ink-2">
                    <span className="truncate max-w-[180px]">{sub.name}</span>
                    <span className="font-semibold text-ink-0">{sub.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
