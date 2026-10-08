'use strict';

const MAX_BODY_CHARS=1_300_000;
const MAX_QUESTION_CHARS=1000;

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function parseBody(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string')return JSON.parse(req.body);
  return null;
}
function outputText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==='output_text'&&typeof content.text==='string')parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

module.exports=async(req,res)=>{
  const key=process.env.OPENAI_API_KEY?.trim();
  const model=(process.env.JGI_AGENT_MODEL||'chat-latest').trim();

  if(req.method==='GET'){
    return json(res,200,{status:key?'ready':'configuration_pending',model:key?model:null});
  }
  if(req.method!=='POST')return json(res,405,{status:'method_not_allowed'});
  if(!key)return json(res,503,{status:'configuration_pending',message:'JGI Agent 연결 설정이 필요합니다. Vercel에 OPENAI_API_KEY를 설정해 주세요.'});

  let body;
  try{body=parseBody(req)}catch{return json(res,400,{status:'invalid_json',message:'질문 데이터를 읽지 못했습니다.'})}
  const question=String(body?.question||'').trim();
  const context=body?.context;
  if(!question)return json(res,400,{status:'question_required',message:'질문을 입력해 주세요.'});
  if(question.length>MAX_QUESTION_CHARS)return json(res,400,{status:'question_too_long',message:'질문은 1000자 이내로 입력해 주세요.'});
  if(!context||!Array.isArray(context.rounds)||!context.rounds.length)return json(res,400,{status:'round_context_required',message:'분석할 라운드 데이터가 없습니다.'});

  const contextText=JSON.stringify(context);
  if(contextText.length>MAX_BODY_CHARS)return json(res,413,{status:'context_too_large',message:'선택한 라운드 데이터가 너무 많습니다. 라운드 수를 줄여 다시 질문해 주세요.'});

  const instructions=[
    'You are JGI Player Agent, an on-course and post-round golf performance analyst.',
    'Use ONLY the supplied JGI round context as factual evidence. Do not invent missing shots, causes, benchmark values, course facts, or player-state facts.',
    'Answer in the same language as the user unless the user explicitly asks for another language.',
    'When the question asks why an SG number occurred, decompose it numerically when data exists: shot/hole, category, expected before, expected after, SG, and benchmark.',
    'Separate observed facts/calculations from interpretation. Do not claim psychology caused a miss; describe only observed associations and sample counts.',
    'If GPS accuracy/source or missing position data can materially affect the answer, say so and lower confidence.',
    'For modeled benchmarks, explicitly identify them as modeled when benchmark interpretation matters. Do not present modeled values as measured population truth.',
    'For multi-round questions, state sample size and selected-round range. For one round, do not pretend there is a trend.',
    'When useful, end with one practical action or one verification step, but do not fabricate advice from unsupported data.',
    'Keep the answer clear and detailed enough to explain the evidence. Plain text is preferred; short headings are allowed.'
  ].join('\n');

  const input=[
    'USER QUESTION:\n'+question,
    '',
    'JGI SELECTED ROUND CONTEXT (JSON):',
    contextText
  ].join('\n');

  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({model,instructions,input,max_output_tokens:2200,store:false})
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      const detail=data?.error?.message||'Agent provider request failed';
      console.error('JGI Agent provider error',response.status,detail);
      return json(res,502,{status:'agent_unavailable',message:'JGI Agent 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
    }
    const answer=outputText(data);
    if(!answer)return json(res,502,{status:'empty_agent_response',message:'JGI Agent가 빈 응답을 반환했습니다.'});
    return json(res,200,{status:'ok',answer});
  }catch(e){
    console.error('JGI Agent request failed',e?.message||e);
    return json(res,502,{status:'agent_unavailable',message:'JGI Agent 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'});
  }
};
