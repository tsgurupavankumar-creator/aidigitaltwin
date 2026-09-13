AI Academic Digital Twin - Frontend Implementation
md
# AI Academic Digital Twin
## Complete Frontend Implementation Guide

---

## 📋 PROJECT SETUP

### Initialize Project
```bash
npx create-next-app@latest academic-digital-twin --typescript --tailwind --app
cd academic-digital-twin
npm install framer-motion recharts zustand lucide-react clsx tailwind-merge
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu
Folder Structure
text
src/
├── app/
│   ├── student/
│   │   ├── page.tsx
│   │   ├── digital-twin/
│   │   ├── performance/
│   │   ├── knowledge-gaps/
│   │   ├── study-plan/
│   │   ├── recommendations/
│   │   └── alerts/
│   ├── faculty/
│   │   ├── page.tsx
│   │   ├── students/
│   │   ├── at-risk/
│   │   ├── knowledge-gaps/
│   │   └── interventions/
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── student/
│   │   ├── DigitalTwinCard.tsx
│   │   ├── TwinVisualization.tsx
│   │   ├── PerformanceForecast.tsx
│   │   ├── KnowledgeGaps.tsx
│   │   ├── StudyPlan.tsx
│   │   ├── Recommendations.tsx
│   │   ├── AgentActivity.tsx
│   │   └── EarlyWarnings.tsx
│   ├── faculty/
│   │   ├── ClassHealth.tsx
│   │   ├── StudentTable.tsx
│   │   ├── KnowledgeHeatmap.tsx
│   │   └── InterventionQueue.tsx
│   └── ui/
│       ├── MetricCard.tsx
│       ├── StatusBadge.tsx
│       └── AnimatedNumber.tsx
├── lib/
│   └── types.ts
└── data/
    └── mockData.ts
🎨 GLOBAL STYLES
app/globals.css
css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 3%;
    --foreground: 0 0% 98%;
    --card: 0 0% 7%;
    --card-foreground: 0 0% 98%;
    --primary: 262 83% 58%;
    --primary-foreground: 0 0% 100%;
    --secondary: 189 94% 43%;
    --secondary-foreground: 0 0% 100%;
    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 65%;
    --border: 0 0% 15%;
    --radius: 0.75rem;
  }
}

.glass {
  background: rgba(17, 23, 34, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.gradient-text {
  @apply bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent;
}

.card-hover {
  @apply transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10;
}
📦 TYPES
lib/types.ts
typescript
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AgentStatus = 'ACTIVE' | 'WAITING' | 'PROCESSING' | 'COMPLETED';

export interface Student {
  id: string;
  name: string;
  academicHealth: number;
  riskLevel: RiskLevel;
  attendance: number;
  engagement: number;
  learningVelocity: number;
  gpa: number;
  predictedGpa: number;
}

export interface KnowledgeGap {
  id: string;
  concept: string;
  mastery: number;
  previousMastery: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface StudyTask {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate: string;
  completed: boolean;
  estimatedTime: number;
}

export interface Alert {
  id: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
  dismissed: boolean;
}

export interface Agent {
  id: string;
  name: string;
  icon: string;
  status: AgentStatus;
  currentTask: string;
  lastRun: string;
  priority: number;
}

export interface Recommendation {
  id: string;
  agentId: string;
  title: string;
  description: string;
  action: string;
  confidence: number;
}
🎯 MAIN COMPONENTS
components/layout/Sidebar.tsx
tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Sparkles,
  Users,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const studentItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/student' },
  { icon: Brain, label: 'Digital Twin', href: '/student/digital-twin' },
  { icon: TrendingUp, label: 'Performance', href: '/student/performance' },
  { icon: AlertTriangle, label: 'Knowledge Gaps', href: '/student/knowledge-gaps' },
  { icon: BookOpen, label: 'Study Plan', href: '/student/study-plan' },
  { icon: Sparkles, label: 'AI Recommendations', href: '/student/recommendations' },
];

const facultyItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/faculty' },
  { icon: Users, label: 'Class Intelligence', href: '/faculty/students' },
  { icon: AlertTriangle, label: 'At-Risk Students', href: '/faculty/at-risk' },
  { icon: Brain, label: 'Knowledge Gaps', href: '/faculty/knowledge-gaps' },
  { icon: BarChart3, label: 'Interventions', href: '/faculty/interventions' },
];

export function Sidebar() {
  const pathname = usePathname();
  const isStudent = pathname.startsWith('/student');
  const items = isStudent ? studentItems : facultyItems;

  return (
    <aside className="w-[280px] h-screen bg-[#0D111A] border-r border-white/5 flex flex-col">
      <div className="p-4 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
          <span className="text-white font-bold text-xs">AI</span>
        </div>
        <div>
          <span className="font-semibold text-sm">Academic Twin</span>
          <span className="text-[10px] text-muted-foreground block">Intelligence</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  'hover:bg-white/5 cursor-pointer relative',
                  isActive && 'bg-primary/10 text-primary'
                )}
                whileHover={{ x: 4 }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
components/layout/Topbar.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { Bell, User, Circle } from 'lucide-react';

interface TopbarProps {
  title: string;
  description: string;
}

export function Topbar({ title, description }: TopbarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-[#07090F]/80 backdrop-blur-sm"
    >
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-1.5 text-xs text-emerald-400"
        >
          <Circle className="w-2 h-2 fill-emerald-400" />
          <span>AI Operational</span>
        </motion.div>
        <button className="p-2 hover:bg-white/5 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-destructive" />
        </button>
        <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <User className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </motion.header>
  );
}
components/ui/AnimatedNumber.tsx
tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, className, duration = 1000 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (current: number) => {
      const elapsed = current - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}
🎯 STUDENT DASHBOARD COMPONENTS
components/student/DigitalTwinCard.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { cn } from '@/lib/utils';

interface DigitalTwinCardProps {
  health: number;
  status: string;
  trend: number;
  metrics: { label: string; value: number; change: number }[];
}

export function DigitalTwinCard({ health, status, trend, metrics }: DigitalTwinCardProps) {
  const statusColors = {
    GOOD: 'text-emerald-400',
    MEDIUM: 'text-amber-400',
    CRITICAL: 'text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Your Academic Digital Twin</h3>
            <div className="flex items-end gap-4 mt-2">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none" />
                  <motion.circle
                    cx="48" cy="48" r="40"
                    stroke="url(#healthGradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: 251.2, strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (health / 100) * 251.2 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <AnimatedNumber value={health} className="text-2xl font-bold" />
                    <span className="text-[10px] text-muted-foreground block">Health</span>
                  </div>
                </div>
              </div>
              <div>
                <div className={cn('text-sm font-medium', statusColors[status as keyof typeof statusColors])}>
                  {status}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {trend > 0 ? '+' : ''}{trend} points vs last month
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-3 rounded-xl bg-white/5"
            >
              <div className="text-2xl font-bold">{metric.value}%</div>
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className={cn('text-xs mt-1', metric.change > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {metric.change > 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
components/student/TwinVisualization.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export function TwinVisualization() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodes = [
    { label: 'Academic', value: 84, icon: '📚', status: 'Good' },
    { label: 'Attendance', value: 87, icon: '✅', status: 'Good' },
    { label: 'Knowledge', value: 71, icon: '🧠', status: 'Medium' },
    { label: 'Engagement', value: 76, icon: '🎯', status: 'Medium' },
    { label: 'Behaviour', value: 82, icon: '📊', status: 'Good' },
    { label: 'Skills', value: 79, icon: '💡', status: 'Good' },
  ];

  const center = { x: 300, y: 300 };
  const radius = 180;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-[600px] flex items-center justify-center"
    >
      <svg className="w-full h-full" viewBox="0 0 600 600">
        {/* Animated background lines */}
        <motion.circle
          cx={center.x} cy={center.y}
          r={radius + 20}
          fill="none"
          stroke="rgba(124, 58, 237, 0.05)"
          strokeWidth="1"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />

        {/* Connection lines */}
        {nodes.map((node, index) => {
          const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2;
          const x = center.x + radius * Math.cos(angle);
          const y = center.y + radius * Math.sin(angle);

          return (
            <motion.line
              key={`line-${index}`}
              x1={center.x} y1={center.y}
              x2={x} y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: index * 0.1 }}
            />
          );
        })}

        {/* Center node */}
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <circle cx={center.x} cy={center.y} r="50" fill="url(#centerGradient)" />
          <text x={center.x} y={center.y - 6} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">Student</text>
          <text x={center.x} y={center.y + 16} textAnchor="middle" fill="#94A3B8" fontSize="16" fontWeight="bold">82</text>
          <defs>
            <radialGradient id="centerGradient">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#06B6D4" />
            </radialGradient>
          </defs>
        </motion.g>

        {/* Outer nodes */}
        {nodes.map((node, index) => {
          const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2;
          const x = center.x + radius * Math.cos(angle);
          const y = center.y + radius * Math.sin(angle);
          const isHovered = hoveredNode === node.label;

          return (
            <motion.g
              key={`node-${index}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onMouseEnter={() => setHoveredNode(node.label)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <circle
                cx={x} cy={y}
                r={isHovered ? 38 : 32}
                fill="rgba(17, 23, 34, 0.9)"
                stroke={isHovered ? '#7C3AED' : 'rgba(255,255,255,0.1)'}
                strokeWidth={isHovered ? 2 : 1}
              />
              <text x={x} y={y - 6} textAnchor="middle" fill="white" fontSize="20">{node.icon}</text>
              <text x={x} y={y + 16} textAnchor="middle" fill="#94A3B8" fontSize="10">{node.label}</text>
              <text
                x={x} y={y + 32}
                textAnchor="middle"
                fill={node.value > 75 ? '#10B981' : node.value > 65 ? '#F59E0B' : '#EF4444'}
                fontSize="12"
                fontWeight="bold"
              >
                {node.value}%
              </text>
            </motion.g>
          );
        })}
      </svg>
    </motion.div>
  );
}
components/student/PerformanceForecast.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Info } from 'lucide-react';
import { useState } from 'react';

export function PerformanceForecast() {
  const [showExplanation, setShowExplanation] = useState(false);

  const data = [
    { label: 'Quiz 1', current: 78, predicted: 80 },
    { label: 'Quiz 2', current: 72, predicted: 76 },
    { label: 'Quiz 3', current: 74, predicted: 78 },
    { label: 'Midterm', current: 76, predicted: 82 },
    { label: 'Final', current: 0, predicted: 84 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Performance Forecast</h3>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="p-1 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Info className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" stroke="#64748B" fontSize={10} />
            <YAxis stroke="#64748B" fontSize={10} domain={[40, 100]} />
            <Tooltip
              contentStyle={{
                background: '#0D111A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area type="monotone" dataKey="current" stroke="#7C3AED" strokeWidth={2} fill="url(#currentGradient)" />
            <Area type="monotone" dataKey="predicted" stroke="#06B6D4" strokeWidth={2} strokeDasharray="5 5" fill="url(#predictedGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div>
          <div className="text-xs text-muted-foreground">Predicted Final Score</div>
          <div className="text-2xl font-bold">84%</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">AI Confidence</div>
          <div className="text-sm font-medium text-emerald-400">89%</div>
        </div>
      </div>

      {showExplanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5"
        >
          <p className="text-sm text-muted-foreground">
            AI Insight: Your current learning pattern suggests a 6-8% improvement
            if your current trajectory continues. Focus on maintaining consistency
            in your study schedule.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
components/student/KnowledgeGaps.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function KnowledgeGaps() {
  const [expandedSubject, setExpandedSubject] = useState<string | null>('DBMS');

  const subjects = [
    {
      id: 'DBMS',
      name: 'Database Management Systems',
      topics: [
        { id: 'norm', name: 'Normalization', mastery: 42, previous: 61 },
        { id: 'trans', name: 'Transactions', mastery: 68, previous: 72 },
        { id: 'sql', name: 'SQL', mastery: 84, previous: 80 },
      ],
    },
    {
      id: 'OS',
      name: 'Operating Systems',
      topics: [
        { id: 'deadlock', name: 'Deadlocks', mastery: 51, previous: 58 },
        { id: 'memory', name: 'Memory Management', mastery: 79, previous: 74 },
      ],
    },
    {
      id: 'CN',
      name: 'Computer Networks',
      topics: [
        { id: 'routing', name: 'Routing', mastery: 63, previous: 67 },
        { id: 'tcp', name: 'TCP/IP', mastery: 88, previous: 82 },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Knowledge Gaps</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Critical (3)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Needs Attention (5)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Mastered (12)
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {subjects.map((subject) => (
          <div key={subject.id} className="border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSubject(expandedSubject === subject.id ? null : subject.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-medium">{subject.name}</span>
              {expandedSubject === subject.id ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {expandedSubject === subject.id && (
              <div className="p-3 pt-0 space-y-3">
                {subject.topics.map((topic) => (
                  <div key={topic.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{topic.name}</span>
                      <span className={`text-xs font-medium ${topic.mastery < 50 ? 'text-red-400' : topic.mastery < 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {topic.mastery}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${topic.mastery}%`,
                          background: `linear-gradient(90deg, ${topic.mastery < 50 ? '#EF4444' : topic.mastery < 70 ? '#F59E0B' : '#10B981'}, ${topic.mastery < 50 ? '#EF4444AA' : topic.mastery < 70 ? '#F59E0BAA' : '#10B981AA'})`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Previous: {topic.previous}%</span>
                      <span>{topic.mastery - topic.previous > 0 ? '↑' : '↓'} {Math.abs(topic.mastery - topic.previous)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
components/student/StudyPlan.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Clock, CheckCircle, Circle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudyPlan() {
  const [tasks, setTasks] = useState([
    {
      id: '1',
      title: 'DBMS Normalization',
      description: 'Review functional dependencies and normalization examples',
      priority: 'HIGH',
      dueDate: '09:00 - 09:40',
      completed: false,
      time: 40,
    },
    {
      id: '2',
      title: 'OS Deadlocks',
      description: 'Practice deadlock detection and prevention algorithms',
      priority: 'MEDIUM',
      dueDate: '11:00 - 11:30',
      completed: false,
      time: 30,
    },
    {
      id: '3',
      title: 'Personalized DBMS Quiz',
      description: 'AI-generated quiz on weak topics',
      priority: 'HIGH',
      dueDate: '18:00 - 18:30',
      completed: false,
      time: 30,
    },
  ]);

  const completedCount = tasks.filter(t => t.completed).length;

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Today's AI Study Plan</h3>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{completedCount}</span> / {tasks.length} completed
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
              task.completed
                ? 'border-white/5 bg-white/5 opacity-60'
                : 'border-white/10 hover:border-primary/20'
            )}
          >
            <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
              {task.completed ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', task.completed && 'line-through text-muted-foreground')}>
                  {task.title}
                </span>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  task.priority === 'HIGH' ? 'bg-red-400/10 text-red-400' :
                  task.priority === 'MEDIUM' ? 'bg-amber-400/10 text-amber-400' :
                  'bg-emerald-400/10 text-emerald-400'
                )}>
                  {task.priority}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{task.description}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {task.dueDate}
                </span>
                <span>{task.time} min</span>
              </div>
            </div>

            <button className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Play className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Today's Progress</span>
          <span className="font-medium">{completedCount} / {tasks.length} completed</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / tasks.length) * 100}%` }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
          />
        </div>
      </div>
    </motion.div>
  );
}
components/student/AgentActivity.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { Circle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AgentActivity() {
  const agents = [
    { id: 'learning', name: 'Learning Analysis Agent', icon: '🧠', status: 'ACTIVE', task: 'Analyzing knowledge gaps', lastRun: '2 min ago' },
    { id: 'attendance', name: 'Attendance Agent', icon: '📊', status: 'ACTIVE', task: 'Monitoring attendance', lastRun: '5 min ago' },
    { id: 'assignment', name: 'Assignment Agent', icon: '📝', status: 'PROCESSING', task: 'Checking deadlines', lastRun: '10 min ago' },
    { id: 'quiz', name: 'Quiz Generator Agent', icon: '📋', status: 'WAITING', task: 'Waiting for trigger', lastRun: '1 hour ago' },
    { id: 'time', name: 'Time Management Agent', icon: '⏰', status: 'ACTIVE', task: 'Optimizing schedule', lastRun: '8 min ago' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-emerald-400';
      case 'PROCESSING': return 'text-amber-400';
      case 'WAITING': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <h3 className="text-sm font-medium mb-4">AI Agent Activity</h3>

      <div className="space-y-2">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
          >
            <span className="text-lg">{agent.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{agent.name}</span>
                <div className={cn('flex items-center gap-1 text-xs', getStatusColor(agent.status))}>
                  <Circle className={cn('w-2 h-2 fill-current', agent.status === 'ACTIVE' && 'animate-pulse')} />
                  <span>{agent.status}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground truncate">{agent.task}</div>
              <div className="text-[10px] text-muted-foreground/60">Last run: {agent.lastRun}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
components/student/EarlyWarnings.tsx
tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function EarlyWarnings() {
  const [alerts, setAlerts] = useState([
    { id: '1', type: 'WARNING', title: 'Attendance Risk', message: 'DBMS attendance has fallen to 72%. Impact: Medium', impact: 'MEDIUM', time: '2 hours ago', dismissed: false },
    { id: '2', type: 'WARNING', title: 'Knowledge Gap Detected', message: 'Your DBMS Normalization performance has declined for 2 consecutive assessments.', impact: 'HIGH', time: '4 hours ago', dismissed: false },
    { id: '3', type: 'CRITICAL', title: 'Critical Academic Risk', message: 'Two assessments indicate a significant decline in performance.', impact: 'HIGH', time: '1 day ago', dismissed: false },
  ]);

  const dismissAlert = (id: string) => {
    setAlerts(alerts.map(alert => alert.id === id ? { ...alert, dismissed: true } : alert));
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'CRITICAL': return { icon: AlertCircle, bg: 'bg-red-400/10 border-red-400/20', color: 'text-red-400' };
      case 'WARNING': return { icon: AlertTriangle, bg: 'bg-amber-400/10 border-amber-400/20', color: 'text-amber-400' };
      default: return { icon: Info, bg: 'bg-primary/10 border-primary/20', color: 'text-primary' };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Early Warning System</h3>
        {activeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 font-medium">
            {activeAlerts.length} active
          </span>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {alerts.map((alert) => (
            !alert.dismissed && (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ x: 4 }}
                className={cn('p-4 rounded-xl border transition-colors', getAlertStyles(alert.type).bg)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5', getAlertStyles(alert.type).color)}>
                    {alert.type === 'CRITICAL' ? <AlertCircle className="w-5 h-5" /> :
                     alert.type === 'WARNING' ? <AlertTriangle className="w-5 h-5" /> :
                     <Info className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{alert.title}</span>
                      {alert.impact === 'HIGH' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/20 text-red-400">High Impact</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground/60">{alert.time}</span>
                      <button className="text-xs text-primary hover:text-primary/80 transition-colors">View Analysis</button>
                    </div>
                  </div>
                  <button onClick={() => dismissAlert(alert.id)} className="p-1 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            )
          ))}
        </AnimatePresence>

        {activeAlerts.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm text-muted-foreground">No active alerts. Your Digital Twin is healthy.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
🎯 FACULTY DASHBOARD COMPONENTS
components/faculty/ClassHealth.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export function ClassHealth() {
  const stats = [
    { label: 'Total Students', value: 60, icon: '👥' },
    { label: 'Healthy', value: 42, icon: '✅', color: 'text-emerald-400' },
    { label: 'Needs Attention', value: 12, icon: '⚠️', color: 'text-amber-400' },
    { label: 'At Risk', value: 6, icon: '🔴', color: 'text-red-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <h3 className="text-sm font-medium mb-4">Class Health Overview</h3>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-4 rounded-xl bg-white/5"
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={cn('text-2xl font-bold', stat.color)}>
              <AnimatedNumber value={stat.value} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
components/faculty/StudentTable.tsx
tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudentTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');

  const students = [
    { id: 1, name: 'Aarav Sharma', health: 61, risk: 'HIGH', attendance: 68, performance: 54, gaps: 4, lastActivity: 'Today' },
    { id: 2, name: 'Priya Patel', health: 82, risk: 'MEDIUM', attendance: 78, performance: 72, gaps: 2, lastActivity: 'Today' },
    { id: 3, name: 'Rahul Singh', health: 91, risk: 'LOW', attendance: 92, performance: 88, gaps: 1, lastActivity: 'Yesterday' },
    { id: 4, name: 'Sneha Reddy', health: 45, risk: 'CRITICAL', attendance: 55, performance: 42, gaps: 6, lastActivity: '2 days ago' },
    { id: 5, name: 'Vikram Kumar', health: 76, risk: 'MEDIUM', attendance: 71, performance: 68, gaps: 3, lastActivity: 'Today' },
  ];

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = riskFilter === 'All' || s.risk === riskFilter;
    return matchesSearch && matchesFilter;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return 'text-red-400 bg-red-400/10';
      case 'HIGH': return 'text-amber-400 bg-amber-400/10';
      case 'MEDIUM': return 'text-amber-400/70 bg-amber-400/5';
      case 'LOW': return 'text-emerald-400 bg-emerald-400/10';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Student Roster</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 outline-none transition-colors w-48"
            />
          </div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 outline-none transition-colors"
          >
            <option value="All">All Risks</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-white/5">
              <th className="text-left py-3 px-3 font-medium">Student</th>
              <th className="text-left py-3 px-3 font-medium">Health</th>
              <th className="text-left py-3 px-3 font-medium">Risk</th>
              <th className="text-left py-3 px-3 font-medium">Attendance</th>
              <th className="text-left py-3 px-3 font-medium">Performance</th>
              <th className="text-left py-3 px-3 font-medium">Gaps</th>
              <th className="text-left py-3 px-3 font-medium">Activity</th>
              <th className="text-right py-3 px-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <motion.tr
                key={student.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-3 text-sm font-medium">{student.name}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${student.health}%`,
                          background: `linear-gradient(90deg, ${student.health < 50 ? '#EF4444' : student.health < 70 ? '#F59E0B' : '#10B981'}, ${student.health < 50 ? '#EF4444AA' : student.health < 70 ? '#F59E0BAA' : '#10B981AA'})`,
                        }}
                      />
                    </div>
                    <span className="text-xs">{student.health}%</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getRiskColor(student.risk))}>
                    {student.risk}
                  </span>
                </td>
                <td className="py-3 px-3 text-sm">{student.attendance}%</td>
                <td className="py-3 px-3 text-sm">{student.performance}%</td>
                <td className="py-3 px-3 text-sm">{student.gaps}</td>
                <td className="py-3 px-3 text-xs text-muted-foreground">{student.lastActivity}</td>
                <td className="py-3 px-3 text-right">
                  <button className="text-xs text-primary hover:text-primary/80 transition-colors">
                    View Twin →
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
🎯 MAIN PAGE IMPLEMENTATIONS
app/student/page.tsx
tsx
'use client';

import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { DigitalTwinCard } from '@/components/student/DigitalTwinCard';
import { TwinVisualization } from '@/components/student/TwinVisualization';
import { PerformanceForecast } from '@/components/student/PerformanceForecast';
import { KnowledgeGaps } from '@/components/student/KnowledgeGaps';
import { StudyPlan } from '@/components/student/StudyPlan';
import { AgentActivity } from '@/components/student/AgentActivity';
import { EarlyWarnings } from '@/components/student/EarlyWarnings';

export default function StudentDashboard() {
  return (
    <div className="flex h-screen bg-[#07090F]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <Topbar 
          title="Student Intelligence" 
          description="Your academic twin is continuously analyzing your learning state."
        />
        <main className="p-6 space-y-6">
          <DigitalTwinCard
            health={82}
            status="GOOD"
            trend={6}
            metrics={[
              { label: 'Performance', value: 84, change: 8 },
              { label: 'Attendance', value: 87, change: 3 },
              { label: 'Engagement', value: 76, change: -2 },
              { label: 'Learning Velocity', value: 81, change: 5 },
            ]}
          />

          <TwinVisualization />

          <div className="grid grid-cols-2 gap-6">
            <PerformanceForecast />
            <KnowledgeGaps />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <StudyPlan />
            <AgentActivity />
          </div>

          <EarlyWarnings />
        </main>
      </div>
    </div>
  );
}
app/faculty/page.tsx
tsx
'use client';

import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { ClassHealth } from '@/components/faculty/ClassHealth';
import { StudentTable } from '@/components/faculty/StudentTable';

export default function FacultyDashboard() {
  return (
    <div className="flex h-screen bg-[#07090F]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <Topbar 
          title="Class Intelligence" 
          description="AI-powered overview of your students."
        />
        <main className="p-6 space-y-6">
          <ClassHealth />
          <StudentTable />
        </main>
      </div>
    </div>
  );
}
