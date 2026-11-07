'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Coverage = { course: {name:string;code:string}; enrolledStudents:number; studentsWithSyllabus:number; coveredConcepts:number; uncoveredConcepts: {id:string;name:string}[]; unmappedTopicCount:number; averageEstimatedMinutes:number|null };
export default function CoveragePage() {
  const {courseId}=useParams<{courseId:string}>(); const [data,setData]=useState<Coverage|null>(null); const [error,setError]=useState('');
  useEffect(()=>{fetch(`/api/faculty/courses/${courseId}/syllabus-coverage`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);}).catch(e=>setError(e.message));},[courseId]);
  return <main className="max-w-5xl mx-auto space-y-6"><Link href={`/faculty/courses/${courseId}`} className="underline text-sm">← Course</Link><h1 className="text-3xl font-semibold">Syllabus coverage</h1>
    {error&&<p role="alert">{error}</p>}{data&&<><p>{data.course.code} · {data.course.name}</p>
    <div className="grid grid-cols-3 gap-3">{[["Students uploaded",`${data.studentsWithSyllabus}/${data.enrolledStudents}`],["Covered concepts",data.coveredConcepts],["Unmapped topics",data.unmappedTopicCount]].map(([label,v])=><div key={label} className="rounded border p-4"><p className="text-xs">{label}</p><strong className="text-xl">{v}</strong></div>)}</div>
    <p>Average estimated study time: {data.averageEstimatedMinutes ?? 'Unknown'} minutes</p>
    <h2 className="text-xl font-semibold">Faculty concepts not covered by uploaded syllabi</h2><ul className="space-y-1">{data.uncoveredConcepts.map(c=><li key={c.id} className="text-sm">{c.name}</li>)}</ul></>}
  </main>;
}
