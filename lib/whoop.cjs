'use strict';
const crypto = require('node:crypto');
const SESSION = '__Host-jgi-whoop';
const STATE = '__Host-jgi-whoop-state';
const API = 'https://api.prod.whoop.com/developer/v2';
function config() {
  const {WHOOP_CLIENT_ID: id, WHOOP_CLIENT_SECRET: secret, WHOOP_SESSION_SECRET: seal, WHOOP_REDIRECT_URI: redirect} = process.env;
  if (!id || !secret || !seal || Buffer.byteLength(seal) < 32 || !redirect) return null;
  try { const u = new URL(redirect); if (u.protocol !== 'https:' || u.pathname !== '/api/whoop/callback' || u.search || u.hash) return null; } catch { return null; }
  return {id, secret, seal, redirect, origin: new URL(redirect).origin};
}
function headers(res) { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff'); }
function json(res, code, value) { headers(res); res.status(code).json(value); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => { const i=s.indexOf('='); return i<0?['','']:[s.slice(0,i).trim(),s.slice(i+1)]; })); }
function encode(value, cfg) {
  const iv = crypto.randomBytes(12), key = crypto.createHash('sha256').update(cfg.seal).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
function decode(req, name, cfg) {
  try { const data=Buffer.from(cookies(req)[name]||'', 'base64url'); const decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(cfg.seal).digest(),data.subarray(0,12)); decipher.setAuthTag(data.subarray(12,28)); const result=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString()); return result.until>Date.now()?result:null; } catch { return null; }
}
function cookie(name, value, age=86400) { return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`; }
function setSession(res, tokens, cfg, until=Date.now()+86400000) {
  if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) throw new Error('invalid_token_response');
  const value=encode({access:tokens.access_token,refresh:tokens.refresh_token||null,expires:Date.now()+tokens.expires_in*1000,until},cfg);
  if(value.length>3600)throw new Error('session_too_large');
  res.setHeader('Set-Cookie',cookie(SESSION,value,Math.max(0,Math.floor((until-Date.now())/1000))));
  return {access:tokens.access_token,refresh:tokens.refresh_token,expires:Date.now()+tokens.expires_in*1000,until};
}
function sameOrigin(req,cfg) { return req.headers.origin===cfg.origin; }
async function exchange(cfg, values) {
  const response=await fetch('https://api.prod.whoop.com/oauth/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:cfg.id,client_secret:cfg.secret,...values}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('token_exchange_failed');
  return response.json();
}
async function session(req,res,cfg) {
  let s=decode(req,SESSION,cfg); if(!s)return null;
  if(s.expires<Date.now()+60000){
    if(!s.refresh)return null;
    s=setSession(res,await exchange(cfg,{grant_type:'refresh_token',refresh_token:s.refresh,scope:'offline'}),cfg,s.until);
  }
  return s;
}
async function get(path,s,optional=false) {
  const r=await fetch(API+path,{headers:{Authorization:'Bearer '+s.access},signal:AbortSignal.timeout(10000)});
  if(optional&&r.status===404)return null;
  if(!r.ok)throw new Error(r.status===401?'reconnect_required':'whoop_unavailable');
  return r.status===204?null:r.json();
}
module.exports={crypto,SESSION,STATE,API,config,headers,json,encode,decode,cookie,setSession,sameOrigin,exchange,session,get};
