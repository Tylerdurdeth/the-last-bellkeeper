import {height,PATH} from './assets/terrain.js';
export {height,PATH,TERRAIN,SHORELINES,isLand,isIsland,terrainGround,ridgeBlocked,shoreClearance,shoreDistance} from './assets/terrain.js';
export const START=[-1,height(-1,18),18];
export const POINTS={cottage:[-8,8],wheel:[6,2.5],garden:[-13.2,-17.5],quietGarden:[-7,-18.5],porch:[-6.35,11.55],chime:[-9.5,-14.5],keepsake:[-19,-5],overlook:[8,-11.3],morningBell:[-0.6,15],bypass:[-6.6,10.75],outlet:[4,6.5]};
// Morning round: bell frame faces the default camera; Mara's bypass channel runs overhead from her
// valve, strapped to the great tree at (-1,10), to an outlet over the catch ring beside the seed wheel.
// Its post stands on the ring's far side (away from the default camera), off every approach line.
export const MORNING_BELL={rotation:Math.atan2(.615,.788)};
export function bypassLine(){const [vx,vz]=POINTS.bypass,[ox,oz]=POINTS.outlet,tree=[-1,10],bend=[-1.15,9.4],post=[ox-.615*.8,oz-.788*.8],y=(x,z)=>height(x,z);
 return {valve:[vx,y(vx,vz),vz],tree:[tree[0],0,tree[1]],bend:[bend[0],0,bend[1]],post:[post[0],y(...post),post[1]],mouth:[ox,y(ox,oz),oz],top:Math.max(y(vx,vz),y(...bend),y(...post))+2.35};}
export function pathDistance(x,z){let best=1e9;for(let i=1;i<PATH.length;i++){const a=PATH[i-1],b=PATH[i],dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return best;}
