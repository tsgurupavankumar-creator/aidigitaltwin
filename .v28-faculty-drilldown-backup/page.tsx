'use client';
import { useParams } from 'next/navigation';
import { useEffect,useState } from 'react';
import Link from 'next/link';
type Topic = {key:string;name:string;students:number;stuckStudents:number;advancingStudents:number;averageTimeMinutes:number;tierCounts:Record<string,number>};
export default function FacultyTopicMasteryPage(){
 const {courseId}=useParams<{courseId:string}>();const [topics,setTopics]=useState<Topic[]>([]);const [error,setError]=useState('');
 useEffect(()=>{fetch(`/api/faculty/courses/${courseId}/topic-mastery`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setTopics(d.topics||[]);}).catch(e=>setError(e.message));},[courseId]);
 return <main className="max-w-5xl mx-auto space-y-5"><Link className="underline text-sm" href={`/faculty/courses/${courseId}`}>← Course</Link><h1 className="text-3xl font-semibold">Topic mastery across students</h1>
  <p className="text-sm text-ink-2">Only active student syllabi are included. Unmapped topics are grouped by normalized name.</p>{error&&<p role="alert">{error}</p>}
  <div className="space-y-3">{topics.map(t=><article key={t.key} className="border border-paper-3 bg-paper-0 rounded p-4">
    <h2 className="font-semibold">{t.name}</h2><p className="text-sm">{t.students} students · {t.stuckStudents} below 50% · {t.advancingStudents} at or above 70%</p>
    <p className="text-xs">Tier evidence: {Object.entries(t.tierCounts).map(([k,v])=>`${k} ${v}`).join(' · ')}</p></article>)}</div>
 </main>;
}
