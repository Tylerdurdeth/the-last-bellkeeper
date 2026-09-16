export const PATH=[[-1, 18], [-5, 13], [-4, 8], [-10, 5], [-15, 0], [-16, -7], [-10, -10], [-10, -17]];
export function height(x,z){let h=.18*Math.sin(x*.29)*Math.cos(z*.24)+.12*Math.sin(z*.40);h+=2.5*Math.exp(-((x+12)**2+(z+12)**2)/130);const blend=Math.max(0,Math.min(1,(x-1)/4));h=h*(1-blend)+(1.2+Math.max(0,x-15)*.07)*blend;if(x>2&&z< -13){let q=Math.max(0,Math.min(1,(-z-13+1.1*Math.sin(x*.35))/2.7));h-=7*q*q*(3-2*q);}// Preserve the crossing profile beneath the bridge; soften the exposed banks beyond it.
const bankFade=Math.min(1,Math.max(0,(Math.abs(x-8)-2)/3));
const bankWave=bankFade*(.13+.12*Math.sin(x*.73));
const north=-5.5+bankWave,south=-1.2-bankFade*(.14+.12*Math.sin(x*.51+1.2));
if(x>2&&x<31&&z>north&&z<south){const depth=Math.min(z-north,south-z,x-2,31-x);const slope=.70*bankFade;let cut=slope>.001?Math.min(1,depth/slope):1;cut=cut*cut*(3-2*cut);h+=( -4-h)*cut;}return h;}
export const START=[-1,height(-1,18),18];
export const POINTS={cottage:[-8,8],wheel:[6,2.5],garden:[-13.2,-17.5],quietGarden:[-7,-18.5],porch:[-6.5,11],chime:[-9.5,-14.5],keepsake:[-19,-5],overlook:[8,-10]};
export function pathDistance(x,z){let best=1e9;for(let i=1;i<PATH.length;i++){const a=PATH[i-1],b=PATH[i],dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return best;}
