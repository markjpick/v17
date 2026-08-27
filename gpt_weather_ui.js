/* 14-day weather planning UI.
 * This is a presentation module: gpt_weather.js owns forecast/recommendation
 * logic; this module renders the planning view and upgrades the homepage
 * weather instrument without depending on the legacy weather code.
 */
(()=>{'use strict';
const icon=c=>{if(c===0)return'☀️';if(c<=2)return'🌤️';if(c===3)return'☁️';if(c<=48)return'🌫️';if(c<=57)return'🌦️';if(c<=67)return'🌧️';if(c<=77)return'❄️';if(c<=82)return'🌧️';if(c>=95)return'⛈️';return'⛅'};
const fmtDate=s=>new Date(`${s}T12:00:00`).toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'});
const fmtHour=s=>new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
function renderWeatherPlan(result){
 const view=document.querySelector('#view'); if(!view)return;
 const old=view.querySelector('.weather-planning'); if(old)old.remove();
 const target=result.targetDate;
 const best=result.bestAvailable;
 const state=result.recommendation;
 const title=state==='ideal'?'A good wash window is available':state==='acceptable'?'There is a workable window':'No suitable window found';
 const tone=state==='ideal'?'good':state==='acceptable'?'maybe':'poor';
 const rec=best?`<div class="weather-recommendation ${tone}"><div><span class="eyebrow">${state==='ideal'?'RECOMMENDED WINDOW':'BEST AVAILABLE'}</span><strong>${fmtDate(best.date)} · ${fmtHour(best.start)}–${fmtHour(best.end)}</strong><p>${best.ideal?'Conditions meet the wash rules.':'Conditions are acceptable but not ideal — check the sky before starting.'}</p></div><span class="rec-score">${Math.round(best.score)}</span></div>`:`<div class="weather-recommendation poor"><div><span class="eyebrow">BEST AVAILABLE</span><strong>No reliable window yet</strong><p>Keep an eye on the forecast around your wash date.</p></div></div>`;
 const days=result.daily.map(d=>`<div class="forecast-day ${d.isTarget?'target':''}"><small>${fmtDate(d.date)}</small><i>${icon(d.code)}</i><strong>${d.max}°</strong><span>${d.min}° · ${Math.round(d.rainProbability)}% rain</span>${d.isTarget?'<b class="target-badge">10 DAY TARGET</b>':''}</div>`).join('');
 const section=document.createElement('section'); section.className='weather-planning';
 section.innerHTML=`<div class="planning-head"><div><span class="eyebrow">14 DAY OUTLOOK</span><h3>${title}</h3><p>${target?`Target wash day: <b>${fmtDate(target)}</b> · planning starts 2 days before.`:'Complete a wash to establish the next 10-day target.'}</p></div><span class="planning-mark">${state==='ideal'?'✓':state==='acceptable'?'~':'•'}</span></div>${rec}<div class="forecast-strip">${days}</div>`;
 const hero=view.querySelector('.hero'); if(hero)hero.insertAdjacentElement('afterend',section); else view.prepend(section);
}
async function upgrade(){if(!window.GPT_WEATHER)return;try{const data=await GPT_WEATHER.fetch();const result=GPT_WEATHER.build(data);window.GPT_WEATHER_RESULT=result;renderWeatherPlan(result);const now=document.querySelector('.weather-now'),ring=document.querySelector('.weather-hours-ring');if(!now||!ring)return;const current=data.current;const h=result.hourly.slice(0,5);now.innerHTML=`<span class="weather-icon">${icon(Number(current.weather_code))}</span><strong>${Math.round(current.temperature_2m)}°</strong><small>${result.current?'live conditions': 'current conditions'}</small><b>${Math.round(current.precipitation||0)} mm</b>`;ring.innerHTML=h.map((x,i)=>`<span style="--slot:${i}">${fmtHour(x.time)}<i>${icon(x.code)}</i><b>${Math.round(x.temp)}° · ${Math.round(x.rainProbability)}%</b></span>`).join('');const status=document.querySelector('.status-line');if(status)status.innerHTML='<span class="status-dot"></span><strong>14-day forecast loaded</strong><span>Wash planning active</span>';}catch(e){console.warn('14-day weather planning unavailable',e)}}
window.GPT_WEATHER_UI={refresh:upgrade};
const observer=new MutationObserver(()=>{if(document.querySelector('.weather-instrument')&&!document.querySelector('.weather-planning'))upgrade()});
observer.observe(document.querySelector('#view')||document.body,{childList:true,subtree:true});
setTimeout(upgrade,350);
})();
