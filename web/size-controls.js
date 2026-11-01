import { element } from "./studio.js";

export function sizeControls(choices, value, onChange) {
  const groups = new Map();
  const gcd = (a,b) => b ? gcd(b,a%b) : a;
  for (const choice of choices) {
    const [width,height] = choice.split("*").map(Number);
    const divisor = gcd(width,height), ratio = `${width/divisor}:${height/divisor}`;
    if (!groups.has(ratio)) groups.set(ratio, {name:`${width === height ? "Square" : width > height ? "Wide" : "Portrait"} · ${ratio}`, sizes:[]});
    groups.get(ratio).sizes.push({value:choice,area:width*height});
  }
  for (const group of groups.values()) group.sizes.sort((a,b)=>a.area-b.area);
  const root = element("div",null,{class:"studio-size-controls"});
  const aspectLabel = element("label","Aspect ratio"), resolutionLabel = element("label","Resolution");
  const aspect = element("select",null,{"aria-label":"Aspect ratio"});
  const resolution = element("select",null,{"aria-label":"Resolution"});
  const hint = element("p",null,{class:"studio-hint"});
  for (const [ratio,group] of groups) aspect.append(element("option",group.name,{value:ratio}));
  aspect.value = [...groups].find(([,g])=>g.sizes.some(s=>s.value===value))?.[0] || groups.keys().next().value;
  function populate(preferred) {
    resolution.replaceChildren();
    const sizes = groups.get(aspect.value).sizes;
    sizes.forEach((size,index)=>{
      const tier = sizes.length === 1 ? "Native" : index === 0 ? "Low" : index === sizes.length-1 ? "High" : "Medium";
      resolution.append(element("option",`${tier} · ${size.value.replace("*"," × ")}`,{value:size.value}));
    });
    resolution.value = sizes.some(s=>s.value===preferred) ? preferred : sizes[0].value;
    hint.textContent = sizes.length === 1 ? "This model offers one native resolution for this aspect ratio." : "";
    hint.hidden = sizes.length !== 1;
  }
  populate(value);
  aspect.onchange = () => {
    const high = resolution.selectedIndex === resolution.options.length-1 && resolution.options.length>1;
    populate();
    if (high) resolution.selectedIndex = resolution.options.length-1;
    onChange(resolution.value);
  };
  resolution.onchange = () => onChange(resolution.value);
  aspectLabel.append(aspect);resolutionLabel.append(resolution);
  root.append(aspectLabel,resolutionLabel,hint);
  return root;
}
