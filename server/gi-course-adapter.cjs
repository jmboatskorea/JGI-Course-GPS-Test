'use strict';
// Server/offline only. Never import this module or provider credentials into the browser.
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const TYPES = Object.freeze({ FairwayTrace:'FAIRWAY', BunkerTrace:'BUNKER', GreenTrace:'GREEN',
  TeeboxTrace:'TEE', HoleBoundry:'HOLE_BOUNDARY', WaterTrace:'WATER', WaterPath:'WATER_PATH' });
const MAX_BYTES = 32 * 1024 * 1024;
const key = value => String(value);
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
function coordinate(value) {
  if (!value || number(value.latitude) === null || number(value.longitude) === null ||
      Math.abs(value.latitude)>90 || Math.abs(value.longitude)>180) return null;
  return {lat:value.latitude,lng:value.longitude};
}
function decodeData(data) {
  if (typeof data !== 'string' || !data.length || data.length > MAX_BYTES ||
      data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Invalid GI Base64 data');
  try {
    const decoded = JSON.parse(gunzipSync(Buffer.from(data,'base64'),{maxOutputLength:MAX_BYTES}).toString('utf8'));
    if (!Array.isArray(decoded)) throw new Error();
    return decoded;
  } catch { throw new Error('GI data must decode to a bounded GZIP JSON array'); }
}
function canonicalPath(path, polygon) {
  const points = path.map(p=>`${p.lat},${p.lng}`);
  if (!polygon) return [points.join(';'),[...points].reverse().join(';')].sort()[0];
  // Ring start and winding must not affect dedupe. No rounding of provider coordinates.
  const least = points.reduce((a,b)=>a<b?a:b);
  const candidates=[];
  for (let i=0;i<points.length;i++) if(points[i]===least) {
    candidates.push(points.slice(i).concat(points.slice(0,i)).join(';'));
    const reversed=[...points].reverse(), j=points.length-1-i;
    candidates.push(reversed.slice(j).concat(reversed.slice(0,j)).join(';'));
  }
  return candidates.sort()[0];
}
function adaptCourseDetail(detail, {holeCourseIds={}}={}) {
  if (!detail || typeof detail.publicId!=='string' || !Array.isArray(detail.courses) || !Array.isArray(detail.holes))
    throw new Error('Invalid Course Detail envelope');
  const records=detail.data ? decodeData(detail.data) : detail.gpsItems;
  if (!Array.isArray(records)) throw new Error('Missing GI geometry');
  const warnings=[];
  const courses=detail.courses.map(c=>({courseId:key(c.courseId),name:String(c.name),holes:[]}));
  const byCourse=new Map(courses.map(c=>[c.courseId,c]));
  if(byCourse.size!==courses.length) throw new Error('Duplicate courseId');
  const owners=new Map();
  function assign(holeId,courseId) {
    const h=key(holeId), c=key(courseId);
    if(!byCourse.has(c) || (owners.has(h)&&owners.get(h)!==c)) throw new Error('Conflicting hole/course mapping');
    owners.set(h,c);
  }
  for(const [h,c] of Object.entries(holeCourseIds)) assign(h,c);
  const allHoles=new Map(detail.holes.map(h=>[key(h.holeId),h]));
  for(const h of detail.holes) if(h.courseId!=null) assign(h.holeId,h.courseId);
  for(const c of detail.courses) {
    for(const t of c.tees||[]) {
      for(const h of t.holes||[]) {
        assign(h.holeId,c.courseId);
        if(!allHoles.has(key(h.holeId))) allHoles.set(key(h.holeId),h);
      }
    }
  }
  // This provider sample has no courseId on top-level holes. Infer only a single
  // remaining course with a complete, unique expected hole-number set.
  const unassigned=[...allHoles.values()].filter(h=>!owners.has(key(h.holeId)));
  const remaining=courses.filter(c=>![...owners.values()].includes(c.courseId));
  if(unassigned.length && remaining.length===1) {
    const raw=detail.courses.find(c=>key(c.courseId)===remaining[0].courseId);
    const expected=raw.courseHoleType==='EighteenHole'?18:raw.courseHoleType==='NineHole'?9:0;
    const nums=new Set(unassigned.map(h=>h.holeNumber));
    if(expected && unassigned.length===expected && nums.size===expected && [...nums].every(n=>Number.isInteger(n)&&n>=1&&n<=expected)) {
      unassigned.forEach(h=>assign(h.holeId,raw.courseId));
      warnings.push({code:'COURSE_INFERRED_BY_REMAINDER',courseId:key(raw.courseId)});
    }
  }
  const byHole=new Map();
  for(const h of allHoles.values()) {
    const course=byCourse.get(owners.get(key(h.holeId)));
    if(!course) {warnings.push({code:'UNASSIGNED_HOLE',holeId:key(h.holeId)});continue;}
    if(!Number.isInteger(h.holeNumber)||h.holeNumber<1||h.holeNumber>18 || course.holes.some(x=>x.holeNumber===h.holeNumber))
      throw new Error('Invalid or duplicate hole number in course');
    const hole={holeId:key(h.holeId),holeNumber:h.holeNumber,tee:coordinate(h.teeGPSCoordinate),green:coordinate(h.greenGPSCoordinate),shapes:[]};
    course.holes.push(hole);byHole.set(hole.holeId,hole);
  }
  const seenRecords=new Set(),seenShapes=new Set();let duplicateRecords=0,duplicateShapes=0,invalidShapes=0,unknownTypes=0;
  for(const record of records) {
    const hole=byHole.get(key(record.holeId)), type=TYPES[record.gpsType];
    if(!type) {unknownTypes++;continue;}
    if(!hole) continue;
    const recordKey=JSON.stringify(record);
    if(seenRecords.has(recordKey)) {duplicateRecords++;continue;}
    seenRecords.add(recordKey);
    for(const raw of Array.isArray(record.shapes)?record.shapes:[]) {
      const polygon=type!=='WATER_PATH';
      if(!Array.isArray(raw)) {invalidShapes++;continue;}
      let path=raw.map(coordinate);
      if(path.some(p=>!p)) {invalidShapes++;continue;}
      path=path.filter((p,i)=>!i||p.lat!==path[i-1].lat||p.lng!==path[i-1].lng);
      if(polygon && path.length>1 && JSON.stringify(path[0])===JSON.stringify(path.at(-1)))path.pop();
      if(new Set(path.map(p=>`${p.lat},${p.lng}`)).size < (polygon?3:2)) {invalidShapes++;continue;}
      const shapeKey=`${hole.holeId}|${type}|${canonicalPath(path,polygon)}`;
      if(seenShapes.has(shapeKey)) {duplicateShapes++;continue;}
      seenShapes.add(shapeKey);
      hole.shapes.push({id:createHash('sha256').update(shapeKey).digest('hex'),type,geometry:polygon?'POLYGON':'POLYLINE',path});
    }
  }
  for(const c of courses) c.holes.sort((a,b)=>a.holeNumber-b.holeNumber);
  return {schemaVersion:1,publicId:detail.publicId,name:String(detail.name),updatedOn:detail.updatedOn||null,courses,warnings,
    stats:{inputRecords:records.length,duplicateRecords,duplicateShapes,invalidShapes,unknownTypes,outputShapes:seenShapes.size}};
}
module.exports={adaptCourseDetail,decodeData,TYPES};
