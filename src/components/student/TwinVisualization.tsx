'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sliders,
  Sparkles,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  X,
  CheckCircle2,
  TrendingUp,
  Play,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { TwinNode } from '@/lib/types';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export function TwinVisualization() {
  const store = useAppStore();
  const nodes: TwinNode[] = store.nodes || [
    { label: 'Academic', value: 84, icon: '📚', status: 'Good', description: 'Overall course evaluation & GPA trajectory' },
    { label: 'Attendance', value: 87, icon: '✅', status: 'Good', description: 'Class check-ins & lab sessions' },
    { label: 'Knowledge', value: 71, icon: '🧠', status: 'Medium', description: 'Concept mastery & quiz vector retention' },
    { label: 'Engagement', value: 76, icon: '🎯', status: 'Medium', description: 'LMS activity, forum posts & peer collaboration' },
    { label: 'Behaviour', value: 82, icon: '📊', status: 'Good', description: 'Submission timeliness & consistency' },
    { label: 'Skills', value: 79, icon: '💡', status: 'Good', description: 'Practical coding & problem solving capabilities' },
  ];

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>('Knowledge');
  const [viewMode, setViewMode] = useState<'ORBITAL' | 'MATRIX'>('ORBITAL');
  const [isRotating, setIsRotating] = useState(true);
  const [neuralPulseActive, setNeuralPulseActive] = useState(false);
  const [simulatedBoosts, setSimulatedBoosts] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const center = { x: 300, y: 300 };
  const radius = 180;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute effective node values including simulations
  const effectiveNodes = nodes.map((node) => {
    const boost = simulatedBoosts[node.label] || 0;
    return {
      ...node,
      effectiveValue: Math.min(100, Math.max(0, node.value + boost)),
    };
  });

  // Calculate dynamic center health
  const calculatedCenterHealth = Math.round(
    effectiveNodes.reduce((acc, n) => acc + n.effectiveValue, 0) / effectiveNodes.length
  );

  const selectedNode = effectiveNodes.find((n) => n.label === selectedNodeLabel);

  const triggerCenterPulse = () => {
    setNeuralPulseActive(true);
    showToast('Neural pulse emitted across all 6 cognitive vectors');
    setTimeout(() => setNeuralPulseActive(false), 1200);
  };

  const handleSimulateChange = (label: string, delta: number) => {
    setSimulatedBoosts((prev) => ({
      ...prev,
      [label]: delta,
    }));
  };

  const handleApplyIntervention = (label: string) => {
    const boost = simulatedBoosts[label] || 0;
    if (boost !== 0) {
      const current = nodes.find((n) => n.label === label)?.value || 70;
      store.updateNodeValue(label, Math.min(100, current + boost));
      setSimulatedBoosts((prev) => ({ ...prev, [label]: 0 }));
      showToast(`Applied intervention to ${label} vector!`);
    }
  };

  const handleResetSimulations = () => {
    setSimulatedBoosts({});
    store.resetNodes();
    showToast('Reset all vectors to baseline telemetry');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full min-h-[580px] flex flex-col items-center justify-between bg-[#111722] rounded-2xl border border-white/5 overflow-hidden p-6 shadow-xl"
    >
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-lg"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-300" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Interactive View Mode Toggles */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-20">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-slate-200">Interactive Twin Knowledge Graph</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 font-medium">
              Multi-Vector Engine
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Click any vector to simulate interventions &amp; inspect sub-factor weights
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('ORBITAL')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                viewMode === 'ORBITAL'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-white'
              )}
            >
              Orbital Graph
            </button>
            <button
              onClick={() => setViewMode('MATRIX')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                viewMode === 'MATRIX'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-white'
              )}
            >
              Balance Matrix
            </button>
          </div>

          {/* Animation rotation toggle */}
          {viewMode === 'ORBITAL' && (
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/5 transition-colors"
              title={isRotating ? 'Pause orbit animation' : 'Resume orbit animation'}
            >
              {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={triggerCenterPulse}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-semibold transition-colors"
            title="Emit neural pulse wave"
          >
            <Zap className="w-3 h-3" />
            <span>Neural Pulse</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full flex-1 flex items-center justify-center my-2">
        {viewMode === 'ORBITAL' ? (
          <div className="relative w-full max-w-[600px] h-[480px] flex items-center justify-center">
            {/* SVG Graph */}
            <svg className="w-full h-full" viewBox="0 0 600 600">
              {/* Outer concentric lines */}
              <motion.circle
                cx={center.x}
                cy={center.y}
                r={radius + 20}
                fill="none"
                stroke="rgba(124, 58, 237, 0.15)"
                strokeWidth="1"
                strokeDasharray="4 4"
                animate={isRotating ? { rotate: 360 } : {}}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '300px', originY: '300px' }}
              />

              <motion.circle
                cx={center.x}
                cy={center.y}
                r={radius - 40}
                fill="none"
                stroke="rgba(6, 182, 212, 0.12)"
                strokeWidth="1"
                strokeDasharray="6 6"
                animate={isRotating ? { rotate: -360 } : {}}
                transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '300px', originY: '300px' }}
              />

              {/* Dynamic Neural Pulse Ring */}
              {neuralPulseActive && (
                <motion.circle
                  cx={center.x}
                  cy={center.y}
                  r="50"
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="3"
                  initial={{ r: 50, opacity: 1 }}
                  animate={{ r: 240, opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
              )}

              {/* Connection lines from center to nodes */}
              {effectiveNodes.map((node, index) => {
                const angle = (index / effectiveNodes.length) * 2 * Math.PI - Math.PI / 2;
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                const isSelected = selectedNodeLabel === node.label;
                const isHovered = hoveredNode === node.label;

                return (
                  <motion.line
                    key={`line-${index}`}
                    x1={center.x}
                    y1={center.y}
                    x2={x}
                    y2={y}
                    stroke={
                      isSelected
                        ? 'rgba(6, 182, 212, 0.9)'
                        : isHovered
                        ? 'rgba(124, 58, 237, 0.7)'
                        : 'rgba(255,255,255,0.08)'
                    }
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                    strokeDasharray={isSelected ? 'none' : '2 2'}
                  />
                );
              })}

              {/* Center node: Digital Twin Core (Clickable!) */}
              <motion.g
                onClick={triggerCenterPulse}
                className="cursor-pointer group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
              >
                <circle
                  cx={center.x}
                  cy={center.y}
                  r="54"
                  fill="url(#centerGradient)"
                  className="shadow-2xl filter drop-shadow-lg"
                />
                <circle
                  cx={center.x}
                  cy={center.y}
                  r="54"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <text
                  x={center.x}
                  y={center.y - 7}
                  textAnchor="middle"
                  fill="white"
                  fontSize="13"
                  fontWeight="bold"
                >
                  Digital Twin
                </text>
                <text
                  x={center.x}
                  y={center.y + 16}
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="17"
                  fontWeight="bold"
                >
                  {calculatedCenterHealth}%
                </text>
                <text
                  x={center.x}
                  y={center.y + 30}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="8"
                  letterSpacing="1"
                >
                  CLICK TO PULSE
                </text>

                <defs>
                  <radialGradient id="centerGradient">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </radialGradient>
                </defs>
              </motion.g>

              {/* Outer nodes (Clickable!) */}
              {effectiveNodes.map((node, index) => {
                const angle = (index / effectiveNodes.length) * 2 * Math.PI - Math.PI / 2;
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                const isSelected = selectedNodeLabel === node.label;
                const isHovered = hoveredNode === node.label;

                return (
                  <motion.g
                    key={`node-${index}`}
                    onClick={() => setSelectedNodeLabel(node.label)}
                    onMouseEnter={() => setHoveredNode(node.label)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 42 : isHovered ? 38 : 34}
                      fill="#0D111A"
                      stroke={
                        isSelected
                          ? '#06B6D4'
                          : isHovered
                          ? '#7C3AED'
                          : 'rgba(255,255,255,0.12)'
                      }
                      strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1}
                      className="transition-all duration-300"
                    />
                    <text x={x} y={y - 6} textAnchor="middle" fill="white" fontSize="18">
                      {node.icon}
                    </text>
                    <text
                      x={x}
                      y={y + 13}
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="9"
                      fontWeight="600"
                    >
                      {node.label}
                    </text>
                    <text
                      x={x}
                      y={y + 26}
                      textAnchor="middle"
                      fill={
                        node.effectiveValue > 75
                          ? '#10B981'
                          : node.effectiveValue > 65
                          ? '#F59E0B'
                          : '#EF4444'
                      }
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {node.effectiveValue}%
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          </div>
        ) : (
          /* Balance Matrix View */
          <div className="w-full max-w-2xl p-4 space-y-4">
            <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
              <span>Cognitive Vector Balance &amp; Benchmark Alignment</span>
              <span className="text-white font-medium">Target Benchmark: 80%</span>
            </div>

            <div className="space-y-3">
              {effectiveNodes.map((node) => {
                const isSelected = selectedNodeLabel === node.label;
                return (
                  <div
                    key={node.label}
                    onClick={() => setSelectedNodeLabel(node.label)}
                    className={cn(
                      'p-3 rounded-xl border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-white/[0.06] border-primary/50'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span>{node.icon}</span>
                        <span className="font-semibold text-slate-200">{node.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">{node.description}</span>
                        <span
                          className={cn(
                            'font-bold',
                            node.effectiveValue >= 80
                              ? 'text-emerald-400'
                              : node.effectiveValue >= 70
                              ? 'text-amber-400'
                              : 'text-red-400'
                          )}
                        >
                          {node.effectiveValue}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${node.effectiveValue}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Vector Deep-Dive & Simulation Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="w-full mt-2 p-4 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl p-1.5 rounded-lg bg-white/5">{selectedNode.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{selectedNode.label} Cognitive Vector</span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.2 rounded-full font-semibold',
                        selectedNode.effectiveValue > 75
                          ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                          : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                      )}
                    >
                      {selectedNode.status} Status
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{selectedNode.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rating:</span>
                <span className="text-lg font-bold text-white">{selectedNode.effectiveValue}%</span>
              </div>
            </div>

            {/* Sub-factors breakdown */}
            {selectedNode.subFactors && selectedNode.subFactors.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedNode.subFactors.map((sub) => (
                  <div key={sub.name} className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="truncate">{sub.name}</span>
                      <span className="text-slate-200 font-semibold">{sub.score}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${sub.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* What-if Intervention Slider */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
              <div className="flex-1 flex items-center gap-3">
                <Sliders className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground whitespace-nowrap">Simulate Boost:</span>
                <input
                  type="range"
                  min="-10"
                  max="15"
                  step="1"
                  value={simulatedBoosts[selectedNode.label] || 0}
                  onChange={(e) => handleSimulateChange(selectedNode.label, Number(e.target.value))}
                  className="w-full max-w-xs accent-primary cursor-pointer"
                />
                <span className="font-semibold text-cyan-400 min-w-[48px]">
                  {(simulatedBoosts[selectedNode.label] || 0) > 0 ? '+' : ''}
                  {simulatedBoosts[selectedNode.label] || 0}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApplyIntervention(selectedNode.label)}
                  disabled={!simulatedBoosts[selectedNode.label]}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-colors disabled:opacity-40"
                >
                  Apply Intervention
                </button>
                <button
                  onClick={handleResetSimulations}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
