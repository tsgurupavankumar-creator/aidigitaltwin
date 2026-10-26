'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { PaperTexture } from '@/components/ui/PaperTexture';
import { Brain, Loader2, RotateCcw, Sparkles } from 'lucide-react';

interface DigitalTwinRecord {
  academicHealth: number;
  performanceScore: number;
  attendanceScore: number;
  engagementScore: number;
  knowledgeScore: number;
  learningVelocity: number;
  behaviorScore: number;
  skillsScore: number;
  lastSyncedAt: string;
}

interface FactorNode {
  label: string;
  value: number;
  icon: string;
  description: string;
  subFactors?: Array<{ name: string; score: number }>;
}

export default function DigitalTwinPage() {
  const [twin, setTwin] = useState<DigitalTwinRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTwin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student/twin');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load digital twin');
      setTwin(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load digital twin telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTwin();
  }, []);

  const health = twin ? Math.round(twin.academicHealth) : 0;

  const nodes: FactorNode[] = twin
    ? [
        {
          label: 'Academic',
          value: Math.round(twin.performanceScore),
          icon: '📚',
          description: 'Overall course evaluation & GPA trajectory',
          subFactors: [
            { name: 'Cumulative GPA Equivalent', score: Math.round(twin.performanceScore) },
            { name: 'Learning Velocity Index', score: Math.round(twin.learningVelocity * 100) },
          ],
        },
        {
          label: 'Attendance',
          value: Math.round(twin.attendanceScore),
          icon: '✅',
          description: 'Class check-ins & mandatory lecture attendance',
          subFactors: [
            { name: 'Lecture Attendance Rate', score: Math.round(twin.attendanceScore) },
          ],
        },
        {
          label: 'Knowledge',
          value: Math.round(twin.knowledgeScore),
          icon: '🧠',
          description: 'Concept mastery & quiz vector retention',
          subFactors: [
            { name: 'Curriculum Mastery Vector', score: Math.round(twin.knowledgeScore) },
          ],
        },
        {
          label: 'Engagement',
          value: Math.round(twin.engagementScore),
          icon: '🎯',
          description: 'LMS activity, assignment submissions & participation',
          subFactors: [
            { name: 'LMS Activity Factor', score: Math.round(twin.engagementScore) },
            { name: 'Behavior & Focus Index', score: Math.round(twin.behaviorScore || 75) },
          ],
        },
      ]
    : [];

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

      {loading ? (
        <div className="p-20 rounded-md bg-paper-2 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-terracotta" />
          <span className="font-mono text-xs uppercase tracking-wider">Syncing digital twin vectors...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchTwin}
            className="px-3 py-1.5 text-xs font-mono rounded bg-terracotta text-paper-0 hover:bg-[#B4512D] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : !twin ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <Brain className="w-10 h-10 text-ink-3 mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">Digital Twin Initializing</h3>
          <p className="text-xs text-ink-2">No vector telemetry recorded yet. Complete an assessment or attend a lecture to generate state.</p>
        </div>
      ) : (
        <>
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
                const radius = 140; // px
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nodes.map((node) => (
              <div key={node.label} className="p-5 rounded-md bg-paper-0 border border-paper-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-inter font-bold text-sm text-ink-0 flex items-center gap-2">
                    <span>{node.icon}</span>
                    <span>{node.label}</span>
                  </span>
                  <span className="font-space font-bold text-base text-terracotta">{node.value}%</span>
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">{node.description}</p>
                {node.subFactors && (
                  <div className="pt-2 border-t border-paper-3 space-y-1.5 text-xs font-mono">
                    {node.subFactors.map((sub) => (
                      <div key={sub.name} className="flex items-center justify-between text-ink-2">
                        <span className="truncate max-w-[150px]">{sub.name}</span>
                        <span className="font-semibold text-ink-0">{sub.score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
