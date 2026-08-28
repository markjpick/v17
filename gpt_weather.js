/* GPT Weather Engine
 * Fixed home location, 14-day forecast, wash-date planning and ranked
 * daylight 2-hour windows. No browser geolocation required.
 */

const GPT_WEATHER_CONFIG = Object.freeze({
  lat: 53.59573,
  lon: -1.32076,
  forecastDays: 14,
  targetWashDays: 10,
  searchBeforeTargetDays: 2,
  windowHours: 2,
  tempMin: 10,
  tempMax: 30,
  precipitationMin: 0,
  precipitationMax: 20
});

const GPT_WEATHER_CODE = {
  0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',
  82:'Heavy rain showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',
  96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'
};

function gptWeatherCondition(code) { return GPT_WEATHER_CODE[Number(code)] || 'Unknown'; }

function gptWeatherRuleSource() {
  return [window.WEATHER_RULES,window.weatherRules,window.WEATHER_CONFIG,window.weatherConfig].find(Boolean) || GPT_WEATHER_CONFIG;
}
function gptWeatherRules() {
  const r=gptWeatherRuleSource();
  return {
    tempMin:Number.isFinite(Number(r.tempMin))?Number(r.tempMin):GPT_WEATHER_CONFIG.tempMin,
    tempMax:Number.isFinite(Number(r.tempMax))?Number(r.tempMax):GPT_WEATHER_CONFIG.tempMax,
    precipitationMin:Number.isFinite(Number(r.precipitationMin))?Number(r.precipitationMin):GPT_WEATHER_CONFIG.precipitationMin,
    precipitationMax:Number.isFinite(Number(r.precipitationMax))?Number(r.precipitationMax):GPT_WEATHER_CONFIG.precipitationMax
  };
}

async function gptFetchWeather() {
  const {lat,lon,forecastDays}=GPT_WEATHER_CONFIG;
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.search=new URLSearchParams({
    latitude:lat,longitude:lon,timezone:'auto',forecast_days:forecastDays,
    current:'temperature_2m,precipitation,weather_code,is_day',
    hourly:'temperature_2m,precipitation_probability,precipitation,weather_code,is_day',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset'
  });
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Weather request failed (${response.status})`);
  return response.json();
}
function gptDateOnly(value){return new Date(`${value}T12:00:00`)}
function gptDaysBetween(a,b){return Math.round((gptDateOnly(b)-gptDateOnly(a))/86400000)}
function gptReadLastWashDate(){
  const candidates=[window.GPT_STORE?.lastWashDate,window.GPT_STORE?.lastWash,window.GPT_STORE?.washHistory?.at?.(-1)?.date,window.gptWashStore?.lastWashDate,window.gptWashHistory?.at?.(-1)?.date];
  for(const value of candidates){if(!value)continue;const d=new Date(value);if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10)}
  return null;
}
function gptTargetDate(lastWashDate){if(!lastWashDate)return null;const d=gptDateOnly(lastWashDate);d.setDate(d.getDate()+GPT_WEATHER_CONFIG.targetWashDays);return d.toISOString().slice(0,10)}
function gptHourlyRecords(data){
  const h=data.hourly||{};
  return (h.time||[]).map((time,i)=>({time,date:time.slice(0,10),hour:new Date(time).getHours(),temp:Number(h.temperature_2m?.[i]),rainProbability:Number(h.precipitation_probability?.[i]),precipitation:Number(h.precipitation?.[i]||0),code:Number(h.weather_code?.[i]),condition:gptWeatherCondition(h.weather_code?.[i]),isDay:Boolean(h.is_day?.[i])}));
}
function gptScoreHour(hour,rules){
  const tempGood=hour.temp>=rules.tempMin&&hour.temp<=rules.tempMax;
  const rainGood=hour.rainProbability>=rules.precipitationMin&&hour.rainProbability<=rules.precipitationMax;
  const ideal=tempGood&&rainGood;
  let score=100;
  const tempDistance=hour.temp<rules.tempMin?rules.tempMin-hour.temp:hour.temp>rules.tempMax?hour.temp-rules.tempMax:0;
  const rainDistance=hour.rainProbability<rules.precipitationMin?rules.precipitationMin-hour.rainProbability:hour.rainProbability>rules.precipitationMax?hour.rainProbability-rules.precipitationMax:0;
  score-=tempDistance*8+rainDistance*3;
  if(hour.code>=95)score-=80;else if([65,67,75,82,86].includes(hour.code))score-=45;else if([61,63,71,73,80,81,85].includes(hour.code))score-=20;
  return {...hour,ideal,score};
}
function gptFindWindows(records,targetDate,lastWashDate){
  if(!targetDate)return[];
  const rules=gptWeatherRules();
  const earliest=gptDateOnly(targetDate);earliest.setDate(earliest.getDate()-GPT_WEATHER_CONFIG.searchBeforeTargetDays);
  const earliestDate=earliest.toISOString().slice(0,10);
  const eligible=records.filter(r=>r.isDay&&r.date>=earliestDate&&(!lastWashDate||r.date>lastWashDate));
  const scored=eligible.map(r=>gptScoreHour(r,rules));
  const windows=[];
  for(let i=0;i<=scored.length-GPT_WEATHER_CONFIG.windowHours;i++){
    const chunk=scored.slice(i,i+GPT_WEATHER_CONFIG.windowHours);
    if(chunk.some((x,j)=>j&&new Date(x.time)-new Date(chunk[j-1].time)!==3600000))continue;
    const avg=chunk.reduce((s,x)=>s+x.score,0)/chunk.length;
    const idealCount=chunk.filter(x=>x.ideal).length;
    const start=new Date(chunk[0].time);const end=new Date(chunk[chunk.length-1].time);end.setHours(end.getHours()+1);
    windows.push({date:chunk[0].date,start:start.toISOString(),end:end.toISOString(),hours:chunk,ideal:idealCount===chunk.length,idealCount,score:avg,distanceToTarget:Math.abs(gptDaysBetween(chunk[0].date,targetDate))});
  }
  return windows.sort((a,b)=>a.distanceToTarget-b.distanceToTarget||Number(b.ideal)-Number(a.ideal)||b.score-a.score);
}
function gptDailySummary(data,targetDate){
  const d=data.daily||{};
  return (d.time||[]).map((date,i)=>({date,code:Number(d.weather_code?.[i]),condition:gptWeatherCondition(d.weather_code?.[i]),max:Number(d.temperature_2m_max?.[i]),min:Number(d.temperature_2m_min?.[i]),rainProbability:Number(d.precipitation_probability_max?.[i]),precipitation:Number(d.precipitation_sum?.[i]||0),sunrise:d.sunrise?.[i]||null,sunset:d.sunset?.[i]||null,isTarget:date===targetDate}));
}
function gptWeatherRecommendation(data,lastWashDate=gptReadLastWashDate()){
  const targetDate=gptTargetDate(lastWashDate);const hourly=gptHourlyRecords(data);const windows=gptFindWindows(hourly,targetDate,lastWashDate);
  const ideal=windows.filter(w=>w.ideal).sort((a,b)=>a.distanceToTarget-b.distanceToTarget||b.score-a.score)[0]||null;
  const acceptable=windows.find(w=>w.ideal===false)||windows[0]||null;
  return {location:{lat:GPT_WEATHER_CONFIG.lat,lon:GPT_WEATHER_CONFIG.lon},lastWashDate,targetDate,daysUntilTarget:targetDate?gptDaysBetween(new Date().toISOString().slice(0,10),targetDate):null,daily:gptDailySummary(data,targetDate),hourly,windows,idealWindow:ideal,bestAvailable:ideal||acceptable,recommendation:ideal?'ideal':acceptable?'acceptable':'none',rules:gptWeatherRules(),current:data.current||null};
}
window.GPT_WEATHER=Object.freeze({config:GPT_WEATHER_CONFIG,fetch:gptFetchWeather,build:gptWeatherRecommendation,condition:gptWeatherCondition,targetDate:gptTargetDate});
