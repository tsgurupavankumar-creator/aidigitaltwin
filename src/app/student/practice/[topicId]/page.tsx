'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
type Tier = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type Data = { topic: { name: string }; masteryScores: Record<Tier, number>; attemptCountByTier: Record<Tier,number>; unlockedTiers: Tier[]; recommendation: Tier | null; blockers: {topicId:string;name:string;mastery:number}[]; isMastered: boolean };
const tiers: Tier[] = ['BEGINNER','INTERMEDIATE','ADVANCED'];
export default function PracticeTopicPage() {
  const { topicId } = useParams<{topicId:string}>(); const router = useRouter();
  const [data,setData]=useState<Data|null>(null);const [tier,setTier]=useState<Tier>('BEGINNER'); const [count,setCount]=useState(5); const [override,setOverride]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{fetch(`/api/student/practice/recommend?syllabusTopicId=${encodeURIComponent(topicId)}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setTier(d.recommendation || 'ADVANCED');}).catch(e=>setError(e.message));},[topicId]);
  const start=async()=>{setBusy(true);setError('');try{const r=await fetch('/api/student/practice/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({syllabusTopicId:topicId,targetDifficulty:tier,questionCount:count,overridePrerequisite:override,mode:'practice'})});const d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Could not start practice');router.push(`/student/quizzes/${d.quizId}`);}catch(e){setError(e instanceof Error?e.message:'Unable to start practice');setBusy(false);}};
  return <main className="max-w-4xl mx-auto space-y-6"><Link href="/student/courses" className="text-sm underline">← Courses</Link><h1 className="text-3xl font-semibold">{data?.topic.name || 'Topic practice'}</h1>
    {error&&<p role="alert" className="text-burgundy">{error}</p>}
    {!data&&!error&&<p>Loading mastery…</p>}
    {data&&<><p className="text-ink-2">{data.isMastered?'Topic mastered! Review when ready.':`Recommended level: ${data.recommendation}`}</p>
      <div className="grid grid-cols-3 gap-3">{tiers.map(t=><button key={t} disabled={!data.unlockedTiers.includes(t)} onClick={()=>setTier(t)} aria-pressed={tier===t} className={`rounded-lg border p-4 ${tier===t?'border-terracotta':'border-paper-3'} disabled:opacity-40`}>
        <strong className="block text-xs">{t}</strong><span className="text-xl">{Math.round(data.masteryScores[t]*100)}%</span><span className="block text-xs">{data.unlockedTiers.includes(t)?'Unlocked':'Locked'}</span>
        <span className="block text-xs">{data.attemptCountByTier[t]} questions attempted</span>
      </button>)}</div>
      {data.blockers.length>0&&<aside className="border border-amber-400 rounded p-3 space-y-2"><p className="font-semibold text-sm">Prerequisites below 50%</p>{data.blockers.map(b=><p key={b.topicId} className="text-sm"><Link className="underline" href={`/student/practice/${b.topicId}`}>{b.name}</Link> · {Math.round(b.mastery*100)}%</p>)}
        <label className="text-sm"><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/> Practice anyway and record my override</label></aside>}
      <div className="flex items-center gap-4"><label>Questions <select className="ml-2 border rounded px-3 py-2" value={count} onChange={e=>setCount(Number(e.target.value))}>{[5,10,15].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <button onClick={start} disabled={busy||(!override&&data.blockers.length>0)} className="bg-terracotta rounded px-5 py-3 text-white disabled:opacity-50">{busy?'Generating…':`Start ${tier.toLowerCase()} practice`}</button></div></>}
  </main>;
}
