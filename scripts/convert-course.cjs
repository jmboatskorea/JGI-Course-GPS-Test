'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {adaptCourseDetail}=require('../server/gi-course-adapter.cjs');
const [input,output]=process.argv.slice(2);
if(!input||!output) {console.error('Usage: node scripts/convert-course.cjs INPUT.txt OUTPUT.json');process.exit(1);}
try {
  const stat=fs.statSync(input);
  if(stat.size>32*1024*1024) throw new Error('Input exceeds 32 MiB');
  const text=fs.readFileSync(input,'utf8');
  const result=adaptCourseDetail(JSON.parse(text.slice(text.indexOf('{'))));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(result),{mode:0o600});
  console.log(JSON.stringify({courses:result.courses.map(c=>({name:c.name,holes:c.holes.length})),stats:result.stats,warnings:result.warnings},null,2));
} catch { console.error('Course conversion failed. Check the input structure; no provider payload was logged.');process.exit(1);}
